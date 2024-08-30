'use strict';

/**
 * Outputs the results of the group phase and elimination phase of a tournament.
 * It displays group stage matches, final standings, pot assignments for elimination rounds, and the results of the knockout stages including quarterfinals, semifinals, finals, and the bronze match.
 *
 * @param {object} groupResults - An object where keys are group names and values are arrays of match results for that group.
 * Each match result is an object with `team1`, `team2`, `score1`, and `score2` properties.
 * @param {object} rankings - An object where keys are group names and values are arrays of team objects sorted by their final standings.
 * Each team object contains properties such as `Team`, `points`, `scored`, `allowed`, `wins`, and `losses`.
 * @param {object} eliminationResults - An object containing the results of the elimination rounds.
 *   - `quarterfinals`: An array of objects where each object contains a `match` array with two team objects and a `result` object with `team1` and `team2` scores.
 *   - `semifinals`: An array of objects similar to `quarterfinals`.
 *   - `finals`: An array of objects similar to `quarterfinals`.
 *   - `bronze`: An array of objects similar to `quarterfinals`.
 * @param {Array<object>} rankedTeams - An array of team objects representing the teams ranked for elimination rounds.
 * Each team object contains a `Team` property representing the team's name.
 * @returns {void} Outputs the tournament results to the console.
 */
const outputResults = (groupResults, rankings, eliminationResults, rankedTeams) => {
  const outputGroupMatch = (match) => {
    console.log(`${' '.repeat(8)}${match.team1} - ${match.team2} (${match.score1}:${match.score2})`);
  }

  for (let round = 0; round < 3; round++) {
    console.log(`Grupna faza - ${'I'.repeat(round + 1)} kolo`);

    for (const [group, resultsForGroup] of Object.entries(groupResults)) {
      console.log(`    Grupa ${group}:`);
      outputGroupMatch(resultsForGroup[2*round]);
      outputGroupMatch(resultsForGroup[2*round + 1]);
    };
  }

  console.log('\nKonačan plasman u grupama:');
  for (const group in rankings) {
    console.log(`\nGrupa ${group}`);
    console.log(`Država                   |  W |  L | Pts | Scored | Allowed | +/-`);
    console.log('-'.repeat(66));

    rankings[group].forEach((team, index) => {
      const pointDifference = team.scored - team.allowed;
      console.log(`${String(index + 1).padStart(2)}. ${team.Team.padEnd(20)} | ${String(team.wins).padStart(2)} | ${String(team.losses).padStart(2)} | ${String(team.points).padStart(3)} | ${String(team.scored).padStart(4)}   | ${String(team.allowed).padStart(4)}    | ${pointDifference >= 0 ? '+' : ''}${pointDifference}`);
    });
  }

  const pots = {
    'Šešir D': rankedTeams.slice(0, 2),
    'Šešir E': rankedTeams.slice(2, 4),
    'Šešir F': rankedTeams.slice(4, 6),
    'Šešir G': rankedTeams.slice(6, 8)
  };

  console.log('\nŠeširi:');
  for (const [pot, teams] of Object.entries(pots)) {
    console.log(`    ${pot}`);
    teams.forEach(team => console.log(`${' '.repeat(8)}${team.Team}`));
  }

  console.log('\nEliminaciona faza:');

  const stageNames = { quarterfinals: 'Četvrtfinale', semifinals: 'Polufinale', bronze: 'Utakmica za treće mesto', finals: 'Finale' }

  const logEliminationResult = (key, match) => {
    console.log(`    ${stageNames[key]}:`);
    eliminationResults[key].forEach(match => {
      console.log(`${' '.repeat(8)}${match.match[0].Team} - ${match.match[1].Team} (${match.result.team1}:${match.result.team2})`);
    });
  }

  logEliminationResult('quarterfinals')
  logEliminationResult('semifinals');
  logEliminationResult('finals');

  console.log('\nMedalje:');
  console.log(`  1. ${eliminationResults.finals[0].result.team1 > eliminationResults.finals[0].result.team2
    ? eliminationResults.finals[0].match[0].Team
    : eliminationResults.finals[0].match[1].Team}`);
  console.log(`  2. ${eliminationResults.finals[0].result.team1 > eliminationResults.finals[0].result.team2
    ? eliminationResults.finals[0].match[1].Team
    : eliminationResults.finals[0].match[0].Team}`);
  console.log(`  3. ${eliminationResults.bronze[0].result.team1 > eliminationResults.bronze[0].result.team2
    ? eliminationResults.bronze[0].match[0].Team
    : eliminationResults.bronze[0].match[1].Team}`);
}

export default outputResults;
