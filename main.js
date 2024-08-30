'use strict';

import fs from 'fs';
import outputResults from './outputResults.js';

const groups = JSON.parse(fs.readFileSync('groups.json'));
const exhibitions = JSON.parse(fs.readFileSync('exhibitions.json'));

const getInitialForms = (exhibitions) => {
  const teamRankings = Object.values(groups).reduce((acc, groupTeams) => [
    ...acc,
    ...groupTeams.map(groupTeam => ({ ...groupTeam, form: 0 }))
  ], [])

  for (const team in exhibitions) {
    const homeTeam = teamRankings.find(teamRanking => teamRanking.ISOCode === team)
    const rankHome = homeTeam.FIBARanking

    exhibitions[team].forEach(match => {
      const awayTeam = teamRankings.find(teamRanking => teamRanking.ISOCode === match.Opponent);
      const rankAway = awayTeam.FIBARanking
      const [score1, score2] = match.Result.split('-').map(Number);

      const pointDiff = expectedPointDiff(rankHome, rankAway, score1, score2);
      rankHome < rankAway ? homeTeam.form += pointDiff : awayTeam.form += pointDiff;
    });
  }

  const form = Object.values(teamRankings).reduce((acc, team) => {
    acc[team.ISOCode] = team.form;
    return acc;
  }, {});

  return form;
}

/**
 * Gets the average number of points from the exhibition stage for two teams.
 * This score will be used as a base score for the match.
 * 
 * @param {string} team1 - The ISO code of the first team.
 * @param {string} team2 - The ISO code of the second team.
 * @returns {number} The base score calculated from the teams' exhibition points.
 */
const getBaseScore = (team1, team2) => {
  const getTotalPointsForTeam = (team) => {
    return exhibitions[team].reduce((acc, match) => {
      const pointsInMatch = match.Result.split('-').map(Number).reduce((sum, x) => sum + x);
      return acc + Math.floor(pointsInMatch / 2);
    }, 0);
  };

  // Subtract a constant amount since defenses will be tougher in the main stage
  return Math.floor((getTotalPointsForTeam(team1) + getTotalPointsForTeam(team2)) / 4) - 6;
}

/**
 * Calculates the adjusted point difference based on the ranks of the home and away teams,
 * taking into account the actual score and the expected point difference.
 *
 * @param {number} rankHome - The rank of the home team.
 * @param {number} rankAway - The rank of the away team.
 * @param {number} score1 - The score of the first team (home if higher ranked, otherwise away).
 * @param {number} score2 - The score of the second team (home if lower ranked, otherwise away).
 * @returns {number} The adjusted point difference, considering the rank difference and actual score.
 * If the rank difference is greater than 10 and the actual margin is less than expected, returns 0.
 * This is because favorites beating teams by low margin doesn't affect the outcome afterwards,
 * but affects when they beat underdogs by higher margin.
 *
 * @example
 * // Rank difference ≤ 10, with a close match
 * expectedPointDiff(5, 7, 100, 98);
 * // returns adjusted margin based on the rank difference and actual score
 *
 * @example
 * // Rank difference > 10, home team wins by a smaller margin than expected
 * expectedPointDiff(10, 30, 80, 70);
 * // returns 0 (no reward, no penalty)
 *
 * @example
 * // Rank difference > 10, home team wins by a larger margin than expected
 * expectedPointDiff(10, 30, 90, 60);
 * // returns adjusted positive margin (reward for larger margin)
 */
function expectedPointDiff(rankHome, rankAway, score1, score2) {
  const actualPointDiff = rankHome < rankAway ? score1 - score2 : score2 - score1;
  // Calculate the rank difference
  const rankDiff = Math.abs(rankHome - rankAway);

  // For small rank differences
  const baseDiff = 4;

  const maxDiff = 30;

  // Nonlinear scaling factor
  const scalingFactor = 1.5;

  // Point difference calculated using a power function
  const pointDiff = baseDiff + (maxDiff - baseDiff) * Math.pow(rankDiff / 30, scalingFactor);

  let margin;

  // If the rank difference is greater than 10, apply special rules
  if (rankDiff > 10) {
    if (actualPointDiff >= margin) {
      // Reward the higher-ranked team if they won by a bigger margin
      margin = actualPointDiff / 3;
      // Else: Do nothing, margin remains unchanged (no penalty)
    } else {
      return 0
    }
  } else {
    // In case of small rank difference, use the normal calculation
    margin = (actualPointDiff - pointDiff) / 3;
  }

  return Math.round(margin)
}

