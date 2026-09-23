// domTranslationGuard.ts — the documented mitigation for React plus browser
// translation (facebook/react issue 11538). Chrome and Safari auto-translate
// rewrite text nodes IN PLACE, moving them out from under the nodes React
// still thinks it owns; React's next removeChild/insertBefore then targets a
// node that is no longer where it left it, and the page hard-crashes with
// "Failed to execute 'removeChild' on 'Node'" (or 'insertBefore', or Safari's
// "The object can not be found here."). crash_alerts holds ~50 of these since
// 20 Sep, all on translated pages of international conferences.
//
// This is NOT fixed with translate="no": international delegates rely on
// translation. Instead, DOM_TRANSLATION_GUARD patches the two mutation methods
// so a call that would otherwise throw because the browser moved the node
// becomes a harmless no-op (removeChild) or falls back to append
// (insertBefore). It changes behaviour ONLY in the case that would otherwise
// crash the page; every normal removeChild/insertBefore call is untouched.

export const DOM_TRANSLATION_GUARD = `
(function () {
  if (typeof Node !== 'function' || !Node.prototype) return;
  if (window.__gvDomGuard) return;
  window.__gvDomGuard = true;

  var origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      console.warn('[dom-guard] removeChild skipped: node moved by page translation');
      return child;
    }
    return origRemoveChild.apply(this, arguments);
  };

  var origInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[dom-guard] insertBefore fell back to append: node moved by page translation');
      return origInsertBefore.call(this, newNode, null);
    }
    return origInsertBefore.apply(this, arguments);
  };
})();
`;
