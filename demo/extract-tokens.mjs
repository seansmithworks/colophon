import fs from 'node:fs';

const dir = '/private/tmp/claude-501/-Users-seansmith-Code-Career-ops/b15b82e3-6f09-4bbb-b0a7-0ebdea66641a/scratchpad';
const css = fs.readFileSync(`${dir}/vercel-brand.css`, 'utf8');

// Only look at the root token block (:where(.vbg-report) { ... first closing brace })
const rootMatch = css.match(/:where\(\.vbg-report\)\s*{([\s\S]*?)\n}/);
const rootBlock = rootMatch[1];

const defs = {};
const defRe = /--vbg-([a-z0-9-]+)\s*:\s*([^;]+);/g;
let m;
while ((m = defRe.exec(rootBlock))) {
  defs[m[1]] = m[2].trim();
}

const totalTokenCount = Object.keys(defs).length;

// Resolve var(--vbg-x) references recursively to their raw definition text.
function resolve(name, seen = new Set()) {
  if (seen.has(name)) return defs[name] || '';
  seen.add(name);
  let value = defs[name];
  if (value === undefined) return '';
  const varRe = /var\(--vbg-([a-z0-9-]+)\)/g;
  let out = value;
  let vm;
  while ((vm = varRe.exec(value))) {
    const refName = vm[1];
    const refResolved = resolve(refName, seen);
    out = out.replace(vm[0], refResolved);
  }
  return out;
}

function splitLightDark(resolved) {
  const ld = resolved.match(/^light-dark\((.+),\s*(.+)\)$/);
  if (ld) {
    return { light: ld[1].trim(), dark: ld[2].trim() };
  }
  return { light: resolved.trim(), dark: resolved.trim() };
}

function isColorValue(resolved) {
  return resolved.includes('oklch(');
}

const tokens = {};
for (const name of Object.keys(defs)) {
  const resolved = resolve(name);
  const color = isColorValue(resolved);
  tokens[name] = color
    ? { name: `--vbg-${name}`, isColor: true, ...splitLightDark(resolved) }
    : { name: `--vbg-${name}`, isColor: false, value: resolved.trim() };
}

// ---- categorize for the Design Lens ----
const paletteGroups = [
  { label: 'Background', keys: ['background-100', 'background-200'] },
  { label: 'Gray', keys: ['gray-100', 'gray-200', 'gray-300', 'gray-400', 'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900', 'gray-1000'] },
  { label: 'Gray alpha', keys: ['gray-alpha-100', 'gray-alpha-200', 'gray-alpha-300', 'gray-alpha-400', 'gray-alpha-500', 'gray-alpha-600', 'gray-alpha-700', 'gray-alpha-800', 'gray-alpha-900', 'gray-alpha-1000'] },
  { label: 'Blue', keys: ['blue-100', 'blue-400', 'blue-700', 'blue-900', 'blue-1000'] },
  { label: 'Amber', keys: ['amber-100', 'amber-400', 'amber-700', 'amber-900', 'amber-1000'] },
  { label: 'Red', keys: ['red-100', 'red-400', 'red-700', 'red-900', 'red-1000'] },
  { label: 'Green', keys: ['green-100', 'green-400', 'green-700', 'green-900', 'green-1000'] },
  { label: 'Semantic', keys: ['color-info', 'color-success', 'color-warning', 'color-error'] },
  { label: 'Chart series', keys: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6'] },
];

const paletteKeys = new Set(paletteGroups.flatMap((g) => g.keys));

const typeRoleKeys = ['display', 'page-title', 'title', 'section', 'subsection', 'lede', 'body', 'compact', 'label', 'metadata'];
const typeRoleWeight = {
  display: 'weight-heading',
  'page-title': 'weight-heading',
  title: 'weight-heading',
  section: 'weight-heading',
  subsection: 'weight-heading',
  lede: 'weight-regular',
  body: 'weight-regular',
  compact: 'weight-regular',
  label: 'weight-medium',
  metadata: 'weight-regular',
};
const typeRoleLeading = {
  display: 'leading-display',
  'page-title': 'leading-page-title',
  title: 'leading-title',
  section: 'leading-section',
  subsection: 'leading-subsection',
  lede: 'leading-lede',
  body: 'leading-body',
  compact: 'leading-compact',
  label: 'leading-caption',
  metadata: 'leading-caption',
};

const typeRoles = typeRoleKeys.map((k) => ({
  role: k,
  token: `--vbg-type-${k}`,
  size: tokens[`type-${k}`].value,
  weightToken: `--vbg-${typeRoleWeight[k]}`,
  weight: tokens[typeRoleWeight[k]].value,
  leadingToken: `--vbg-${typeRoleLeading[k]}`,
  leading: tokens[typeRoleLeading[k]].value,
}));

const typeKeysUsed = new Set([
  ...typeRoleKeys.map((k) => `type-${k}`),
  ...Object.values(typeRoleWeight),
  ...Object.values(typeRoleLeading),
]);

const spaceKeys = ['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-8', 'space-10', 'space-12', 'space-16'];
const spacing = spaceKeys.map((k) => ({ token: `--vbg-${k}`, value: tokens[k].value }));

const shapeKeys = ['radius-small', 'radius', 'control-height', 'control-height-touch'];
const shape = shapeKeys.map((k) => ({ token: `--vbg-${k}`, value: tokens[k].value }));

const usedKeys = new Set([...paletteKeys, ...typeKeysUsed, ...spaceKeys, ...shapeKeys]);
const excludedKeys = Object.keys(defs).filter((k) => !usedKeys.has(k));

const palette = paletteGroups.map((g) => ({
  label: g.label,
  swatches: g.keys.map((k) => tokens[k]),
}));

const output = {
  totalTokenCount,
  extractedCount: usedKeys.size,
  excludedKeys,
  palette,
  typeRoles,
  spacing,
  shape,
};

fs.writeFileSync(`${dir}/tokens.json`, JSON.stringify(output, null, 2));
console.log('total --vbg-* defined:', totalTokenCount);
console.log('extracted/visualized:', usedKeys.size);
console.log('excluded (non-visual or alias):', excludedKeys.length, excludedKeys);

// also export the full color-resolving map for the inline-chip pass
fs.writeFileSync(`${dir}/tokens-full.json`, JSON.stringify(tokens, null, 2));
