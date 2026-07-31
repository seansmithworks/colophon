import fs from 'node:fs';

const dir = '/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad';
const tokens = JSON.parse(fs.readFileSync(`${dir}/tokens.json`, 'utf8'));
const wordmarkSvg = fs.readFileSync(`${dir}/vercel-wordmark.svg`, 'utf8').trim();
const logoSvg = fs.readFileSync(`${dir}/vercel-logo.svg`, 'utf8').trim();

function swatch(t) {
  return `<div class="lens-swatch">
              <span class="lens-swatch-box" style="--sw-light:${t.light};--sw-dark:${t.dark}"></span>
              <span class="lens-swatch-name">${t.name.replace('--vbg-', '')}</span>
            </div>`;
}

const paletteHtml = tokens.palette.map((group) => `
        <div class="lens-palette-group">
          <p class="lens-group-label">${group.label}</p>
          <div class="lens-swatch-row">
            ${group.swatches.map(swatch).join('\n            ')}
          </div>
        </div>`).join('\n');

const typeHtml = tokens.typeRoles.map((r) => `
        <div class="lens-type-row">
          <span class="lens-type-role">${r.role}</span>
          <span class="lens-type-specimen" style="font-size:${r.size};font-weight:${r.weight};line-height:${r.leading}">Set the reader's question</span>
          <span class="lens-type-meta">${r.size} <span class="lens-dot">·</span> ${r.weight} <span class="lens-dot">·</span> ${r.leading}</span>
        </div>`).join('\n');

const spacingHtml = tokens.spacing.map((s) => `
        <div class="lens-space-row">
          <span class="lens-space-label">${s.token.replace('--vbg-', '')}</span>
          <span class="lens-space-bar" style="width:${s.value}"></span>
          <span class="lens-space-value">${s.value}</span>
        </div>`).join('\n');

const shapeByToken = Object.fromEntries(tokens.shape.map((s) => [s.token, s.value]));

const gridDiagram = `
        <div class="lens-grid-row">
          <div class="lens-grid-item">
            <p class="lens-grid-label">Desktop <span class="lens-dot">·</span> 12 cols</p>
            <div class="lens-grid-cols" style="--cols:12">${'<span></span>'.repeat(12)}</div>
          </div>
          <div class="lens-grid-item">
            <p class="lens-grid-label">Tablet <span class="lens-dot">·</span> 6 cols</p>
            <div class="lens-grid-cols" style="--cols:6">${'<span></span>'.repeat(6)}</div>
          </div>
          <div class="lens-grid-item">
            <p class="lens-grid-label">Mobile <span class="lens-dot">·</span> 4 cols</p>
            <div class="lens-grid-cols" style="--cols:4">${'<span></span>'.repeat(4)}</div>
          </div>
        </div>`;

const html = `<details class="lens" id="design-lens" open>
      <summary class="lens-summary">
        <span class="lens-summary-title">Design Lens</span>
        <span class="lens-summary-meta">extracted from vercel-brand.css <span class="lens-dot">·</span> ${tokens.extractedCount} tokens</span>
      </summary>

      <div class="lens-body">
        <p class="lens-disclosure">Derived content, not part of the source document. Visualizes the design tokens the linked stylesheet defines.</p>

        <section class="lens-section">
          <h5 class="lens-heading">Palette</h5>
          <p class="lens-caption">Each swatch shows its light value (top) and dark value (bottom) from the token's <code>light-dark()</code> pair.</p>
          <div class="lens-palette">${paletteHtml}
          </div>
        </section>

        <section class="lens-section">
          <h5 class="lens-heading">Type roles</h5>
          <p class="lens-caption">Rendered in the system sans stack — Geist is not loadable offline.</p>
          <div class="lens-type-list">${typeHtml}
          </div>
        </section>

        <section class="lens-section">
          <h5 class="lens-heading">Spacing scale</h5>
          <div class="lens-space-list">${spacingHtml}
          </div>
        </section>

        <section class="lens-section">
          <h5 class="lens-heading">Shape</h5>
          <div class="lens-shape-row">
            <div class="lens-shape-item">
              <div class="lens-shape-square" style="border-radius:${shapeByToken['--vbg-radius-small']}"></div>
              <span class="lens-shape-label">radius-small <span class="lens-dot">·</span> ${shapeByToken['--vbg-radius-small']}</span>
            </div>
            <div class="lens-shape-item">
              <div class="lens-shape-square" style="border-radius:${shapeByToken['--vbg-radius']}"></div>
              <span class="lens-shape-label">radius <span class="lens-dot">·</span> ${shapeByToken['--vbg-radius']}</span>
            </div>
            <div class="lens-shape-item">
              <div class="lens-shape-rect" style="height:${shapeByToken['--vbg-control-height']}"></div>
              <span class="lens-shape-label">control-height <span class="lens-dot">·</span> ${shapeByToken['--vbg-control-height']}</span>
            </div>
            <div class="lens-shape-item">
              <div class="lens-shape-rect" style="height:${shapeByToken['--vbg-control-height-touch']}"></div>
              <span class="lens-shape-label">control-height-touch <span class="lens-dot">·</span> ${shapeByToken['--vbg-control-height-touch']}</span>
            </div>
          </div>
        </section>

        <section class="lens-section">
          <h5 class="lens-heading">Grid</h5>
          <p class="lens-caption">12 columns desktop, 6 tablet, 4 mobile, as described in the doc's grid rules.</p>
          ${gridDiagram}
        </section>

        <section class="lens-section">
          <h5 class="lens-heading">Assets</h5>
          <p class="lens-caption">Inlined from the doc's wordmark and triangle URLs. Both use <code>currentColor</code>, so they follow the reader theme.</p>
          <div class="lens-asset-row">
            <div class="lens-asset-mount">${wordmarkSvg.replace('<svg ', '<svg class="lens-asset-svg lens-asset-wordmark" ')}</div>
            <div class="lens-asset-mount">${logoSvg.replace('<svg ', '<svg class="lens-asset-svg lens-asset-logo" ')}</div>
          </div>
        </section>
      </div>
    </details>`;

fs.writeFileSync(`${dir}/lens.html`, html);
console.log('lens.html written', html.length, 'bytes');
