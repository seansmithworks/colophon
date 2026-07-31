import fs from 'node:fs';

const src = fs.readFileSync('/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad/source.md', 'utf8');

// split frontmatter
const fmMatch = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const fm = fmMatch[1];
const body = fmMatch[2];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  s = escapeHtml(s);
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

const lines = body.split('\n');
let out = [];
let i = 0;
let blockId = 0;

// body.split('\n')[0] is source.md line 5 (the blank line right after the
// closing frontmatter "---"), so array index -> source line number is +5.
const LINE_OFFSET = 5;
function srcLine(idx) { return idx + LINE_OFFSET; }
function lineAttr(start, end) {
  return start === end ? `data-lines="${start}"` : `data-lines="${start}-${end}"`;
}

function nextId(prefix) {
  blockId++;
  return `${prefix}-${blockId}`;
}

while (i < lines.length) {
  let line = lines[i];

  if (line.trim() === '') { i++; continue; }

  // code fence
  if (line.startsWith('```')) {
    const lang = line.slice(3).trim();
    const fenceStart = srcLine(i);
    let codeLines = [];
    i++;
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    const fenceEnd = srcLine(i); // closing ``` line
    i++; // skip closing fence
    out.push(`<pre class="code-block" data-lang="${lang}" data-md-skip="true" ${lineAttr(fenceStart, fenceEnd)}><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    continue;
  }

  // headings
  let m;
  if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
    const level = m[1].length;
    const text = m[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ln = srcLine(i);
    out.push(`<h${level} id="${id}" data-block="true" ${lineAttr(ln, ln)}>${inline(text)}</h${level}>`);
    i++;
    continue;
  }

  // unordered list
  if (line.match(/^-\s+/)) {
    let items = [];
    while (i < lines.length && lines[i].match(/^-\s+/)) {
      const ln = srcLine(i);
      items.push({ text: lines[i].replace(/^-\s+/, ''), ln });
      i++;
    }
    out.push('<ul>' + items.map(it => `<li data-block="true" ${lineAttr(it.ln, it.ln)}>${inline(it.text)}</li>`).join('') + '</ul>');
    continue;
  }

  // ordered list
  if (line.match(/^\d+\.\s+/)) {
    let items = [];
    while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
      const ln = srcLine(i);
      items.push({ text: lines[i].replace(/^\d+\.\s+/, ''), ln });
      i++;
    }
    out.push('<ol>' + items.map(it => `<li data-block="true" ${lineAttr(it.ln, it.ln)}>${inline(it.text)}</li>`).join('') + '</ol>');
    continue;
  }

  // horizontal rule
  if (line.match(/^---+$/)) {
    out.push('<hr>');
    i++;
    continue;
  }

  // paragraph (collect until blank line, list, heading, fence)
  const paraStart = srcLine(i);
  let paraLines = [line];
  i++;
  while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^(#{1,4})\s+/) && !lines[i].startsWith('```') && !lines[i].match(/^-\s+/) && !lines[i].match(/^\d+\.\s+/) && !lines[i].match(/^---+$/)) {
    paraLines.push(lines[i]);
    i++;
  }
  const paraEnd = srcLine(i - 1);
  out.push(`<p data-block="true" ${lineAttr(paraStart, paraEnd)}>${inline(paraLines.join(' '))}</p>`);
}

fs.writeFileSync('/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad/body.html', out.join('\n\n'));

// word count of body text (strip html tags)
const plain = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#*`\[\]()>-]/g, ' ').replace(/\n/g, ' ');
const words = plain.split(/\s+/).filter(Boolean).length;
console.log('word count approx:', words);
console.log('frontmatter:', fm);
console.log('total source.md lines:', src.split('\n').length);
