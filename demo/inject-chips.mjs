import fs from 'node:fs';

const dir = '/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad';
let body = fs.readFileSync(`${dir}/body.html`, 'utf8');
const tokensFull = JSON.parse(fs.readFileSync(`${dir}/tokens-full.json`, 'utf8'));
const wordmarkSvg = fs.readFileSync(`${dir}/vercel-wordmark.svg`, 'utf8').trim();
const logoSvg = fs.readFileSync(`${dir}/vercel-logo.svg`, 'utf8').trim();

let chipCount = 0;

// Inline token-name chips: <code>--vbg-x</code> -> append a swatch chip when
// the token resolves to a color. Non-color tokens (spacing, type, weight,
// leading, radius) get nothing, per spec.
body = body.replace(/<code>--vbg-([a-z0-9-]+)<\/code>/g, (match, name) => {
  const t = tokensFull[name];
  if (!t || !t.isColor) return match;
  chipCount++;
  return `${match}<span class="lens-chip" aria-hidden="true" style="--sw-light:${t.light};--sw-dark:${t.dark}" title="--vbg-${name}"></span>`;
});

// Inline asset previews beside the two SVG source URLs the doc references.
body = body.replace(
  /(<code>https:\/\/py8fhxnkzwtsqdo9\.public\.blob\.vercel-storage\.com\/p\/vercel-wordmark\.svg<\/code>)/,
  `$1<span class="lens-chip lens-asset-chip" aria-hidden="true">${wordmarkSvg.replace('<svg ', '<svg class="lens-asset-chip-svg" ')}</span>`
);
body = body.replace(
  /(<code>https:\/\/py8fhxnkzwtsqdo9\.public\.blob\.vercel-storage\.com\/p\/vercel-logo\.svg<\/code>)/,
  `$1<span class="lens-chip lens-asset-chip" aria-hidden="true">${logoSvg.replace('<svg ', '<svg class="lens-asset-chip-svg" ')}</span>`
);

fs.writeFileSync(`${dir}/body-with-chips.html`, body);
console.log('inline color chips inserted:', chipCount, '(+2 asset preview chips)');
