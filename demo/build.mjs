import fs from 'node:fs';

const dir = '/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad';
const body = fs.readFileSync(`${dir}/body-with-chips.html`, 'utf8');
const lensHtml = fs.readFileSync(`${dir}/lens.html`, 'utf8');
const sourcePaneHtml = fs.readFileSync(`${dir}/source-pane.html`, 'utf8');

// strip the leading <h1> from body.html since the masthead renders the title;
// keep everything else exactly as produced by convert.mjs + inject-chips.mjs
const bodyWithoutH1 = body.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\n\n/, '');

const wordCount = 4796; // computed by convert.mjs from source body text
const readMinutes = Math.round(wordCount / 200);

const toc = [
  ['vercel-product-and-brand-context', 'Vercel product and brand context'],
  ['use-this-priority-order', 'Use this priority order'],
  ['integrate-with-the-caller-s-project', "Integrate with the caller's project"],
  ['work-in-four-passes', 'Work in four passes'],
  ['reject-generated-design-reflexes', 'Reject generated-design reflexes'],
  ['use-the-published-css-api', 'Use the published CSS API'],
  ['accessibility-and-responsive-behavior', 'Accessibility and responsive behavior'],
];

const tocHtml = toc.map(([id, label]) =>
  `<li><a href="#${id}" data-toc-link="${id}">${label}</a></li>`
).join('\n            ');

const html = `<!doctype html>
<html lang="en" data-variant="editorial" data-view="read">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MD Reader — Vercel brand guidelines</title>
<style>
${fs.readFileSync(`${dir}/style.css`, 'utf8')}
</style>
</head>
<body>

<div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progress-fill"></div></div>

<header class="topbar">
  <div class="topbar-inner">
    <div class="topbar-brand">
      <svg class="brand-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 12.5L8 2.5L14 12.5H2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>
      <span class="brand-name">MD Reader</span>
    </div>
    <div class="topbar-controls">
      <div class="view-toggle" id="view-toggle" role="group" aria-label="View">
        <button type="button" id="view-read" class="view-btn" data-view-btn="read" aria-pressed="true">Read</button>
        <button type="button" id="view-split" class="view-btn" data-view-btn="split" aria-pressed="false">Split</button>
      </div>
      <button type="button" id="lens-toggle" class="lens-toggle" aria-pressed="true" title="Toggle the Design Lens">
        <span>Lens</span>
      </button>
      <div class="variant-toggle" role="group" aria-label="Reading theme">
        <button type="button" id="variant-editorial" class="variant-btn" data-variant-btn="editorial" aria-pressed="true">Editorial</button>
        <button type="button" id="variant-system" class="variant-btn" data-variant-btn="system" aria-pressed="false">System</button>
      </div>
    </div>
  </div>
</header>

<div class="layout" id="layout">
  <aside class="source-pane" id="source-pane" aria-label="Raw markdown source">
    ${sourcePaneHtml}
  </aside>

  <nav class="toc" id="toc" aria-label="Table of contents">
    <div class="toc-inner">
      <p class="toc-label">Contents</p>
      <ol class="toc-list">
            ${tocHtml}
      </ol>
    </div>
  </nav>

  <main class="doc" id="doc">
    <section class="masthead" data-block="true" data-lines="1-4">
      <p class="masthead-source">vercel.com <span class="masthead-dot">·</span> markdown source</p>
      <h1 class="masthead-title">Vercel brand guidelines</h1>
      <p class="masthead-abstract">Design, build, or substantially improve an official Vercel-authored report website. Use for customer reports, proposals, briefs, benchmarks, comparisons, narrative data pages, pricing or ROI or performance calculators, and bespoke decision pages that need Vercel information architecture, Geist typography, data storytelling, responsive craft, and light and dark themes.</p>
      <p class="masthead-meta">${wordCount.toLocaleString()} words <span class="masthead-dot">·</span> ${readMinutes} min read <span class="masthead-dot">·</span> name: <code>vercel-brand-guidelines</code></p>
    </section>

    ${lensHtml}

    <article class="doc-body" id="doc-body">
${bodyWithoutH1}
    </article>
  </main>
</div>

<footer class="player" id="player">
  <div class="player-inner">
    <div class="player-transport">
      <button type="button" id="btn-prev" class="player-btn" aria-label="Previous paragraph" title="Previous paragraph">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="3" width="1.4" height="10" fill="currentColor"/><path d="M13 3.5L5.5 8L13 12.5V3.5Z" fill="currentColor"/></svg>
      </button>
      <button type="button" id="btn-playpause" class="player-btn player-btn-primary" aria-label="Play" aria-pressed="false" title="Play">
        <svg id="icon-play" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5L13.5 8L4 13.5V2.5Z" fill="currentColor"/></svg>
        <svg id="icon-pause" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="display:none"><rect x="3.5" y="2.5" width="3" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" fill="currentColor"/></svg>
      </button>
      <button type="button" id="btn-next" class="player-btn" aria-label="Next paragraph" title="Next paragraph">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="11.6" y="3" width="1.4" height="10" fill="currentColor"/><path d="M3 3.5L10.5 8L3 12.5V3.5Z" fill="currentColor"/></svg>
      </button>
    </div>

    <div class="player-status">
      <p class="player-now" id="player-now">Voiceover ready</p>
    </div>

    <div class="player-settings">
      <label class="player-field">
        <span class="player-field-label">Voice</span>
        <select id="voice-select" class="player-select"></select>
      </label>
      <label class="player-field">
        <span class="player-field-label">Speed</span>
        <select id="speed-select" class="player-select">
          <option value="0.8">0.8×</option>
          <option value="1" selected>1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
        </select>
      </label>
    </div>
  </div>
</footer>

<script>
${fs.readFileSync(`${dir}/app.js`, 'utf8')}
</script>
</body>
</html>
`;

fs.writeFileSync('/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad/md-reader-demo.html', html);
console.log('written', html.length, 'bytes');
