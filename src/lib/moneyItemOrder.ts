// One order for every list of money items a person reads (owner, 10 Nov 2026).
// Delegate Tickets are all the same ticket; their numbers only exist to keep
// them tidy, so every list shows them in number order ("Delegate Ticket 1, 2,
// 3..."), never in the random order they were created or paid. Display only:
// never use this to change what is sent to a server or which ids are ticked.
//
// Groups, in order:
//   0 Delegate Ticket N (or kind 'pledge_spot'), by N
//   1 Advisor Ticket N (or kind 'advisor_spot'), by N
//   2 any other "... Ticket N", by N
//   3 the registration / application fee (kind 'app_fee')
//   4 role fees and everything else
//   5 add-ons (kind 'addon')
// Inside a group with no number: alphabetical, numbers read as numbers.

type Item = { label?: string | null; kind?: string | null };

function ticketNumber(label: string, re: RegExp): number | null {
  const m = re.exec(label);
  return m ? Number(m[1]) : null;
}

export function moneyItemGroup(label: string, kind?: string | null): number {
  const l = (label ?? '').trim();
  if (/^Delegate Ticket\b/i.test(l) || kind === 'pledge_spot') return 0;
  if (/^Advisor Ticket\b/i.test(l) || kind === 'advisor_spot') return 1;
  if (/\bTicket\s+\d+/i.test(l)) return 2;
  if (kind === 'app_fee' || /^(Registration Fee|Application fee)/i.test(l)) return 3;
  if (kind === 'addon') return 5;
  return 4;
}

function numberIn(label: string, group: number): number | null {
  if (group === 0) return ticketNumber(label, /^Delegate Ticket\s+(\d+)/i);
  if (group === 1) return ticketNumber(label, /^Advisor Ticket\s+(\d+)/i);
  if (group === 2) return ticketNumber(label, /\bTicket\s+(\d+)/i);
  return null;
}

export function compareMoneyItems(a: Item, b: Item): number {
  const la = (a.label ?? '').trim();
  const lb = (b.label ?? '').trim();
  const ga = moneyItemGroup(la, a.kind);
  const gb = moneyItemGroup(lb, b.kind);
  if (ga !== gb) return ga - gb;
  const na = numberIn(la, ga);
  const nb = numberIn(lb, gb);
  if (na !== null || nb !== null) {
    // A ticket with no number goes after the numbered ones.
    if (na === null) return 1;
    if (nb === null) return -1;
    if (na !== nb) return na - nb;
  }
  return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'base' });
}