const teamForm = getInitialForms(exhibitions);

/**
 * Updates the form of two teams based on the result of a match.
 * The form is updated using a weighted average, where the form factor determines
 * the influence of the current match's result on the team's overall form.
 *
 * @param {object} team1 - The first team object, representing the home or away team.
 * @param {object} team2 - The second team object, representing the opponent.
 * @param {number} score1 - The score of the first team (team1).
 * @param {number} score2 - The score of the second team (team2).
 */
const updateTeamForm = (team1, team2, score1, score2) => {
  const formFactor = 0.07;
  teamForm[team1.ISOCode] = (teamForm[team1.ISOCode] * (1 - formFactor)) + ((score1 - score2) * formFactor);
  teamForm[team2.ISOCode] = (teamForm[team2.ISOCode] * (1 - formFactor)) + ((score2 - score1) * formFactor);
}

/**
 * Simulates a match between two teams and returns the result.
 * 
 * The function calculates the match result based on the teams' FIFA rankings, current form, 
 * and a random factor. The resulting scores are rounded to the nearest integer and used 
 * to update the teams' form. The match result is logged to the console.
 *
 * @param {object} team1 - The first team participating in the match.
 * @param {object} team2 - The second team participating in the match.
 * @param {string} team1.ISOCode - The ISO code of the first team.
 * @param {number} team1.FIBARanking - The FIFA ranking of the first team.
 * @param {string} team2.ISOCode - The ISO code of the second team.
 * @param {number} team2.FIBARanking - The FIFA ranking of the second team.
 * @returns {object} An object containing the simulated scores for both teams.
 * @returns {number} return.team1 - The score for the first team.
 * @returns {number} return.team2 - The score for the second team.
 *
 * @example
 * const teamA = { ISOCode: 'CAN', FIBARanking: 10 };
 * const teamB = { ISOCode: 'USA', FIBARanking: 20 };
 * const result = simulateMatch(teamA, teamB);
 * 
 * // Logs the simulated match result and updates team forms
 * Result will be { team1: 88, team2: 82 }
 */
const simulateMatch = (team1, team2) => {
  const rankDiff = (team2.FIBARanking - team1.FIBARanking) * 0.65;
  const formDiff = (teamForm[team1.ISOCode] - teamForm[team2.ISOCode]) * 0.35;
  const baseScore = getBaseScore(team1.ISOCode, team2.ISOCode);
  const randomFactor = Math.random() * 10 - 4;
  const score1 = Math.floor(Math.random() * 15) + baseScore + rankDiff + formDiff + randomFactor;
  const score2 = Math.floor(Math.random() * 15) + baseScore - rankDiff - formDiff - randomFactor;
  const result = { team1: Math.round(score1), team2: Math.round(score2) };

  updateTeamForm(team1, team2, result.team1, result.team2);

  return result;
}

/**
 * Simulates the group phase of a tournament using a round-robin format,
 * where each team plays against every other team in the group in predefined rounds.
 *
 * @param {object} groups - An object where keys are group names and values are arrays of team objects.
 * Each team object should have a `Team` property representing the team's name or identifier.
 * @returns {object} An object with group names as keys and arrays of match results as values.
 * Each match result is an object with properties `team1`, `team2`, `score1`, and `score2`.
 *
 * @example
 * const groups = {
 *   "A": [
 *     { Team: "Kanada", ISOCode: "CAN", FIBARanking: 7 },
 *     { Team: "Australija", ISOCode: "AUS", FIBARanking: 5 },
 *     { Team: "Grčka", ISOCode: "GRE", FIBARanking: 14 },
 *     { Team: "Španija", ISOCode: "ESP", FIBARanking: 2 }
 *   ]
 * };
 * 
 * const results = createRoundRobin(groups);
 * 
 * results = {
 *   "A": [
 *     { team1: "Kanada", team2: "Australija", score1: 78, score2: 87 },
 *     { team1: "Grčka", team2: "Španija", score1: 73, score2: 91 },
 *     { team1: "Kanada", team2: "Grčka", score1: 85, score2: 66 },
 *     { team1: "Australija", team2: "Španija", score1: 80, score2: 88 },
 *     { team1: "Kanada", team2: "Španija", score1: 75, score2: 85 },
 *     { team1: "Australija", team2: "Grčka", score1: 95, score2: 77 }
 *   ]
 * }
 */
