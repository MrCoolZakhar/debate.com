// Slurs and obscenities never appear in MUNillion (owner, 26 Nov 2026). The
// database is the real check (_munillion_is_blocked_text refuses, never saves
// and never emails them); this twin only keeps them off the placard while
// someone types. Change both together.

const PATTERN = new RegExp(
  '(^| )(' + [
    'n+i+gg+(a|ah|er|ers|as|az|uh)?s?', 'nigg\\w*', 'f+a+g+(s|gy)?', 'f+a+gg+o+t+s?', 'f+a+g+o+t+s?', 'k+i+k+e+s?', 'ch+i+n+k+s?',
    'sp+i+c+s?', 'g+oo+k+s?', 'w+e+t+b+a+c+k+s?', 'beaners?', 'rag ?heads?', 'towel ?heads?', 'pakis?', 'coons?', 'dykes?',
    'trann(y|ies)', 'retard(s|ed)?', 'c+u+n+t+s?', 'tw+a+t+s?', 'wh+o+r+e+s?', 'sl+u+t+s?', 'b+i+t+c+h(es)?', 'f+u+c+k\\w*',
    'motherf\\w*', 'sh+i+t+(s|ty|head)?', 'dickheads?', 'cocks?', 'cocksuck\\w*', 'puss(y|ies)', 'ass ?holes?', 'arse ?holes?',
    'wank(er|ers)?', 'jizz', 'cum(shot)?', 'porn\\w*', 'rapes?', 'rapist', 'nazi scum', 'heil hitler', 'kys', 'kill yourself',
  ].join('|') + ')( |$)',
);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', $: 's', '!': 'i', '5': 's' };

export function isBlockedText(text: string): boolean {
  const s = (text ?? '')
    .toLowerCase()
    .replace(/[0134@$!5]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, ' ');
  return PATTERN.test(s);
}
