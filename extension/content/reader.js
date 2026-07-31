// MD Reader — main content script (no modules)
//
// Orchestrates: stash the original page, parse the raw markdown, build the
// reader DOM, wire up theme/lens/view toggles, TOC, the voiceover player,
// and source<->render hover/click sync. Ported from demo/build.mjs +
// demo/app.js, generalized to run at click-time against whatever markdown
// document.detect.js found, instead of one baked Vercel file.
(function () {
  "use strict";

  // Re-clicking the toolbar action re-injects this file. If we already
  // bootstrapped on this page, just flip visibility instead of rebuilding.
  if (window.__mdReaderToggle) {
    window.__mdReaderToggle();
    return;
  }

  var P = window.MDReaderParser;
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

  function playerHtml() {
    return (
      '<footer class="player" id="mdreader-player">' +
      '<div class="player-inner">' +
      '<div class="player-transport">' +
      '<button type="button" id="mdreader-btn-prev" class="player-btn" aria-label="Previous paragraph" title="Previous paragraph">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="3" width="1.4" height="10" fill="currentColor"/><path d="M13 3.5L5.5 8L13 12.5V3.5Z" fill="currentColor"/></svg></button>' +
      '<button type="button" id="mdreader-btn-playpause" class="player-btn player-btn-primary" aria-label="Play" aria-pressed="false" title="Play">' +
      '<svg id="mdreader-icon-play" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5L13.5 8L4 13.5V2.5Z" fill="currentColor"/></svg>' +
      '<svg id="mdreader-icon-pause" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style="display:none"><rect x="3.5" y="2.5" width="3" height="11" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" fill="currentColor"/></svg></button>' +
      '<button type="button" id="mdreader-btn-next" class="player-btn" aria-label="Next paragraph" title="Next paragraph">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="11.6" y="3" width="1.4" height="10" fill="currentColor"/><path d="M3 3.5L10.5 8L3 12.5V3.5Z" fill="currentColor"/></svg></button>' +
      "</div>" +
      '<div class="player-status"><p class="player-now" id="mdreader-player-now">Voiceover ready</p></div>' +
      '<div class="player-settings">' +
      '<label class="player-field"><span class="player-field-label">Voice</span><select id="mdreader-voice-select" class="player-select"></select></label>' +
      '<label class="player-field"><span class="player-field-label">Speed</span><select id="mdreader-speed-select" class="player-select">' +
      '<option value="0.8">0.8&times;</option><option value="1" selected>1&times;</option><option value="1.25">1.25&times;</option><option value="1.5">1.5&times;</option>' +
      "</select></label></div></div></footer>"
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
    root.id = "mdreader-root";
    root.innerHTML =
      '<div class="progress-track" aria-hidden="true"><div class="progress-fill" id="mdreader-progress-fill"></div></div>' +
      '<header class="topbar"><div class="topbar-inner">' +
      '<div class="topbar-brand"><svg class="brand-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 12.5L8 2.5L14 12.5H2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg><span class="brand-name">MD Reader</span></div>' +
      '<div class="topbar-controls">' +
      '<div class="view-toggle" id="mdreader-view-toggle" role="group" aria-label="View">' +
      '<button type="button" class="view-btn" data-view-btn="read" aria-pressed="true">Read</button>' +
      '<button type="button" class="view-btn" data-view-btn="split" aria-pressed="false">Split</button></div>' +
      '<button type="button" id="mdreader-lens-toggle" class="lens-toggle" aria-pressed="true" title="Toggle the Design Lens"><span>Lens</span></button>' +
      '<div class="variant-toggle" role="group" aria-label="Reading theme">' +
      '<button type="button" class="variant-btn" data-variant-btn="editorial" aria-pressed="true">Editorial</button>' +
      '<button type="button" class="variant-btn" data-variant-btn="system" aria-pressed="false">System</button></div>' +
      '<button type="button" id="mdreader-close" class="lens-toggle" title="Restore original page">&times;</button>' +
      "</div></div></header>" +
      '<div class="layout" id="mdreader-layout">' +
      '<aside class="source-pane" id="mdreader-source-pane" aria-label="Raw markdown source">' +
      buildSourcePaneHtml(raw) +
      "</aside>" +
      '<nav class="toc" id="mdreader-toc" aria-label="Table of contents"><div class="toc-inner"><p class="toc-label">Contents</p><ol class="toc-list">' +
      tocHtml +
      "</ol></div></nav>" +
      '<main class="doc" id="mdreader-doc">' +
      '<section class="masthead" data-block="true" data-lines="1-' +
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
      '<div id="mdreader-lens-mount"></div>' +
      '<article class="doc-body" id="mdreader-doc-body">' +
      parsed.bodyHtml +
      "</article>" +
      "</main></div>" +
      playerHtml();

    return root;
  }

  // ---------------------------------------------------------------------
  function wireReaderBehavior(root, parsed, raw, restoreFn) {
    var htmlEl = document.documentElement;
    var docPane = root.querySelector("#mdreader-doc");

    // progress bar
    var progressFill = root.querySelector("#mdreader-progress-fill");
    function updateProgress() {
      var ratio;
      if (htmlEl.getAttribute("data-mdreader-view") === "split" && docPane) {
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

    // theme variant toggle
    var variantBtns = root.querySelectorAll("[data-variant-btn]");
    function setVariant(name) {
      htmlEl.setAttribute("data-mdreader-variant", name);
      variantBtns.forEach(function (btn) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-variant-btn") === name ? "true" : "false",
        );
      });
    }
    variantBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setVariant(btn.getAttribute("data-variant-btn"));
      });
    });
    setVariant("editorial");

    // design lens toggle (block is injected async once the stylesheet fetch resolves)
    var lensToggleBtn = root.querySelector("#mdreader-lens-toggle");
    function setLensState(on) {
      htmlEl.setAttribute("data-mdreader-lens", on ? "on" : "off");
      lensToggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    lensToggleBtn.addEventListener("click", function () {
      setLensState(htmlEl.getAttribute("data-mdreader-lens") !== "on");
    });
    setLensState(true);

    // view switcher (Read / Split)
    var viewBtns = root.querySelectorAll("[data-view-btn]");
    var mqSplitAllowed = window.matchMedia("(min-width: 1001px)");
    function setView(name) {
      if (name === "split" && !mqSplitAllowed.matches) name = "read";
      htmlEl.setAttribute("data-mdreader-view", name);
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
        if (!e.matches && htmlEl.getAttribute("data-mdreader-view") === "split")
          setView("read");
      });
    }
    setView("read");

    // close / restore original page
    root
      .querySelector("#mdreader-close")
      .addEventListener("click", function () {
        restoreFn();
      });

    // ---- source <-> render correspondence (DevTools-style sync) --------
    var sourcePaneEl = root.querySelector("#mdreader-source-pane");
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

    var ttsMirrorEls = [];
    function clearSourceMirror() {
      ttsMirrorEls.forEach(function (el) {
        el.classList.remove("tts-mirror");
      });
      ttsMirrorEls = [];
    }
    function mirrorToSource(block) {
      clearSourceMirror();
      if (!block || !block.hasAttribute("data-lines")) return;
      var els = getSourceLineEls(block);
      els.forEach(function (el) {
        el.classList.add("tts-mirror");
      });
      ttsMirrorEls = els;
      if (htmlEl.getAttribute("data-mdreader-view") === "split" && els.length) {
        els[0].scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }

    // ---- table of contents active section tracking ----------------------
    var tocLinks = root.querySelectorAll(".toc-list a");
    var sectionHeadings = Array.prototype.slice.call(
      root.querySelectorAll("#mdreader-doc-body h2"),
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

    // ---- voiceover player -------------------------------------------------
    var playPauseBtn = root.querySelector("#mdreader-btn-playpause");
    var prevBtn = root.querySelector("#mdreader-btn-prev");
    var nextBtn = root.querySelector("#mdreader-btn-next");
    var iconPlay = root.querySelector("#mdreader-icon-play");
    var iconPause = root.querySelector("#mdreader-icon-pause");
    var nowEl = root.querySelector("#mdreader-player-now");
    var voiceSelect = root.querySelector("#mdreader-voice-select");
    var speedSelect = root.querySelector("#mdreader-speed-select");

    var synthAvailable = "speechSynthesis" in window;
    if (!synthAvailable) {
      nowEl.textContent = "Voiceover unavailable in this browser";
      [playPauseBtn, prevBtn, nextBtn, voiceSelect, speedSelect].forEach(
        function (el) {
          el.disabled = true;
        },
      );
      return;
    }
    var synth = window.speechSynthesis;

    function getReadableBlocks() {
      var all = Array.prototype.slice.call(
        root.querySelectorAll('#mdreader-doc-body [data-block="true"]'),
      );
      return all.filter(function (el) {
        return !el.closest(".code-block") && !el.closest("#design-lens");
      });
    }
    var blocks = getReadableBlocks();
    var currentIndex = -1;
    var isPlaying = false;
    var voices = [];

    function populateVoices() {
      voices = synth.getVoices();
      if (!voices.length) return;
      var previousValue = voiceSelect.value;
      voiceSelect.innerHTML = "";
      voices.forEach(function (voice, i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = voice.name + " (" + voice.lang + ")";
        voiceSelect.appendChild(opt);
      });
      var preferredIndex = voices.findIndex(function (v) {
        var name = v.name.toLowerCase();
        return (
          v.lang === "en-US" &&
          (name.indexOf("premium") !== -1 ||
            name.indexOf("enhanced") !== -1 ||
            name.indexOf("siri") !== -1)
        );
      });
      if (preferredIndex === -1)
        preferredIndex = voices.findIndex(function (v) {
          return v.lang === "en-US";
        });
      if (preferredIndex === -1) preferredIndex = 0;
      voiceSelect.value =
        previousValue && voices[Number(previousValue)]
          ? previousValue
          : String(preferredIndex);
    }
    populateVoices();
    if (typeof synth.onvoiceschanged !== "undefined")
      synth.addEventListener("voiceschanged", populateVoices);

    function clearHighlight() {
      blocks.forEach(function (b) {
        b.classList.remove("reading-active");
      });
      clearSourceMirror();
    }
    function highlightBlock(el) {
      clearHighlight();
      el.classList.add("reading-active");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      mirrorToSource(el);
    }
    function setPlayingUI(playing) {
      isPlaying = playing;
      playPauseBtn.setAttribute("aria-pressed", playing ? "true" : "false");
      playPauseBtn.title = playing ? "Pause" : "Play";
      iconPlay.style.display = playing ? "none" : "";
      iconPause.style.display = playing ? "" : "none";
    }
    function statusFor(el) {
      var tag = el.tagName.toLowerCase();
      if (/^h[1-4]$/.test(tag)) return "Reading heading";
      if (tag === "li") return "Reading list item";
      if (tag === "td" || tag === "th") return "Reading table cell";
      return "Reading paragraph";
    }
    function speakBlock(index) {
      if (index < 0 || index >= blocks.length) {
        stopReading();
        nowEl.textContent = "Finished reading";
        return;
      }
      currentIndex = index;
      var el = blocks[index];
      var text = el.textContent.trim();
      if (!text) {
        speakBlock(index + 1);
        return;
      }
      highlightBlock(el);
      nowEl.textContent =
        statusFor(el) +
        " — " +
        text.slice(0, 60) +
        (text.length > 60 ? "…" : "");
      var utterance = new SpeechSynthesisUtterance(text);
      var selectedVoice = voices[Number(voiceSelect.value)];
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = Number(speedSelect.value) || 1;
      utterance.onend = function () {
        if (currentIndex === index && isPlaying) speakBlock(index + 1);
      };
      utterance.onerror = function () {
        if (currentIndex === index && isPlaying) speakBlock(index + 1);
      };
      synth.cancel();
      synth.speak(utterance);
    }
    function startReading(fromIndex) {
      setPlayingUI(true);
      speakBlock(fromIndex);
    }
    function stopReading() {
      setPlayingUI(false);
      synth.cancel();
      clearHighlight();
    }

    playPauseBtn.addEventListener("click", function () {
      if (isPlaying) stopReading();
      else startReading(currentIndex < 0 ? 0 : currentIndex);
    });
    prevBtn.addEventListener("click", function () {
      var target = Math.max(0, (currentIndex < 0 ? 0 : currentIndex) - 1);
      if (isPlaying) startReading(target);
      else {
        currentIndex = target;
        highlightBlock(blocks[target]);
      }
    });
    nextBtn.addEventListener("click", function () {
      var target = Math.min(
        blocks.length - 1,
        (currentIndex < 0 ? -1 : currentIndex) + 1,
      );
      if (isPlaying) startReading(target);
      else {
        currentIndex = target;
        highlightBlock(blocks[target]);
      }
    });
    speedSelect.addEventListener("change", function () {
      if (isPlaying) startReading(currentIndex);
    });
    voiceSelect.addEventListener("change", function () {
      if (isPlaying) startReading(currentIndex);
    });

    // expose for the lens-injection step below to cancel/reset if needed
    root.__mdReaderStop = stopReading;
  }

  // ---------------------------------------------------------------------
  function activate() {
    var rawText = window.__mdReaderRawText;
    if (rawText == null) {
      console.warn(
        "[MD Reader] this page was not detected as a plain markdown/text document.",
      );
      return;
    }

    var originalContainer = document.createElement("div");
    originalContainer.id = "mdreader-original";
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
    document.title = readerTitle + " — MD Reader";

    var active = true;
    function restore() {
      active = false;
      originalContainer.style.display = "";
      root.style.display = "none";
      document.title = originalTitle;
      try {
        speechSynthesis.cancel();
      } catch (e) {}
    }

    window.__mdReaderToggle = function () {
      active = !active;
      originalContainer.style.display = active ? "none" : "";
      root.style.display = active ? "" : "none";
      document.title = active ? readerTitle + " — MD Reader" : originalTitle;
      if (!active) {
        try {
          speechSynthesis.cancel();
        } catch (e) {}
      }
    };

    wireReaderBehavior(root, parsed, rawText, restore);

    // Design Lens: async, generalized stylesheet scan. Doesn't block the
    // initial render — if/when it resolves, splice it in right after the
    // masthead. If the doc links no stylesheet (or the stylesheet defines
    // no usable tokens), this resolves to "" and nothing is added.
    var docBodyEl = root.querySelector("#mdreader-doc-body");
    window.MDReaderLens.build(docBodyEl)
      .then(function (lensHtml) {
        if (!lensHtml) return;
        var mount = root.querySelector("#mdreader-lens-mount");
        mount.innerHTML = lensHtml;
      })
      .catch(function (err) {
        console.warn("[MD Reader] lens build failed:", err);
      });
  }

  activate();
})();
