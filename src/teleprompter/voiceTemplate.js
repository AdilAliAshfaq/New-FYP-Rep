// Page-based teleprompter with voice highlighting.
//
// Behavior:
//  - Script is divided into ~6 pages (between 20–80 words each)
//  - Only the current page is visible; the rest is off-screen
//  - Spoken words on the current page get highlighted in primary color
//  - When the LAST word on the page is matched, page auto-advances after a short delay
//  - Page indicator "Page X / Y" shown at the top
//  - Debug overlay shows what the speech recognizer is actually hearing

export function buildVoiceTemplate({
  scriptContent,
  lang = 'en-US',
  fontSize = 28,
  fontColor = '#ffffff',
  highlightColor = '#5E17EB',
  backgroundColor = 'transparent',
  textAlign = 'center',
  mirror = false,
  isRTL = false,
  lineHeight = 1.6,
  showDebug = true, // on by default while we debug
}) {
  const safeScript = JSON.stringify(scriptContent);
  const safeLang = JSON.stringify(lang);
  const debugFlag = showDebug ? 'true' : 'false';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    height: 100%;
    background: ${backgroundColor};
    color: ${fontColor};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-weight: 500;
    letter-spacing: -0.01em;
    overflow: hidden;
  }
  #stage {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  #pageIndicator {
    flex-shrink: 0;
    padding: 10px 16px 6px;
    text-align: center;
    color: ${highlightColor};
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    opacity: 0.85;
  }
  #pageContainer {
    flex: 1;
    position: relative;
    overflow: hidden;
    padding: 12px 24px 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page {
    position: absolute;
    top: 12px; left: 24px; right: 24px; bottom: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.35s ease, transform 0.35s ease;
    pointer-events: none;
  }
  .page.active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .page.leaving {
    opacity: 0;
    transform: translateY(-24px);
  }
  .page-inner {
    width: 100%;
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    text-align: ${textAlign};
    ${mirror ? 'transform: scaleX(-1);' : ''}
    ${isRTL ? 'direction: rtl;' : ''}
  }
  .w {
    display: inline;
    color: ${fontColor};
    opacity: 0.45;
    transition: color 0.12s ease, opacity 0.12s ease;
  }
  .w.done { color: ${highlightColor}; opacity: 1; }
  .w.current {
    color: ${highlightColor};
    opacity: 1;
    text-shadow: 0 0 12px ${highlightColor}66;
  }
  #debug {
    position: fixed;
    top: 8px; left: 8px; right: 8px;
    background: rgba(0,0,0,0.75);
    color: #fff;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-family: monospace;
    z-index: 1000;
    display: none;
    max-height: 28vh;
    overflow-y: auto;
  }
  #debug.on { display: block; }
  #debug .err { color: #ff6b6b; }
  #debug .ok { color: ${highlightColor}; }
</style>
</head>
<body>
  <div id="debug"></div>

  <div id="stage">
    <div id="pageIndicator">Page 1 / 1</div>
    <div id="pageContainer"></div>
  </div>

