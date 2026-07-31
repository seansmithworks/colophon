// MD Reader — runtime Design Lens (content script, no modules)
//
// Generalized port of demo/extract-tokens.mjs + demo/build-lens.mjs. Instead
// of knowing about Vercel's --vbg-* namespace, it scans whatever stylesheet
// the rendered document links (a markdown link ending in .css) for CSS
// custom properties, resolves var() chains and light-dark() pairs, and
// buckets them heuristically:
//   - color-looking values (hex/rgb/hsl/oklch/light-dark(...))  -> palette,
//     grouped by name prefix (e.g. "gray-100"/"gray-200" -> family "gray")
//   - length values (px/rem/em) whose name matches /type|font-size|text-/
//     -> type scale
//   - remaining length values -> spacing bars
// If the document links no stylesheet, or the stylesheet defines no custom
// properties, the Lens simply does not appear — the reader still works.
window.MDReaderLens = (function () {
  "use strict";

  function fetchViaBackground(url) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(
        { type: "MD_READER_FETCH", url: url },
        function (res) {
          if (chrome.runtime.lastError || !res || !res.ok) {
            resolve(null);
            return;
          }
          resolve(res.text);
        },
      );
    });
  }

  function resolveUrl(href) {
    try {
      return new URL(href, document.baseURI).href;
    } catch (e) {
      return null;
    }
  }

  // ---- token extraction ---------------------------------------------------
  var COLOR_RE =
    /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|light-dark\(|lab\(|lch\(|[a-z]+)$/i;
  var NAMED_COLORS =
    /^(black|white|red|blue|green|gray|grey|transparent|currentcolor)$/i;

  function looksLikeColor(value) {
    var v = value.trim();
    if (/^(#[0-9a-fA-F]{3,8})$/.test(v)) return true;
    if (/^(rgba?|hsla?|oklch|oklab|lab|lch|light-dark|color)\(/i.test(v))
      return true;
    if (NAMED_COLORS.test(v)) return true;
    return false;
  }

  function looksLikeLength(value) {
    return /^-?\d*\.?\d+(px|rem|em|ch|vh|vw)$/.test(value.trim());
  }

  function splitLightDark(value) {
    var m = value.match(/^light-dark\((.+),\s*(.+)\)$/);
    if (m) return { light: m[1].trim(), dark: m[2].trim() };
    return { light: value.trim(), dark: value.trim() };
  }

  function extractTokens(cssText) {
    var defs = {};
    var order = [];
    // Strip comments so /* ... */ can't hide a fake declaration.
    var clean = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    var re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g;
    var m;
    while ((m = re.exec(clean))) {
      var name = m[1];
      if (!(name in defs)) order.push(name);
      defs[name] = m[2].trim();
    }

    function resolve(name, seen) {
      seen = seen || {};
      if (seen[name]) return defs[name] || "";
      seen[name] = true;
      var value = defs[name];
      if (value === undefined) return "";
      var out = value;
      var varRe = /var\((--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\)/g;
      var vm;
      var guard = 0;
      while ((vm = varRe.exec(value)) && guard++ < 25) {
        var refName = vm[1];
        var fallback = vm[2];
        var refValue =
          defs[refName] !== undefined ? resolve(refName, seen) : fallback || "";
        out = out.split(vm[0]).join(refValue);
      }
      return out;
    }

    var tokens = order.map(function (name) {
      var resolved = resolve(name, {});
      var isColor = looksLikeColor(resolved) || /light-dark\(/.test(resolved);
      var isLength = !isColor && looksLikeLength(resolved);
      var entry = {
        name: name,
        raw: defs[name],
        resolved: resolved,
        isColor: isColor,
        isLength: isLength,
      };
      if (isColor) {
        var ld = splitLightDark(resolved);
        entry.light = ld.light;
        entry.dark = ld.dark;
      }
      return entry;
    });

    return tokens;
  }

  function familyOf(tokenName) {
    // "--gray-100" -> "gray", "--vbg-color-info" -> "vbg-color", "--radius" -> "radius"
    var base = tokenName.replace(/^--/, "");
    var parts = base.split("-");
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
      parts = parts.slice(0, -1);
    }
    return parts.join("-") || base;
  }

  function buildLensModel(tokens, stylesheetLabel) {
    var colorTokens = tokens.filter(function (t) {
      return t.isColor;
    });
    var lengthTokens = tokens.filter(function (t) {
      return t.isLength;
    });

    var typeTokens = lengthTokens.filter(function (t) {
      return /type|font-size|text-/i.test(t.name);
    });
    var spaceTokens = lengthTokens.filter(function (t) {
      return typeTokens.indexOf(t) === -1;
    });

    var families = {};
    colorTokens.forEach(function (t) {
      var fam = familyOf(t.name);
      if (!families[fam]) families[fam] = [];
      families[fam].push(t);
    });
    var paletteGroups = Object.keys(families)
      .sort()
      .map(function (fam) {
        return { label: fam, swatches: families[fam] };
      });

    return {
      stylesheetLabel: stylesheetLabel,
      totalTokenCount: tokens.length,
      extractedCount: colorTokens.length + lengthTokens.length,
      palette: paletteGroups,
      typeTokens: typeTokens,
      spaceTokens: spaceTokens,
    };
  }

  // ---- DOM build ------------------------------------------------------------
  function swatchHtml(t) {
    return (
      '<div class="lens-swatch">' +
      '<span class="lens-swatch-box" style="--sw-light:' +
      t.light.replace(/"/g, "") +
      ";--sw-dark:" +
      t.dark.replace(/"/g, "") +
      '"></span>' +
      '<span class="lens-swatch-name">' +
      window.MDReaderParser.escapeHtml(t.name.replace(/^--/, "")) +
      "</span></div>"
    );
  }

  function buildLensHtml(model, assetPreviews) {
    if (!model || model.extractedCount === 0) return "";

    var paletteHtml = model.palette
      .map(function (group) {
        return (
          '<div class="lens-palette-group"><p class="lens-group-label">' +
          window.MDReaderParser.escapeHtml(group.label) +
          '</p><div class="lens-swatch-row">' +
          group.swatches.map(swatchHtml).join("") +
          "</div></div>"
        );
      })
      .join("");

    var typeHtml = model.typeTokens
      .map(function (t) {
        return (
          '<div class="lens-type-row"><span class="lens-type-role">' +
          window.MDReaderParser.escapeHtml(t.name.replace(/^--/, "")) +
          '</span><span class="lens-type-specimen" style="font-size:' +
          t.resolved +
          '">Set the reader\'s question</span><span class="lens-type-meta">' +
          window.MDReaderParser.escapeHtml(t.resolved) +
          "</span></div>"
        );
      })
      .join("");

    var spaceHtml = model.spaceTokens
      .map(function (t) {
        return (
          '<div class="lens-space-row"><span class="lens-space-label">' +
          window.MDReaderParser.escapeHtml(t.name.replace(/^--/, "")) +
          '</span><span class="lens-space-bar" style="width:' +
          t.resolved +
          '"></span><span class="lens-space-value">' +
          window.MDReaderParser.escapeHtml(t.resolved) +
          "</span></div>"
        );
      })
      .join("");

    var assetsHtml = "";
    if (assetPreviews && assetPreviews.length) {
      assetsHtml =
        '<section class="lens-section"><h5 class="lens-heading">Assets</h5><div class="lens-asset-row">' +
        assetPreviews
          .map(function (a) {
            return (
              '<div class="lens-asset-mount"><img class="lens-asset-svg" src="' +
              a.dataUri +
              '" alt="' +
              window.MDReaderParser.escapeHtml(a.name) +
              '"></div>'
            );
          })
          .join("") +
        "</div></section>";
    }

    return (
      '<details class="lens" id="design-lens" open><summary class="lens-summary">' +
      '<span class="lens-summary-title">Design Lens</span>' +
      '<span class="lens-summary-meta">extracted from ' +
      window.MDReaderParser.escapeHtml(model.stylesheetLabel) +
      " &middot; " +
      model.extractedCount +
      ' tokens</span></summary><div class="lens-body">' +
      '<p class="lens-disclosure">Derived content, not part of the source document. Visualizes the design tokens the linked stylesheet defines.</p>' +
      (model.palette.length
        ? '<section class="lens-section"><h5 class="lens-heading">Palette</h5><div class="lens-palette">' +
          paletteHtml +
          "</div></section>"
        : "") +
      (model.typeTokens.length
        ? '<section class="lens-section"><h5 class="lens-heading">Type scale</h5><div class="lens-type-list">' +
          typeHtml +
          "</div></section>"
        : "") +
      (model.spaceTokens.length
        ? '<section class="lens-section"><h5 class="lens-heading">Spacing</h5><div class="lens-space-list">' +
          spaceHtml +
          "</div></section>"
        : "") +
      assetsHtml +
      "</div></details>"
    );
  }

  // Converts fetched SVG text to a data: URI <img src> instead of inlining
  // raw markup, so a third-party document's linked SVG can never execute
  // script in the reader's DOM even if it isn't well-formed/trusted.
  function svgToDataUri(svgText) {
    try {
      var encoded = btoa(unescape(encodeURIComponent(svgText)));
      return "data:image/svg+xml;base64," + encoded;
    } catch (e) {
      return null;
    }
  }

  // Scans the already-rendered doc body for outbound .css / .svg links and
  // builds the Lens, fetching through the background worker (bypasses page
  // CSP). Returns "" (no lens) if nothing usable is found.
  function build(docBodyEl) {
    var links = Array.prototype.slice.call(
      docBodyEl.querySelectorAll("a[href]"),
    );
    var cssLink = links
      .map(function (a) {
        return a.getAttribute("href");
      })
      .find(function (href) {
        return /\.css(\?.*)?$/i.test(href);
      });
    var svgLinks = links
      .map(function (a) {
        return a.getAttribute("href");
      })
      .filter(function (href) {
        return /\.svg(\?.*)?$/i.test(href);
      })
      .slice(0, 4);

    if (!cssLink) return Promise.resolve("");

    var cssUrl = resolveUrl(cssLink);
    if (!cssUrl) return Promise.resolve("");

    return fetchViaBackground(cssUrl).then(function (cssText) {
      if (!cssText) return "";
      var tokens = extractTokens(cssText);
      if (!tokens.length) return "";

      var labelMatch = cssUrl.match(/\/([^\/?#]+)(?:[?#]|$)/);
      var label = labelMatch ? labelMatch[1] : cssUrl;
      var model = buildLensModel(tokens, label);
      if (model.extractedCount === 0) return "";

      var assetPromises = svgLinks.map(function (href) {
        var url = resolveUrl(href);
        if (!url) return Promise.resolve(null);
        return fetchViaBackground(url).then(function (svgText) {
          if (!svgText) return null;
          var dataUri = svgToDataUri(svgText);
          if (!dataUri) return null;
          var nameMatch = url.match(/\/([^\/?#]+)(?:[?#]|$)/);
          return { name: nameMatch ? nameMatch[1] : url, dataUri: dataUri };
        });
      });

      return Promise.all(assetPromises).then(function (assets) {
        var validAssets = assets.filter(Boolean);
        return buildLensHtml(model, validAssets);
      });
    });
  }

  return { build: build, extractTokens: extractTokens };
})();
