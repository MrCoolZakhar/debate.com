// publicConferences.ts — which public conferences a DISCOVERY surface shows.
//
// `is_public` is the organiser's switch, and a handful of organisers flip it
// on a conference they made to try the product ("test mun", "TestMUN7").
// Those rows are real and stay reachable by their link, but they must not be
// advertised: not in the sitemap, not on /conferences/explore, not on the
// homepage, not on a country hub, not on /organisers. Every one of those
// surfaces filters through `isListedConference`, so the rule lives here once.
//
// The rule, deliberately narrow so a real conference is never hidden:
//   - `is_demo` is true, or
//   - the slug or the full name has a word that STARTS with "test"
//     ("test-mun-2yfzg", "TestMUN7", "Test Conference"), or
//   - a whole word "qa" or "demo" ("QA MUN", "demo-conference").
// "Contest", "Protest", "Attestation" do not match (the word must start with
// "test"). Checked on 23 Sep 2026 against every public conference: it hides
// exactly test-mun-2yfzg and testmun7-fqrry.

export interface ListableConference {
  slug?: string | null;
  full_name?: string | null;
  is_demo?: boolean | null;
}

const TEST_WORD = /(^|[^a-z0-9])(test|qa(?![a-z])|demo(?![a-z]))/i;

/** True for a conference that exists to try the product, not to be attended. */
export function isTestConference(c: ListableConference): boolean {
  if (c.is_demo) return true;
  return TEST_WORD.test(c.slug ?? '') || TEST_WORD.test(c.full_name ?? '');
}

/** A public conference that a discovery surface may list. */
export function isListedConference(c: ListableConference): boolean {
  return !!c.slug && !isTestConference(c);
}