const createRoundRobin = (groups) => {
  const results = {};
  for (const group in groups) {
    results[group] = [];
    const teams = groups[group];

    const rounds = [
      [[teams[0], teams[1]], [teams[2], teams[3]]],
      [[teams[0], teams[2]], [teams[1], teams[3]]],
      [[teams[0], teams[3]], [teams[1], teams[2]]],
    ]

    for (const round of rounds) {
      for (const match of round) {
        const matchResult = simulateMatch(match[0], match[1]);

        results[group].push({
          team1: match[0].Team,
          team2: match[1].Team,
          score1: matchResult.team1,
          score2: matchResult.team2
        });
      }
    }
  }

  return results;
}

/**
 * Ranks teams within each group based on their performance in the matches.
 * Teams are ranked primarily by points, then by points difference (scored - allowed), and finally by FIBA ranking if needed.
 * Points are awarded based on match results: 2 points for a win, no points for a loss. In case of a tie, the higher-ranked team is awarded win.
 *
 * @param {object} groups - An object where keys are group names and values are arrays of team objects.
 * Each team object should have a `Team` property representing the team's name or identifier and a `FIBARanking` property for ranking.
 * @param {object} results - An object where keys are group names and values are arrays of match result objects.
 * Each match result object should have `team1`, `team2`, `score1`, and `score2` properties representing the match details.
 * @returns {object} An object with group names as keys and arrays of ranked team objects as values.
 * Each ranked team object includes properties such as `Team`, `points`, `scored`, `allowed`, `wins`, and `losses`.
 *
 * @example
 * const groups = {
 *   "GroupA": [
 *     { Team: "Canada", FIBARanking: 1 },
 *     { Team: "USA", FIBARanking: 2 },
 *     { Team: "Japan", FIBARanking: 3 },
 *     { Team: "Australia", FIBARanking: 4 }
 *   ]
 * };
 * const results = {
 *   "GroupA": [
 *     { team1: 'Kanada', team2: 'Australija', score1: 74, score2: 83 },
 *     { team1: 'Grčka', team2: 'Španija', score1: 71, score2: 100 },
 *     { team1: 'Kanada', team2: 'Grčka', score1: 84, score2: 77 },
 *     { team1: 'Australija', team2: 'Španija', score1: 80, score2: 78 },
 *     { team1: 'Kanada', team2: 'Španija', score1: 77, score2: 83 },
 *     { team1: 'Australija', team2: 'Grčka', score1: 92, score2: 69 }
 *   ]
 * };
 * 
 * const rankings = rankTeams(groups, results);
 * 
 * rankings = {
 *   "GroupA": [
 *     {
 *       Team: 'Španija',
 *       ISOCode: 'ESP',
 *       FIBARanking: 2,
 *       points: 6,
 *       scored: 269,
 *       allowed: 224,
 *       wins: 3,
 *       losses: 0
       }, ...
 *   ]
 * }
 */
const rankTeams = (groups, results) => {
  const rankings = {};
  for (const group in groups) {
    const teams = groups[group].map(team => ({
      ...team,
      points: 0,
      scored: 0,
      allowed: 0,
      wins: 0,
      losses: 0,
    }));

    results[group].forEach(match => {
      const team1 = teams.find(t => t.Team === match.team1);
      const team2 = teams.find(t => t.Team === match.team2);
      team1.scored += match.score1;
      team1.allowed += match.score2;
      team2.scored += match.score2;
      team2.allowed += match.score1;

      // No draws, if same score, add 1 point to higher ranked team
      if (team1.scored === team2.scored) {
        team1.FIBARanking < team2.FIBARanking ? team1.scored += 1 : team2.scored += 1;
      }

      const processTeamOneWin = () => {
        team1.points += 2;
        team1.wins += 1;
        team2.losses += 1;
      }

      const processTeamTwoWin = () => {
        team2.points += 2;
        team2.wins += 1;
        team1.losses += 1;
      }

     match.score1 > match.score2 ? processTeamOneWin() : processTeamTwoWin();
    });

    teams.sort((a, b) => b.points - a.points || (b.scored - b.allowed) - (a.scored - a.allowed));
    rankings[group] = teams;
  }

  return rankings;
}

