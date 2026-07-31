import fs from 'node:fs';

const dir = '/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad';
const raw = fs.readFileSync(`${dir}/source.md`, 'utf8');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let lines = raw.split('\n');
// drop a single trailing empty element produced by the file's final newline
if (lines.length && lines[lines.length - 1] === '') lines.pop();

const rows = lines.map((text, idx) => {
  const n = idx + 1;
  const content = escapeHtml(text) || '&nbsp;';
  return `<div class="src-line" data-line="${n}"><span class="src-line-no">${n}</span><span class="src-line-text">${content}</span></div>`;
}).join('');

const html = `<pre class="source-pane-inner" id="source-pane-inner" aria-label="Raw markdown source">${rows}</pre>`;

fs.writeFileSync(`${dir}/source-pane.html`, html);
console.log('source-pane.html written, lines:', lines.length, 'bytes:', html.length);

// also bake the untouched raw markdown as inert text for reference / possible reuse
fs.writeFileSync(`${dir}/source-raw-escaped.txt`, escapeHtml(raw));
