// MD Reader — background service worker (MV3)
//
// Two jobs:
// 1. Toolbar action click -> inject the reader bundle into the active tab
//    (in dependency order) and tell it to toggle on/off.
// 2. Fetch relay for content scripts. Content scripts run in the page's
//    origin and are bound by that page's CSP (many raw-markdown hosts, e.g.
//    githubusercontent.com, send a locked-down CSP that blocks fetch()).
//    The service worker is NOT part of the page and fetches under the
//    extension's own permissions instead, so it can retrieve stylesheets
//    and SVG assets a document links regardless of the host page's CSP.
//
// TODO before any Chrome Web Store submission: replace the v1
// host_permissions: ["<all_urls>"] with optional_host_permissions and
// request access per-origin via chrome.permissions.request() the first
// time a document actually links an external stylesheet/asset. <all_urls>
// is fine for local unpacked testing but is broader than the extension
// needs at rest.

const READER_FILES = [
  "content/md-parser.js",
  "content/lens.js",
  "content/reader.js",
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    // CSS first so there's no flash of unstyled content once reader.js
    // (the last file in READER_FILES) builds and appends the reader DOM.
    // reader.js is idempotent: on a repeat injection it detects its own
    // prior bootstrap (window.__mdReaderToggle) and just flips visibility
    // instead of rebuilding, so no separate "toggle" message is needed.
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["styles/reader.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: READER_FILES,
    });
  } catch (err) {
    // Most common cause: the tab does not match our detector (not a plain
    // markdown/text page). Fail quietly rather than throwing in the SW.
    console.warn(
      "[MD Reader] could not activate on this tab:",
      err && err.message,
    );
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "MD_READER_FETCH") return false;

  fetch(message.url, { credentials: "omit" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then((text) => sendResponse({ ok: true, text: text }))
    .catch((err) =>
      sendResponse({ ok: false, error: String(err && err.message) }),
    );

  return true; // keep the message channel open for the async sendResponse
});