/**
 * Ranks teams for the elimination stage based on their performance in the group stage.
 * Teams are ranked first by their points, then by goal difference (scored - allowed), and finally by their group position.
 * The function selects the top 8 teams for the elimination stage, consisting of the top two teams from each group, and two out of
 * three third teams.
 *
 * @param {object} rankings - An object where keys are group names (e.g., "A", "B", "C") and values are arrays of ranked team objects.
 * Each ranked team object includes properties such as `Team`, `points`, `scored`, `allowed`, `wins`, and `losses`.
 * @returns {Array} An array of the top 8 ranked teams, each represented by a team object.
 */
const getTopEightTeams = (rankings) => {
  const rankGroups = (teams) => teams.sort((a, b) => b.points - a.points || (b.scored - b.allowed) - (a.scored - a.allowed));

  const firstPlaceTeams = rankGroups([rankings.A[0], rankings.B[0], rankings.C[0]]);
  const secondPlaceTeams = rankGroups([rankings.A[1], rankings.B[1], rankings.C[1]]);
  const thirdPlaceTeams = rankGroups([rankings.A[2], rankings.B[2], rankings.C[2]]);

  return [...firstPlaceTeams, ...secondPlaceTeams, ...thirdPlaceTeams].slice(0, 8);
}

/**
 * Draws the matchups for the elimination round of a tournament based on the provided teams.
 * Teams are divided into pots and then drawn into quarterfinal matchups. Each pot contains two teams,
 * and each quarterfinal matchup is created by pairing one team from the current pot with a team from the corresponding opposite pot.
 *
 * @param {Array} teams - An array of team objects representing 8 teams advancing to the elimination round.
 * @returns {Array} An array of arrays representing the quarterfinal matchups. Each inner array contains two team objects.
 */
const getEliminationMatches = (teams) => {
  const pots = [[], [], [], []];

  for (let i = 0; i < teams.length; i++) {
    pots[Math.floor(i / 2)].push(teams[i]);
  }

  const quarterfinals = [];

  for (let i = 0; i < 4; i++) {
    quarterfinals.push([pots[i][0], pots[3 - i][1]]);
  }

  return quarterfinals;
}

/**
 * Simulates the elimination rounds of a tournament, including quarterfinals, semifinals, finals, and a bronze match.
 * The function processes match results for each stage and determines the winners and losers for each round.
 *
 * @param {Array<Array<object>>} quarterfinals - An array of matches representing the quarterfinals. Each match is an array containing two team objects.
 * Each team object should have properties used by the `simulateMatch` function to determine the outcome.
 * @returns {object} An object containing the results of each stage of the elimination process:
 *   - `quarterfinals`: An array of objects with the match and the result for each quarterfinal.
 *   - `semifinals`: An array of objects with the match and the result for each semifinal.
 *   - `finals`: An array of objects with the match and the result for the final.
 *   - `bronze`: An array of objects with the match and the result for the bronze match.
 */
const getEliminationResults = (quarterfinals) => {
  const [semifinals, bronzeMatch, finals] = [[], [], []];
  const results = { quarterfinals: [], semifinals: [], finals: [], bronze: [] };

  quarterfinals.forEach(match => {
    const result = simulateMatch(match[0], match[1]);
    results.quarterfinals.push({ match, result });
    semifinals.push(result.team1 > result.team2 ? match[0] : match[1]);
  });

  for (let i = 0; i < 2; i++) {
    const result = simulateMatch(semifinals[i*2], semifinals[i*2 + 1]);
    results.semifinals.push({ match: [semifinals[i*2], semifinals[i*2 + 1]], result });
    finals.push(result.team1 > result.team2 ? semifinals[i*2] : semifinals[i*2 + 1]);
    bronzeMatch.push(result.team1 > result.team2 ? semifinals[i*2 + 1] : semifinals[i*2]);
  }

  const finalResult = simulateMatch(finals[0], finals[1]);
  results.finals.push({ match: finals, result: finalResult });

  const bronzeResult = simulateMatch(bronzeMatch[0], bronzeMatch[1]);
  results.bronze.push({ match: bronzeMatch, result: bronzeResult });

  return results;
}

const main = () => {
  const groupResults = createRoundRobin(groups);
  const groupRankings = rankTeams(groups, groupResults);
  const rankedTeams = getTopEightTeams(groupRankings);
  const quarterfinals = getEliminationMatches(rankedTeams);
  const eliminationResults = getEliminationResults(quarterfinals);

  outputResults(groupResults, groupRankings, eliminationResults, rankedTeams);
}

main();
