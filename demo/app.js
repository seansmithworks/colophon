(function () {
  "use strict";

  var htmlEl = document.documentElement;
  var docPane = document.getElementById("doc");

  /* ---------- reading progress ---------- */
  var progressFill = document.getElementById("progress-fill");
  function updateProgress() {
    var ratio;
    if (htmlEl.getAttribute("data-view") === "split" && docPane) {
      var maxSplit = docPane.scrollHeight - docPane.clientHeight;
      ratio =
        maxSplit > 0
          ? Math.min(1, Math.max(0, docPane.scrollTop / maxSplit))
          : 0;
    } else {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }
    progressFill.style.transform = "scaleX(" + ratio + ")";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  if (docPane)
    docPane.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------- theme variant toggle ---------- */
  var variantBtns = document.querySelectorAll("[data-variant-btn]");
  function setVariant(name) {
    htmlEl.setAttribute("data-variant", name);
    variantBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-variant-btn") === name;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    try {
      localStorage.setItem("md-reader-variant", name);
    } catch (e) {}
  }
  variantBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setVariant(btn.getAttribute("data-variant-btn"));
    });
  });
  try {
    var savedVariant = localStorage.getItem("md-reader-variant");
    if (savedVariant === "system" || savedVariant === "editorial")
      setVariant(savedVariant);
  } catch (e) {}

  /* ---------- design lens toggle ---------- */
  // Off state removes the whole #design-lens block AND every inline
  // .lens-chip via a single CSS rule: html[data-lens="off"] #design-lens,
  // html[data-lens="off"] .lens-chip { display: none; } (see style.css).
  // Split view hides #design-lens unconditionally via a separate rule
  // (html[data-view="split"] #design-lens) regardless of this toggle.
  var lensToggleBtn = document.getElementById("lens-toggle");
  function setLensState(on) {
    htmlEl.setAttribute("data-lens", on ? "on" : "off");
    if (lensToggleBtn)
      lensToggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    try {
      localStorage.setItem("md-reader-lens", on ? "on" : "off");
    } catch (e) {}
  }
  if (lensToggleBtn) {
    lensToggleBtn.addEventListener("click", function () {
      var isOn = htmlEl.getAttribute("data-lens") === "on";
      setLensState(!isOn);
    });
  }
  setLensState(true);
  try {
    var savedLens = localStorage.getItem("md-reader-lens");
    if (savedLens === "off") setLensState(false);
  } catch (e) {}

  /* ---------- view switcher: Read / Split ---------- */
  // data-view="read"|"split" on <html> scopes the whole split layout via
  // html[data-view="split"] .layout / .toc / .source-pane / #design-lens
  // selectors in style.css. Split is gated to >1000px; the media query in
  // style.css hides the switcher below that, and mqSplitAllowed here forces
  // the state back to "read" if the viewport shrinks while split is active.
  var viewBtns = document.querySelectorAll("[data-view-btn]");
  var mqSplitAllowed = window.matchMedia("(min-width: 1001px)");
  function setView(name) {
    if (name === "split" && !mqSplitAllowed.matches) name = "read";
    htmlEl.setAttribute("data-view", name);
    viewBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-view-btn") === name;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    try {
      localStorage.setItem("md-reader-view", name);
    } catch (e) {}
    updateProgress();
  }
  viewBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setView(btn.getAttribute("data-view-btn"));
    });
  });
  if (mqSplitAllowed.addEventListener) {
    mqSplitAllowed.addEventListener("change", function (e) {
      if (!e.matches && htmlEl.getAttribute("data-view") === "split")
        setView("read");
    });
  }
  try {
    var savedView = localStorage.getItem("md-reader-view");
    if (savedView === "split") setView("split");
  } catch (e) {}

  /* ---------- source <-> render correspondence (DevTools-style sync) ---------- */
  var sourcePaneEl = document.getElementById("source-pane");
  var blockEls = Array.prototype.slice.call(
    document.querySelectorAll("#doc [data-lines]"),
  );
  var srcLineEls = {};
  if (sourcePaneEl) {
    Array.prototype.slice
      .call(sourcePaneEl.querySelectorAll(".src-line"))
      .forEach(function (el) {
        srcLineEls[el.getAttribute("data-line")] = el;
      });
  }

  function parseLineRange(attr) {
    var parts = attr.split("-");
    return {
      start: parseInt(parts[0], 10),
      end: parseInt(parts[1] || parts[0], 10),
    };
  }

  // line number -> matching render block (built once; ranges don't overlap)
  var lineToBlock = {};
  blockEls.forEach(function (el) {
    var r = parseLineRange(el.getAttribute("data-lines"));
    for (var n = r.start; n <= r.end; n++) lineToBlock[n] = el;
  });

  function getSourceLineEls(block) {
    var r = parseLineRange(block.getAttribute("data-lines"));
    var els = [];
    for (var n = r.start; n <= r.end; n++) {
      if (srcLineEls[n]) els.push(srcLineEls[n]);
    }
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

  // Hover, direction 1: render block -> tint block + matching source lines.
  // Hover, direction 2: source line -> tint source line(s) + matching block.
  // Both use mouseover/mouseout event delegation (single listener per pane).
  if (docPane) {
    docPane.addEventListener("mouseover", function (e) {
      var block = e.target.closest("[data-lines]");
      if (block) applySyncHighlight(block);
    });
    docPane.addEventListener("mouseout", function (e) {
      var block = e.target.closest("[data-lines]");
      if (block) clearSyncHighlight();
    });
    // Click, direction 1: render block -> scroll source pane to align.
    docPane.addEventListener("click", function (e) {
      var block = e.target.closest("[data-lines]");
      if (!block) return;
      applySyncHighlight(block);
      alignSourceToBlock(block);
    });
  }
  if (sourcePaneEl) {
    sourcePaneEl.addEventListener("mouseover", function (e) {
      var lineEl = e.target.closest(".src-line");
      if (!lineEl) return;
      var block = lineToBlock[parseInt(lineEl.getAttribute("data-line"), 10)];
      if (block) applySyncHighlight(block);
    });
    sourcePaneEl.addEventListener("mouseout", function (e) {
      var lineEl = e.target.closest(".src-line");
      if (lineEl) clearSyncHighlight();
    });
    // Click, direction 2: source line -> scroll render pane to align.
    sourcePaneEl.addEventListener("click", function (e) {
      var lineEl = e.target.closest(".src-line");
      if (!lineEl) return;
      var block = lineToBlock[parseInt(lineEl.getAttribute("data-line"), 10)];
      if (!block) return;
      applySyncHighlight(block);
      alignRenderToBlock(block);
    });
  }

  // Voiceover mirror: called from highlightBlock() below while reading.
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
    if (htmlEl.getAttribute("data-view") === "split" && els.length) {
      els[0].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  /* ---------- table of contents: active section tracking ---------- */
  var tocLinks = document.querySelectorAll(".toc-list a");
  var sectionHeadings = Array.prototype.slice.call(
    document.querySelectorAll("#doc-body h2"),
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

  /* ---------- voiceover player ---------- */
  var playPauseBtn = document.getElementById("btn-playpause");
  var prevBtn = document.getElementById("btn-prev");
  var nextBtn = document.getElementById("btn-next");
  var iconPlay = document.getElementById("icon-play");
  var iconPause = document.getElementById("icon-pause");
  var nowEl = document.getElementById("player-now");
  var voiceSelect = document.getElementById("voice-select");
  var speedSelect = document.getElementById("speed-select");

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

  // Reading-order blocks. Code blocks AND the Design Lens are intentionally
  // excluded: convert.mjs/build-lens.mjs only stamp data-block="true" on the
  // source document's headings/paragraphs/list items, never on
  // <pre class="code-block"> or anything inside #design-lens (which sits
  // outside #doc-body entirely), so this selector already skips both.
  // getReadableBlocks() adds defensive .closest() filters in case a future
  // edit nests a data-block element inside either.
  function getReadableBlocks() {
    var all = Array.prototype.slice.call(
      document.querySelectorAll('#doc-body [data-block="true"]'),
    );
    return all.filter(function (el) {
      return !el.closest(".code-block") && !el.closest("#design-lens");
    });
  }

  var blocks = getReadableBlocks();
  var currentIndex = -1;
  var isPlaying = false;
  var currentUtterance = null;
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

    // Prefer an en-US enhanced/premium/Siri voice as the default pick.
    var preferredIndex = voices.findIndex(function (v) {
      var name = v.name.toLowerCase();
      return (
        v.lang === "en-US" &&
        (name.indexOf("premium") !== -1 ||
          name.indexOf("enhanced") !== -1 ||
          name.indexOf("siri") !== -1)
      );
    });
    if (preferredIndex === -1) {
      preferredIndex = voices.findIndex(function (v) {
        return v.lang === "en-US";
      });
    }
    if (preferredIndex === -1) preferredIndex = 0;

    if (previousValue && voices[Number(previousValue)]) {
      voiceSelect.value = previousValue;
    } else {
      voiceSelect.value = String(preferredIndex);
    }
  }

  populateVoices();
  if (typeof synth.onvoiceschanged !== "undefined") {
    synth.addEventListener("voiceschanged", populateVoices);
  }

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
    // Signature moment: the voice walking through source and render at once.
    mirrorToSource(el);
  }

  function setPlayingUI(playing) {
    isPlaying = playing;
    playPauseBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    playPauseBtn.title = playing ? "Pause" : "Play";
    iconPlay.style.display = playing ? "none" : "";
    iconPause.style.display = playing ? "" : "none";
  }

  function statusFor(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4")
      return "Reading heading";
    if (tag === "li") return "Reading list item";
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
      statusFor(el) + " — " + text.slice(0, 60) + (text.length > 60 ? "…" : "");

    var utterance = new SpeechSynthesisUtterance(text);
    var selectedVoice = voices[Number(voiceSelect.value)];
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = Number(speedSelect.value) || 1;

    utterance.onend = function () {
      if (currentIndex === index && isPlaying) {
        speakBlock(index + 1);
      }
    };
    utterance.onerror = function () {
      if (currentIndex === index && isPlaying) {
        speakBlock(index + 1);
      }
    };

    currentUtterance = utterance;
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
    if (isPlaying) {
      stopReading();
    } else {
      startReading(currentIndex < 0 ? 0 : currentIndex);
    }
  });

  prevBtn.addEventListener("click", function () {
    var target = Math.max(0, (currentIndex < 0 ? 0 : currentIndex) - 1);
    if (isPlaying) {
      startReading(target);
    } else {
      currentIndex = target;
      highlightBlock(blocks[target]);
    }
  });

  nextBtn.addEventListener("click", function () {
    var target = Math.min(
      blocks.length - 1,
      (currentIndex < 0 ? -1 : currentIndex) + 1,
    );
    if (isPlaying) {
      startReading(target);
    } else {
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
})();
