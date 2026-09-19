// Self-check for src/lib/committeeMatch.ts, the importer's committee resolver.
// Run: npx tsx scripts/check-committee-match.ts   (exits 1 on any failure)
//
// The committees below are KenyaMUN's as stored (18 Sep 2026), plus decoys that
// a loose matcher would wrongly land on.

import { matchCommitteeCell, type MatchableCommittee } from '../src/lib/committeeMatch';

const committees: MatchableCommittee[] = [
  { id: 'sochum', name: 'Social, Humanitarian and Cultural Committee', abbreviation: 'SOCHUM' },
  { id: 'unsc', name: 'UN Security Council', abbreviation: 'UNSC' },
  { id: 'unesco', name: 'UN Educational, Scientific & Cultural Org.', abbreviation: 'UNESCO' },
  { id: 'unw', name: 'UN Entity for Gender Equality (UN Women)', abbreviation: 'UNW' },
  { id: 'unhrc', name: 'UN Human Rights Council', abbreviation: 'UNHRC' },
  { id: 'disec', name: 'Disarmament and International Security Committee', abbreviation: 'DISEC' },
];

type Expect = string | 'none' | 'ambiguous';
const cases: [string, Expect][] = [
  // The four KenyaMUN strings that imported without allocations.
  ['Social, Cultural and Humanitarian Committee (SOCHUM)', 'sochum'],
  ['United Nations Security Council (UNSC)', 'unsc'],
  ['United Nations Educational, Scientific and Cultural Organization (UNESCO)', 'unesco'],
  ['United Nations Entity for Gender Equality and the Empowerment of Women (UN Women)', 'unw'],
  // UNHCR is not UNHRC, and must not be guessed.
  ['United Nations High Commissioner for Refugees (UNHCR)', 'none'],
  ['UNHCR', 'none'],
  // Plain forms keep working.
  ['SOCHUM', 'sochum'],
  ['sochum', 'sochum'],
  ['UN Security Council', 'unsc'],
  ['United Nations Security Council', 'unsc'],
  ['UN Women', 'unw'],
  ['UNW', 'unw'],
  ['UN Human Rights Council', 'unhrc'],
  ['United Nations Human Rights Council (UNHRC)', 'unhrc'],
  ['Social Cultural Humanitarian', 'sochum'],
  ['U.N.S.C.', 'unsc'],
  // A cell whose abbreviation and name disagree is never guessed.
  ['United Nations Security Council (DISEC)', 'ambiguous'],
  ['', 'none'],
  ['General Assembly', 'none'],
];

// KenyaMUN's real list (read from the database 18 Sep 2026). It has a UNHCR
// ("UN Refugee Agency"), so there the refugee string must land on UNHCR.
const kenyaMun: MatchableCommittee[] = [
  { id: 'ecosoc', name: 'Economic and Social Council', abbreviation: 'ECOSOC' },
  { id: 'sochum', name: 'Social, Humanitarian and Cultural Committee', abbreviation: 'SOCHUM' },
  { id: 'unesco', name: 'UN Educational, Scientific & Cultural Org.', abbreviation: 'UNESCO' },
  { id: 'unw', name: 'UN Entity for Gender Equality (UN Women)', abbreviation: 'UNW' },
  { id: 'unep', name: 'UN Environment Programme', abbreviation: 'UNEP' },
  { id: 'unhcr', name: 'UN Refugee Agency', abbreviation: 'UNHCR' },
  { id: 'unsc', name: 'UN Security Council', abbreviation: 'UNSC' },
];

// Two committees sharing an abbreviation: never pick one.
const dupes: MatchableCommittee[] = [
  { id: 'a', name: 'Historical Security Council', abbreviation: 'HSC' },
  { id: 'b', name: 'Human Security Committee', abbreviation: 'HSC' },
];

let failed = 0;
function check(list: MatchableCommittee[], cell: string, expect: Expect) {
  const r = matchCommitteeCell(list, cell);
  const got = r.kind === 'match' ? r.committee.id : r.kind;
  const ok = got === expect;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(cell)} -> ${got}${r.kind === 'match' ? ` (${r.via})` : ''}${ok ? '' : `, expected ${expect}`}`);
}
for (const [cell, expect] of cases) check(committees, cell, expect);
console.log('-- KenyaMUN committees as stored');
check(kenyaMun, 'Social, Cultural and Humanitarian Committee (SOCHUM)', 'sochum');
check(kenyaMun, 'United Nations Security Council (UNSC)', 'unsc');
check(kenyaMun, 'United Nations Educational, Scientific and Cultural Organization (UNESCO)', 'unesco');
check(kenyaMun, 'United Nations Entity for Gender Equality and the Empowerment of Women (UN Women)', 'unw');
check(kenyaMun, 'United Nations High Commissioner for Refugees (UNHCR)', 'unhcr');
check(kenyaMun, 'United Nations Environment Programme (UNEP)', 'unep');
console.log('-- shared abbreviation');
check(dupes, 'HSC', 'ambiguous');
check(dupes, 'Historical Security Council', 'a');

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nall committee-match cases passed');
