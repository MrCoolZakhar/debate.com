export const PREREG_REGISTERED_KEY = 'gavelling-prereg-status';

export function markPreRegistered() {
  try { localStorage.setItem(PREREG_REGISTERED_KEY, 'registered'); } catch {}
}

export function hasPreRegistered() {
  try { return localStorage.getItem(PREREG_REGISTERED_KEY) === 'registered'; } catch { return false; }
}
