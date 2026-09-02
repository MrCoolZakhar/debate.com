/**
 * Safe object names for Supabase Storage.
 *
 * Storage validates every key against a strict allowlist, roughly
 *
 *   /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/
 *
 * with an ASCII `\w`. Anything outside it is refused outright with
 * `StorageApiError: Invalid key`, and because that check happens server-side
 * the upload simply fails — there is no partial write to clean up, just a
 * person staring at an error.
 *
 * Four things people actually upload fall outside that set:
 *
 *   1. **macOS screenshots.** Recent macOS names them
 *      "Screenshot 2026-09-02 at 8.22.04 AM.png" where the space before AM is
 *      U+202F NARROW NO-BREAK SPACE, not a normal one. It is invisible, it
 *      survives every copy-paste, and it is the single most common file a
 *      person attaches as proof of payment. This is the one that blocked a
 *      real payer who had already sent their money.
 *   2. **Any non-ASCII name.** "Ödeme dekontu.png", "reçu.png", "भुगतान.png".
 *      A large share of this platform's users type in Turkish, Hindi, Spanish
 *      and French, so this is not an edge case.
 *   3. **Punctuation outside the list** — `#`, `[`, `]`, `%`, and friends.
 *   4. **Invisible formatting characters** generally, pasted in from documents
 *      and chat apps. The send-emails edge function had to learn the same
 *      lesson about email addresses; this is that bug wearing a different hat.
 *
 * The answer is not to widen what Storage accepts — we do not control it — but
 * to stop putting an untrusted string in the key at all. Every caller already
 * keeps the human-readable filename somewhere it belongs (a `file_name`
 * column, component state), so the key only has to be unique and legal.
 */

/** Codepoints that are invisible, survive copy-paste, and are not `\w`.
 *  Kept as codepoints rather than a character class so this file stays plain
 *  ASCII and cannot itself smuggle one in. */
const INVISIBLE = new Set<number>([
  0x00ad, 0x00a0,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
  0x2028, 0x2029,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x202f,
  0x205f, 0x3000,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
  0xfeff,
]);

/** Longest object name we will produce, extension included. Storage allows far
 *  more, but a 300-character key helps nobody and makes logs unreadable. */
const MAX_NAME = 80;

/**
 * A filename reduced to something Storage will always accept: ASCII letters,
 * digits, dot, dash and underscore. Accents are folded to their base letter
 * where Unicode knows how (ö → o, ç → c) rather than dropped, so a name stays
 * recognisable; anything with no ASCII equivalent becomes a dash.
 *
 * The extension is preserved separately, because it is the part that has to
 * survive intact for content-type sniffing and for the file to open.
 */
export function safeStorageName(filename: string): string {
  const raw = (filename ?? '').trim();

  // Split off a plausible extension before touching anything else.
  const dot = raw.lastIndexOf('.');
  const hasExt = dot > 0 && dot < raw.length - 1 && raw.length - dot <= 11;
  const stem = hasExt ? raw.slice(0, dot) : raw;
  const ext = hasExt ? raw.slice(dot + 1) : '';

  const clean = (s: string): string =>
    Array.from(
      // NFD splits "ö" into "o" + combining diaeresis, so stripping the
      // combining marks afterwards leaves the base letter behind.
      s.normalize('NFD'),
    )
      .filter((ch) => {
        const cp = ch.codePointAt(0)!;
        if (INVISIBLE.has(cp)) return false;
        // Combining diacritical marks, left over from the NFD split.
        if (cp >= 0x0300 && cp <= 0x036f) return false;
        return true;
      })
      .join('')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');

  const safeStem = clean(stem).slice(0, MAX_NAME) || 'file';
  const safeExt = clean(ext).toLowerCase();

  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

/**
 * A full object key: a caller-supplied prefix, a unique component, and the
 * sanitised filename. The prefix is trusted (it is built from ids we generate)
 * and is passed through untouched.
 */
export function safeStorageKey(prefix: string, unique: string, filename: string): string {
  const head = prefix.replace(/\/+$/, '');
  return `${head}/${unique}-${safeStorageName(filename)}`;
}
