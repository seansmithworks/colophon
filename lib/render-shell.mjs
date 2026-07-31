// Builds the HTML page the CLI serves. It embeds the raw markdown source
// (and any resolved CSS text) as an inert JSON data island, then loads the
// exact same, unmodified reader files the extension uses
// (md-parser.js, lens.js, reader.js, reader.css) as static assets. The
// browser does all the actual parsing/rendering/lens work itself, from the
// same code, every time.
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderShellHtml({ mdRaw, filename, cssResult }) {
  const dataPayload = { rawText: mdRaw };
  if (cssResult) {
    dataPayload.css = { text: cssResult.text, label: cssResult.label };
  }

  // `</script` inside the raw markdown or CSS text must not be able to
  // close this data island early; escape it in the serialized JSON string,
  // not just in the source text, so it's safe regardless of where it
  // appears in the payload.
  const json = JSON.stringify(dataPayload).replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(filename)} — Colophon</title>
<link rel="stylesheet" href="/__colophon/reader.css">
</head>
<body>
<script type="application/json" id="colophon-data">${json}</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById("colophon-data").textContent);
  window.__colophonRawText = data.rawText;
  if (data.css) window.__colophonCssSource = data.css;
})();
</script>
<script src="/__colophon/md-parser.js"></script>
<script src="/__colophon/lens.js"></script>
<script src="/__colophon/reader.js"></script>
</body>
</html>
`;
}
