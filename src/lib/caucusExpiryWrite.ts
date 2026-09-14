// R-6: the moderated-caucus auto-expiry as a CONDITIONAL write.
//
// The expiry effect on the chair page fires from local state. A Moderator laptop that slept
// through the end of a caucus (while another device started a new one) used to wake and
// write "caucus over, back to the GSL" unconditionally, wiping the new caucus and its queue.
// The write now ends the caucus only while the stored row is still the caucus the effect saw.
//
// The implementation lives in committeeService.ts beside `setPhaseAndCaucus`, so it shares
// its writeStatus keys: a real failure is retried and reported to the "Not saved" toast,
// a "no longer matches" skip is not. Re-exported here for existing imports.
export { endModeratedCaucusIfAnchorUnchanged } from './committeeService';
