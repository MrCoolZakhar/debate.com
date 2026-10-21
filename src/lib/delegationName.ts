// splitDelegationName: how a delegation's name is drawn on two rows (owner,
// 21 Oct 2026). Never cut: the main line and the small line together are the
// whole name, word for word.
//
//   * One or two words stay on one row ("Oxford MUN").
//   * A trailing "MUN Society", "MUN Club", "Model United Nations", "MUN",
//     "Society", "Club", "Association" (and the like) always goes to the small
//     line when there is a word before it ("University of Oxford" over "MUN
//     Society"). So does a trailing part in brackets ("(OUMUN)").
//   * Otherwise three or four words: the first two big, the rest small; longer
//     names split near the middle. A main line never ends on a joining word
//     ("of", "and", "the"): it moves to the small line.
//   * `long` says the main line is long enough to draw a font step smaller (one
//     long single word, or a long main line).
// Pure, no imports.

export interface DelegationNameParts {
  main: string;
  rest: string | null;
  long: boolean;
}

/** Trailing phrases that always go to the small line, longest first. */
const TRAILING: string[][] = [
  ['model', 'united', 'nations', 'society'],
  ['model', 'united', 'nations', 'club'],
  ['model', 'united', 'nations', 'association'],
  ['model', 'united', 'nations', 'team'],
  ['model', 'united', 'nations'],
  ['model', 'un', 'society'],
  ['model', 'un', 'club'],
  ['model', 'un'],
  ['un', 'society'],
  ['un', 'club'],
  ['un', 'association'],
  ['mun', 'society'],
  ['mun', 'club'],
  ['mun', 'association'],
  ['mun', 'team'],
  ['mun', 'delegation'],
  ['debate', 'society'],
  ['debating', 'society'],
  ['society'],
  ['club'],
  ['association'],
  ['mun'],
];

const JOINERS = new Set(['of', 'and', '&', 'the', 'for', 'de', 'du', 'des', 'la', 'le', 'di', 'del', 'da', 'at', 'in', 'y', 'e', 'und', 'a']);

/** A main line this long (characters) draws a font step smaller. */
const LONG_MAIN = 22;
/** One single word this long draws a font step smaller. */
const LONG_WORD = 14;

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}&]/gu, '');

export function splitDelegationName(name: string): DelegationNameParts {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim();
  const words = clean ? clean.split(' ') : [];
  const isLong = (main: string, count: number) =>
    count === 1 ? main.length > LONG_WORD : main.length > LONG_MAIN;

  if (words.length <= 2) return { main: clean, rest: null, long: isLong(clean, words.length) };

  let cut = -1;

  // A trailing part in brackets: "Oxford University (OUMUN)".
  const open = words.findIndex((w, i) => i > 0 && w.startsWith('('));
  if (open > 0 && words[words.length - 1].endsWith(')')) cut = open;

  // A trailing club word or phrase.
  if (cut < 0) {
    const lower = words.map(norm);
    for (const phrase of TRAILING) {
      const at = words.length - phrase.length;
      if (at < 1) continue;
      if (phrase.every((p, i) => lower[at + i] === p)) {
        // The phrase must END the name: "MUN Society of X" never matches.
        cut = at;
        break;
      }
    }
  }

  // No marker: three or four words, the first two big; longer, near the middle.
  if (cut < 0) cut = words.length <= 4 ? 2 : Math.ceil(words.length / 2);

  // A main line never ends on a joining word ("University of" over "Oxford").
  while (cut > 1 && JOINERS.has(norm(words[cut - 1]))) cut -= 1;

  const main = words.slice(0, cut).join(' ');
  const rest = words.slice(cut).join(' ');
  return { main, rest: rest || null, long: isLong(main, cut) };
}
