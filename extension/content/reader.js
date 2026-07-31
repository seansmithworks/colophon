// Colophon — main content script (no modules)
//
// Orchestrates: stash the original page, parse the raw markdown, build the
// reader DOM, wire up the view toggle/shortcut, TOC, and source<->render
// hover/click sync. Ported from demo/build.mjs + demo/app.js, generalized
// to run at click-time against whatever markdown document.detect.js found,
// instead of one baked Vercel file.
(function () {
  "use strict";

  // Re-clicking the toolbar action re-injects this file. If we already
  // bootstrapped on this page, just flip visibility instead of rebuilding.
  if (window.__colophonToggle) {
    window.__colophonToggle();
    return;
  }

  var P = window.ColophonParser;
  var escapeHtml = P.escapeHtml;

  function filenameFromUrl() {
    var path = location.pathname.split("/").filter(Boolean);
    var last = path.length ? path[path.length - 1] : location.hostname;
    return last.replace(/\.(md|markdown)$/i, "").replace(/[-_]+/g, " ");
  }

  function humanize(s) {
    return String(s)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function wordCountOf(raw) {
    var plain = raw
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*`[\]()>-]/g, " ")
      .replace(/\n/g, " ");
    return plain.split(/\s+/).filter(Boolean).length;
  }

  function buildSourcePaneHtml(raw) {
    var lines = raw.split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    var rows = lines
      .map(function (text, idx) {
        var n = idx + 1;
        var content = escapeHtml(text) || "&nbsp;";
        return (
          '<div class="src-line" data-line="' +
          n +
          '"><span class="src-line-no">' +
          n +
          '</span><span class="src-line-text">' +
          content +
          "</span></div>"
        );
      })
      .join("");
    return (
      '<pre class="source-pane-inner" aria-label="Raw markdown source">' +
      rows +
      "</pre>"
    );
  }

  function buildReaderRoot(parsed, raw) {
    var titleSource =
      (parsed.frontmatter &&
        (parsed.frontmatter.title || parsed.frontmatter.name)) ||
      parsed.firstH1 ||
      humanize(filenameFromUrl());
    var description = parsed.frontmatter && parsed.frontmatter.description;
    var wordCount = wordCountOf(raw);
    var readMinutes = Math.max(1, Math.round(wordCount / 200));
    var sourceLabel =
      location.protocol === "file:" ? "local file" : location.hostname;

    var tocItems = parsed.headings.filter(function (h) {
      return h.level === 2;
    });
    if (!tocItems.length) {
      tocItems = parsed.headings
        .filter(function (h) {
          return h.level === 1;
        })
        .slice(1);
    }
    var tocHtml = tocItems
      .map(function (h) {
        return (
          '<li><a href="#' +
          h.id +
          '" data-toc-link="' +
          h.id +
          '">' +
          escapeHtml(h.text) +
          "</a></li>"
        );
      })
      .join("");

    var root = document.createElement("div");
    root.id = "colophon-root";
    root.innerHTML =
      '<div class="progress-track" aria-hidden="true"><div class="progress-fill" id="colophon-progress-fill"></div></div>' +
      '<header class="topbar"><div class="topbar-inner">' +
      '<div class="topbar-brand"><svg class="brand-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 12.5L8 2.5L14 12.5H2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg><span class="brand-name">Colophon</span></div>' +
      '<div class="topbar-controls">' +
      '<div class="view-toggle" id="colophon-view-toggle" role="group" aria-label="View">' +
      '<button type="button" class="view-btn" data-view-btn="read" aria-pressed="true" title="Read (v)">Read</button>' +
      '<button type="button" class="view-btn" data-view-btn="split" aria-pressed="false" title="Split (v)">Split</button></div>' +
      '<button type="button" id="colophon-close" class="lens-toggle" title="Restore original page">&times;</button>' +
      "</div></div></header>" +
      '<div class="layout" id="colophon-layout">' +
      '<aside class="source-pane" id="colophon-source-pane" aria-label="Raw markdown source">' +
      buildSourcePaneHtml(raw) +
      "</aside>" +
      '<nav class="toc" id="colophon-toc" aria-label="Table of contents"><div class="toc-inner"><p class="toc-label">Contents</p><ol class="toc-list">' +
      tocHtml +
      "</ol></div></nav>" +
      '<main class="doc" id="colophon-doc">' +
      '<section class="masthead" data-lines="1-' +
      (parsed.bodyStartLine - 1 || 1) +
      '">' +
      '<p class="masthead-source">' +
      escapeHtml(sourceLabel) +
      ' <span class="masthead-dot">&middot;</span> markdown source</p>' +
      '<h1 class="masthead-title">' +
      escapeHtml(humanize(titleSource)) +
      "</h1>" +
      (description
        ? '<p class="masthead-abstract">' + escapeHtml(description) + "</p>"
        : "") +
      '<p class="masthead-meta">' +
      wordCount.toLocaleString() +
      ' words <span class="masthead-dot">&middot;</span> ' +
      readMinutes +
      " min read</p>" +
      "</section>" +
      '<div id="colophon-lens-mount"></div>' +
      '<article class="doc-body" id="colophon-doc-body">' +
      parsed.bodyHtml +
      "</article>" +
      "</main></div>";

    return root;
  }

  // ---------------------------------------------------------------------
  function wireReaderBehavior(root, parsed, raw, restoreFn) {
    var htmlEl = document.documentElement;
    var docPane = root.querySelector("#colophon-doc");

    // progress bar
    var progressFill = root.querySelector("#colophon-progress-fill");
    function updateProgress() {
      var ratio;
      if (htmlEl.getAttribute("data-colophon-view") === "split" && docPane) {
        var maxSplit = docPane.scrollHeight - docPane.clientHeight;
        ratio =
          maxSplit > 0
            ? Math.min(1, Math.max(0, docPane.scrollTop / maxSplit))
            : 0;
      } else {
        var max =
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight;
        ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      }
      progressFill.style.transform = "scaleX(" + ratio + ")";
    }
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    if (docPane)
      docPane.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    // view switcher (Read / Split). VIEWS is an ordered cycle so the `v`
    // shortcut and a future third view (e.g. a Lens-only tab) both just
    // walk the array, no boolean flip to rework.
    var VIEWS = ["read", "split"];
    var viewBtns = root.querySelectorAll("[data-view-btn]");
    var mqSplitAllowed = window.matchMedia("(min-width: 1001px)");
    function setView(name) {
      if (name === "split" && !mqSplitAllowed.matches) name = "read";
      htmlEl.setAttribute("data-colophon-view", name);
      viewBtns.forEach(function (btn) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-view-btn") === name ? "true" : "false",
        );
      });
      updateProgress();
    }
    viewBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setView(btn.getAttribute("data-view-btn"));
      });
    });
    if (mqSplitAllowed.addEventListener) {
      mqSplitAllowed.addEventListener("change", function (e) {
        if (!e.matches && htmlEl.getAttribute("data-colophon-view") === "split")
          setView("read");
      });
    }
    setView("read");

    // `v` cycles Read <-> Split. No-ops while typing in a form control, and
    // no-ops below the split threshold rather than switching to a view
    // that's hidden at this width.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "v" && e.key !== "V") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (root.style.display === "none") return;
      var active = document.activeElement;
      if (active) {
        var tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "SELECT" ||
          tag === "TEXTAREA" ||
          active.isContentEditable
        )
          return;
      }
      if (!mqSplitAllowed.matches) return;
      var current = htmlEl.getAttribute("data-colophon-view");
      var idx = VIEWS.indexOf(current);
      if (idx === -1) idx = 0;
      setView(VIEWS[(idx + 1) % VIEWS.length]);
    });

    // close / restore original page
    root
      .querySelector("#colophon-close")
      .addEventListener("click", function () {
        restoreFn();
      });

    // ---- source <-> render correspondence (DevTools-style sync) --------
    var sourcePaneEl = root.querySelector("#colophon-source-pane");
    var blockEls = Array.prototype.slice.call(
      docPane.querySelectorAll("[data-lines]"),
    );
    var srcLineEls = {};
    Array.prototype.slice
      .call(sourcePaneEl.querySelectorAll(".src-line"))
      .forEach(function (el) {
        srcLineEls[el.getAttribute("data-line")] = el;
      });

    function parseLineRange(attr) {
      var parts = attr.split("-");
      return {
        start: parseInt(parts[0], 10),
        end: parseInt(parts[1] || parts[0], 10),
      };
    }
    var lineToBlock = {};
    blockEls.forEach(function (el) {
      var r = parseLineRange(el.getAttribute("data-lines"));
      for (var n = r.start; n <= r.end; n++) lineToBlock[n] = el;
    });
    function getSourceLineEls(block) {
      var r = parseLineRange(block.getAttribute("data-lines"));
      var els = [];
      for (var n = r.start; n <= r.end; n++)
        if (srcLineEls[n]) els.push(srcLineEls[n]);
      return els;
    }

    var activeSyncEls = [];
    function clearSyncHighlight() {
      activeSyncEls.forEach(function (el) {
        el.classList.remove("sync-hover");
      });
      activeSyncEls = [];
    }
    function applySyncHighlight(block) {
      clearSyncHighlight();
      if (!block) return;
      block.classList.add("sync-hover");
      activeSyncEls.push(block);
      getSourceLineEls(block).forEach(function (el) {
        el.classList.add("sync-hover");
        activeSyncEls.push(el);
      });
    }
    function alignSourceToBlock(block) {
      var els = getSourceLineEls(block);
      if (els.length)
        els[0].scrollIntoView({ block: "center", behavior: "smooth" });
    }
    function alignRenderToBlock(block) {
      block.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    docPane.addEventListener("mouseover", function (e) {
      var block = e.target.closest("[data-lines]");
      if (block) applySyncHighlight(block);
    });
    docPane.addEventListener("mouseout", function (e) {
      if (e.target.closest("[data-lines]")) clearSyncHighlight();
    });
    docPane.addEventListener("click", function (e) {
      var block = e.target.closest("[data-lines]");
      if (!block) return;
      applySyncHighlight(block);
      alignSourceToBlock(block);
    });
    sourcePaneEl.addEventListener("mouseover", function (e) {
      var lineEl = e.target.closest(".src-line");
      if (!lineEl) return;
      var block = lineToBlock[parseInt(lineEl.getAttribute("data-line"), 10)];
      if (block) applySyncHighlight(block);
    });
    sourcePaneEl.addEventListener("mouseout", function (e) {
      if (e.target.closest(".src-line")) clearSyncHighlight();
    });
    sourcePaneEl.addEventListener("click", function (e) {
      var lineEl = e.target.closest(".src-line");
      if (!lineEl) return;
      var block = lineToBlock[parseInt(lineEl.getAttribute("data-line"), 10)];
      if (!block) return;
      applySyncHighlight(block);
      alignRenderToBlock(block);
    });

    // ---- table of contents active section tracking ----------------------
    var tocLinks = root.querySelectorAll(".toc-list a");
    var sectionHeadings = Array.prototype.slice.call(
      root.querySelectorAll("#colophon-doc-body h2"),
    );
    if (
      "IntersectionObserver" in window &&
      sectionHeadings.length &&
      tocLinks.length
    ) {
      var linkById = {};
      tocLinks.forEach(function (link) {
        linkById[link.getAttribute("data-toc-link")] = link;
      });
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var link = linkById[entry.target.id];
            if (!link) return;
            if (entry.isIntersecting) {
              tocLinks.forEach(function (l) {
                l.classList.remove("active");
              });
              link.classList.add("active");
            }
          });
        },
        { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
      );
      sectionHeadings.forEach(function (h) {
        observer.observe(h);
      });
    }
  }

  // ---------------------------------------------------------------------
  function activate() {
    var rawText = window.__colophonRawText;
    if (rawText == null) {
      console.warn(
        "[Colophon] this page was not detected as a plain markdown/text document.",
      );
      return;
    }

    var originalContainer = document.createElement("div");
    originalContainer.id = "colophon-original";
    while (document.body.firstChild)
      originalContainer.appendChild(document.body.firstChild);
    originalContainer.style.display = "none";
    document.body.appendChild(originalContainer);

    var parsed = P.parse(rawText);
    var root = buildReaderRoot(parsed, rawText);
    document.body.appendChild(root);

    var originalTitle = document.title;
    var readerTitle =
      (parsed.frontmatter &&
        (parsed.frontmatter.title || parsed.frontmatter.name)) ||
      parsed.firstH1 ||
      humanize(filenameFromUrl());
    document.title = readerTitle + " — Colophon";

    var active = true;
    function restore() {
      active = false;
      originalContainer.style.display = "";
      root.style.display = "none";
      document.title = originalTitle;
    }

    window.__colophonToggle = function () {
      active = !active;
      originalContainer.style.display = active ? "none" : "";
      root.style.display = active ? "" : "none";
      document.title = active ? readerTitle + " — Colophon" : originalTitle;
    };

    wireReaderBehavior(root, parsed, rawText, restore);

    // Design Lens: async, generalized stylesheet scan. Doesn't block the
    // initial render — if/when it resolves, splice it in right after the
    // masthead. If the doc links no stylesheet (or the stylesheet defines
    // no usable tokens), this resolves to "" and nothing is added.
    var docBodyEl = root.querySelector("#colophon-doc-body");
    // window.__colophonCssSource is a seam a non-extension host (the CLI)
    // can set before this file runs, handing the Lens already-resolved CSS
    // text instead of relying on the document-link-scan + fetch path that
    // only makes sense inside a browser extension. Unset in the extension,
    // where the Lens falls back to its normal scan-and-fetch behavior.
    var lensOpts = window.__colophonCssSource
      ? { source: window.__colophonCssSource }
      : undefined;
    window.ColophonLens.build(docBodyEl, lensOpts)
      .then(function (lensHtml) {
        if (!lensHtml) return;
        var mount = root.querySelector("#colophon-lens-mount");
        mount.innerHTML = lensHtml;
      })
      .catch(function (err) {
        console.warn("[Colophon] lens build failed:", err);
      });
  }

  activate();
})();
