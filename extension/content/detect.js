// Colophon — detector (content script)
//
// Runs on every page matching the manifest's markdown URL patterns. It does
// NOT render anything. It only decides whether this page is Chrome's native
// plain-text/markdown viewer (a page whose entire body is a single <pre>)
// and, if so, stashes the verbatim source text for the action click handler
// to pick up later. We never refetch the URL — the <pre> textContent IS the
// raw bytes Chrome already downloaded.
(function () {
  "use strict";

  function detect() {
    var ct = document.contentType;
    if (ct !== "text/markdown" && ct !== "text/plain") return null;

    var body = document.body;
    if (!body) return null;

    var children = Array.prototype.filter.call(body.children, function (el) {
      return el.tagName !== "SCRIPT" && el.tagName !== "STYLE";
    });
    if (children.length !== 1 || children[0].tagName !== "PRE") return null;

    return children[0];
  }

  var pre = detect();
  window.__colophonEligible = !!pre;
  window.__colophonRawText = pre ? pre.textContent : null;
})();