<script>
(function () {
  var SCRIPT_TEXT = ${safeScript};
  var LANG = ${safeLang};
  var SHOW_DEBUG = ${debugFlag};

  // ── RN bridge ────────────────────────────────────────────────────────
  function postToRN(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    }
  }

  var debugEl = document.getElementById('debug');
  function dlog(msg, type) {
    postToRN({ type: 'log', message: msg, level: type || 'info' });
    if (!SHOW_DEBUG) return;
    var line = document.createElement('div');
    if (type) line.className = type;
    line.textContent = msg;
    debugEl.appendChild(line);
    debugEl.classList.add('on');
    while (debugEl.children.length > 10) debugEl.removeChild(debugEl.firstChild);
  }

  window.addEventListener('error', function (e) {
    dlog('JS ERROR: ' + (e.message || e.error), 'err');
  });

  dlog('WebView loaded, lang=' + LANG, 'ok');

  // ── Tokenize entire script ───────────────────────────────────────────
  function normalize(w) {
    return w.toLowerCase()
            .replace(/[^\\p{L}\\p{N}']/gu, '')
            .trim();
  }

  function tokenize(text) {
    return text.split(/\\s+/).map(normalize).filter(Boolean);
  }

  // Build a flat list of "items" preserving spaces as literal characters
  // between words. Each word gets a globalIndex for matching.
  var allItems = []; // [{ type: 'word'|'space', text, normalized?, globalIndex? }]
  var totalWords = 0;
  (function parseScript() {
    var parts = SCRIPT_TEXT.split(/(\\s+)/);
    parts.forEach(function (chunk) {
      if (/^\\s+$/.test(chunk)) {
        allItems.push({ type: 'space', text: chunk });
      } else if (chunk.length > 0) {
        allItems.push({
          type: 'word',
          text: chunk,
          normalized: normalize(chunk),
          globalIndex: totalWords,
        });
        totalWords++;
      }
    });
    dlog('Parsed ' + totalWords + ' words', 'ok');
  })();

  // ── Page calculation ─────────────────────────────────────────────────
  // Target ~6 pages, clamped 20..80 words per page.
  var TARGET_PAGES = 6;
  var MIN_WORDS_PER_PAGE = 20;
  var MAX_WORDS_PER_PAGE = 80;

  var wordsPerPage = Math.ceil(totalWords / TARGET_PAGES);
  if (wordsPerPage < MIN_WORDS_PER_PAGE) wordsPerPage = MIN_WORDS_PER_PAGE;
  if (wordsPerPage > MAX_WORDS_PER_PAGE) wordsPerPage = MAX_WORDS_PER_PAGE;
  var totalPages = Math.max(1, Math.ceil(totalWords / wordsPerPage));

  dlog('Pages: ' + totalPages + ' (~' + wordsPerPage + ' words/page)', 'ok');

  // ── Build DOM: one .page per page, words split accordingly ───────────
  var pageContainer = document.getElementById('pageContainer');
  var pageIndicator = document.getElementById('pageIndicator');

  // Map: globalWordIndex -> DOM span node
  var wordNodes = new Array(totalWords);
  // Map: globalWordIndex -> page number (0-based)
  var wordToPage = new Array(totalWords);
  // First/last globalIndex on each page
  var pageFirstWord = [];
  var pageLastWord = [];
  var pageElements = [];

  (function buildPages() {
    // Partition words into page buckets (keeps surrounding spaces with their page)
    var currentPage = -1;
    var currentPageEl = null;
    var currentPageInner = null;

    // Walk items; assign a page number to each word based on its globalIndex
    // For spaces, attach them to whichever page the *next* word belongs to
    // (or previous, if they trail the script).
    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      if (item.type === 'word') {
        var pageNum = Math.floor(item.globalIndex / wordsPerPage);
        wordToPage[item.globalIndex] = pageNum;

        if (pageNum !== currentPage) {
          currentPage = pageNum;
          currentPageEl = document.createElement('div');
          currentPageEl.className = 'page' + (currentPage === 0 ? ' active' : '');
          currentPageEl.dataset.page = currentPage;
          currentPageInner = document.createElement('div');
          currentPageInner.className = 'page-inner';
          currentPageEl.appendChild(currentPageInner);
          pageContainer.appendChild(currentPageEl);
          pageElements.push(currentPageEl);
          pageFirstWord[currentPage] = item.globalIndex;
        }

        pageLastWord[currentPage] = item.globalIndex;

        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = item.text;
        span.dataset.idx = item.globalIndex;
        currentPageInner.appendChild(span);
        wordNodes[item.globalIndex] = span;
      } else {
        // space: append to current page inner if one exists
        if (currentPageInner) {
          currentPageInner.appendChild(document.createTextNode(item.text));
        }
      }
    }

    updatePageIndicator(0);
  })();

  function updatePageIndicator(pageIdx) {
    pageIndicator.textContent = 'Page ' + (pageIdx + 1) + ' / ' + totalPages;
  }

  // ── Page transitions ─────────────────────────────────────────────────
  var currentPageIdx = 0;
  var advancing = false;

  function goToPage(newIdx) {
    if (newIdx < 0 || newIdx >= totalPages) return;
    if (newIdx === currentPageIdx) return;
    advancing = true;
    dlog('→ Advancing to page ' + (newIdx + 1), 'ok');

    var oldEl = pageElements[currentPageIdx];
    var newEl = pageElements[newIdx];
    if (oldEl) {
      oldEl.classList.remove('active');
      oldEl.classList.add('leaving');
    }
    if (newEl) {
      newEl.classList.remove('leaving');
      // slight delay to allow CSS to register
      setTimeout(function () { newEl.classList.add('active'); }, 20);
    }
    currentPageIdx = newIdx;
    updatePageIndicator(currentPageIdx);
    setTimeout(function () { advancing = false; }, 400);
  }

  // ── Word matching ────────────────────────────────────────────────────
  var pointer = 0;              // next expected global word index
  var lastHighlighted = -1;     // last global word marked done
  var totalSpokenWordsLocked = 0;
  var cumulativeFinalText = '';
  var LOOKAHEAD = 6;

  // Build a flat normalized array for matching
  var normalizedWords = new Array(totalWords);
  (function fillNormalized() {
    for (var i = 0; i < allItems.length; i++) {
      var it = allItems[i];
      if (it.type === 'word') normalizedWords[it.globalIndex] = it.normalized;
    }
  })();

  function advancePointer(spokenWords) {
    for (var s = 0; s < spokenWords.length; s++) {
      var w = spokenWords[s];
      if (!w) continue;
      var found = -1;
      var limit = Math.min(pointer + LOOKAHEAD, totalWords);
      for (var j = pointer; j < limit; j++) {
        if (normalizedWords[j] === w) { found = j; break; }
        if (normalizedWords[j].length > 2 && w.length > 2 &&
            (normalizedWords[j].indexOf(w) === 0 || w.indexOf(normalizedWords[j]) === 0)) {
          found = j;
          break;
        }
      }
      if (found >= 0) pointer = found + 1;
    }
    render();
  }

  function render() {
    var targetDone = pointer - 1;
    if (targetDone === lastHighlighted) return;

    if (targetDone > lastHighlighted) {
      for (var i = lastHighlighted + 1; i <= targetDone; i++) {
        if (wordNodes[i]) wordNodes[i].classList.add('done');
      }
    }
    // clear previous "current" marker
    if (lastHighlighted >= 0 && wordNodes[lastHighlighted]) {
      wordNodes[lastHighlighted].classList.remove('current');
    }
    if (wordNodes[targetDone]) {
      wordNodes[targetDone].classList.add('current');
    }
    lastHighlighted = targetDone;

    postToRN({ type: 'progress', index: targetDone, total: totalWords });

    // Auto-advance when we've highlighted the last word of current page
    checkPageAdvance();
  }

  function checkPageAdvance() {
    if (advancing) return;
    if (currentPageIdx >= totalPages - 1) return;
    var lastWordOnPage = pageLastWord[currentPageIdx];
    if (lastHighlighted >= lastWordOnPage) {
      // brief pause so user sees the final word confirmed, then flip
      setTimeout(function () {
        goToPage(currentPageIdx + 1);
      }, 500);
    }
  }

  // ── Mic permission priming ───────────────────────────────────────────
  function ensureMicPermission() {
    return new Promise(function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        dlog('getUserMedia not available', 'err');
        resolve(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          dlog('Mic stream acquired', 'ok');
          stream.getTracks().forEach(function (t) { t.stop(); });
          resolve(true);
        })
        .catch(function (err) {
          dlog('getUserMedia FAILED: ' + err.name, 'err');
          postToRN({ type: 'error', error: 'mic-denied', message: err.message });
          resolve(false);
        });
    });
  }

  // ── Speech recognition ───────────────────────────────────────────────
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    dlog('SpeechRecognition API NOT AVAILABLE', 'err');
    postToRN({ type: 'unsupported' });
    return;
  }
  dlog('SpeechRecognition available', 'ok');

  var recognition = new SR();
  recognition.lang = LANG;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  var wantRunning = false;
  var isStarted = false;

  recognition.onstart = function () {
    isStarted = true;
    dlog('● Recognition STARTED', 'ok');
    postToRN({ type: 'start' });
  };

  recognition.onaudiostart = function () { dlog('· audio start'); };
  recognition.onspeechstart = function () { dlog('· speech detected', 'ok'); };
  recognition.onspeechend = function () { dlog('· speech ended'); };
  recognition.onaudioend = function () { dlog('· audio end'); };
  recognition.onnomatch = function () { dlog('· nomatch', 'err'); };

  recognition.onend = function () {
    isStarted = false;
    dlog('Recognition ENDED, wantRunning=' + wantRunning);
    postToRN({ type: 'end' });
    if (wantRunning) {
      setTimeout(function () {
        if (wantRunning && !isStarted) {
          try {
            recognition.start();
            dlog('Auto-restart');
          } catch (e) {
            dlog('Restart failed: ' + e.message, 'err');
          }
        }
      }, 300);
    }
  };

  recognition.onerror = function (e) {
    dlog('ERROR: ' + e.error + ' — ' + (e.message || ''), 'err');
    postToRN({ type: 'error', error: e.error, message: e.message });
  };

  recognition.onresult = function (event) {
    var finalText = '';
    var interimText = '';
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var res = event.results[i];
      if (res.isFinal) {
        finalText += res[0].transcript + ' ';
      } else {
        interimText += res[0].transcript + ' ';
      }
    }

    if (finalText) {
      dlog('FINAL: "' + finalText.trim().slice(0, 50) + '"', 'ok');
      cumulativeFinalText += finalText;
      var allFinalWords = tokenize(cumulativeFinalText);
      var newWords = allFinalWords.slice(totalSpokenWordsLocked);
      totalSpokenWordsLocked = allFinalWords.length;
      if (newWords.length > 0) advancePointer(newWords);
    }

    if (interimText) {
      dlog('interim: "' + interimText.trim().slice(0, 40) + '"');
      var interimWords = tokenize(interimText);
      advancePointer(interimWords);
    }
  };

  async function startRecognition() {
    wantRunning = true;
    var micOk = await ensureMicPermission();
    if (!micOk) {
      wantRunning = false;
      return;
    }
    try {
      recognition.start();
      dlog('recognition.start() called', 'ok');
    } catch (e) {
      dlog('start() threw: ' + e.message, 'err');
    }
  }

  // ── Incoming RN commands ─────────────────────────────────────────────
  document.addEventListener('message', handleRNMessage);
  window.addEventListener('message', handleRNMessage);

  function handleRNMessage(evt) {
    var msg;
    try { msg = JSON.parse(evt.data); } catch (e) { return; }
    dlog('RN cmd: ' + msg.action);

    if (msg.action === 'start') {
      startRecognition();
    } else if (msg.action === 'stop') {
      wantRunning = false;
      try { recognition.stop(); } catch (e) {}
    } else if (msg.action === 'reset') {
      wantRunning = false;
      try { recognition.stop(); } catch (e) {}
      pointer = 0;
      lastHighlighted = -1;
      totalSpokenWordsLocked = 0;
      cumulativeFinalText = '';
      wordNodes.forEach(function (n) {
        if (n) {
          n.classList.remove('done');
          n.classList.remove('current');
        }
      });
      // reset to page 1
      pageElements.forEach(function (el, idx) {
        el.classList.remove('leaving');
        if (idx === 0) el.classList.add('active');
        else el.classList.remove('active');
      });
      currentPageIdx = 0;
      updatePageIndicator(0);
    } else if (msg.action === 'showDebug') {
      SHOW_DEBUG = true;
    } else if (msg.action === 'hideDebug') {
      SHOW_DEBUG = false;
      debugEl.classList.remove('on');
    }
  }

  postToRN({ type: 'ready' });
  dlog('Ready — tap Play to start', 'ok');
})();
</script>
</body>
</html>`;
}