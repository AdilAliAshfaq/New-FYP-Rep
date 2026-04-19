// Returns a complete HTML document string that renders the script,
// runs Web Speech API recognition, and highlights matched words.
//
// All matching happens INSIDE the WebView — no bridge round-trips per word.

export function buildVoiceTemplate({
  scriptContent,
  lang = 'en-US',
  fontSize = 28,
  fontColor = '#ffffff',
  highlightColor = '#00fccf',
  backgroundColor = 'transparent',
  textAlign = 'center',
  mirror = false,
  isRTL = false,
  lineHeight = 1.6,
}) {
  const safeScript = JSON.stringify(scriptContent);
  const safeLang = JSON.stringify(lang);

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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  #scroller {
    height: 100%;
    overflow-y: auto;
    padding: 24px 28px 200px;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    scrollbar-width: none;
  }
  #scroller::-webkit-scrollbar { display: none; }
  #script {
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
  .w.done {
    color: ${highlightColor};
    opacity: 1;
  }
  .w.current {
    color: ${highlightColor};
    opacity: 1;
    text-shadow: 0 0 12px ${highlightColor}66;
  }
  #debug {
    position: fixed;
    top: 8px; left: 8px; right: 8px;
    background: rgba(0,0,0,0.7);
    color: #fff;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-family: monospace;
    z-index: 1000;
    display: none;
    max-height: 30vh;
    overflow-y: auto;
  }
  #debug.on { display: block; }
  #debug .err { color: #ff6b6b; }
  #debug .ok { color: ${highlightColor}; }
</style>
</head>
<body>
  <div id="debug"></div>
  <div id="scroller"><div id="script"></div></div>

<script>
(function () {
  var SCRIPT_TEXT = ${safeScript};
  var LANG = ${safeLang};

  // ── Bridge to RN ──────────────────────────────────────────────────────
  function postToRN(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
    }
  }

  // ── In-WebView debug overlay (visible on screen) ─────────────────────
  var debugEl = document.getElementById('debug');
  function dlog(msg, type) {
    var line = document.createElement('div');
    if (type) line.className = type;
    line.textContent = msg;
    debugEl.appendChild(line);
    debugEl.classList.add('on');
    // keep only last 8 lines
    while (debugEl.children.length > 8) debugEl.removeChild(debugEl.firstChild);
    postToRN({ type: 'log', message: msg, level: type || 'info' });
  }

  // Catch everything
  window.addEventListener('error', function (e) {
    dlog('JS ERROR: ' + (e.message || e.error), 'err');
  });
  window.onerror = function (msg) {
    dlog('ONERROR: ' + msg, 'err');
  };

  dlog('WebView loaded, lang=' + LANG, 'ok');

  // ── Tokenize & render script ──────────────────────────────────────────
  function normalize(w) {
    return w.toLowerCase()
            .replace(/[^\\p{L}\\p{N}']/gu, '')
            .trim();
  }

  var scriptEl = document.getElementById('script');
  var scroller = document.getElementById('scroller');
  var wordNodes = [];
  var normalized = [];

  (function renderScript() {
    var parts = SCRIPT_TEXT.split(/(\\s+)/);
    parts.forEach(function (chunk) {
      if (/^\\s+$/.test(chunk)) {
        scriptEl.appendChild(document.createTextNode(chunk));
      } else if (chunk.length > 0) {
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = chunk;
        scriptEl.appendChild(span);
        wordNodes.push(span);
        normalized.push(normalize(chunk));
      }
    });
    dlog('Rendered ' + wordNodes.length + ' words', 'ok');
  })();

  // ── Matching state ────────────────────────────────────────────────────
  var pointer = 0;
  var totalSpokenWordsLocked = 0;
  var cumulativeFinalText = '';
  var LOOKAHEAD = 6;
  var lastDone = -1;

  function advancePointer(spokenWords) {
    for (var s = 0; s < spokenWords.length; s++) {
      var w = spokenWords[s];
      if (!w) continue;
      var found = -1;
      var limit = Math.min(pointer + LOOKAHEAD, normalized.length);
      for (var j = pointer; j < limit; j++) {
        if (normalized[j] === w) { found = j; break; }
        if (normalized[j].length > 2 && w.length > 2 &&
            (normalized[j].indexOf(w) === 0 || w.indexOf(normalized[j]) === 0)) {
          found = j;
          break;
        }
      }
      if (found >= 0) pointer = found + 1;
    }
    render();
  }

  function tokenize(text) {
    return text.split(/\\s+/).map(normalize).filter(Boolean);
  }

  function render() {
    var targetDone = pointer - 1;
    if (targetDone === lastDone) return;
    if (targetDone > lastDone) {
      for (var i = lastDone + 1; i <= targetDone; i++) {
        if (wordNodes[i]) wordNodes[i].classList.add('done');
      }
    }
    wordNodes.forEach(function (n) { n.classList.remove('current'); });
    if (wordNodes[targetDone]) {
      wordNodes[targetDone].classList.add('current');
      scrollIntoView(wordNodes[targetDone]);
    }
    lastDone = targetDone;
    postToRN({ type: 'progress', index: targetDone, total: wordNodes.length });
  }

  function scrollIntoView(node) {
    if (!node) return;
    var rect = node.getBoundingClientRect();
    var viewH = window.innerHeight;
    if (rect.top < viewH * 0.2 || rect.top > viewH * 0.6) {
      var targetScroll = scroller.scrollTop + rect.top - viewH * 0.4;
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }

  // ── Speech Recognition ────────────────────────────────────────────────
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    dlog('SpeechRecognition API NOT AVAILABLE in this WebView', 'err');
    postToRN({ type: 'unsupported' });
    return;
  }
  dlog('SpeechRecognition API is available', 'ok');

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

  recognition.onaudiostart = function () { dlog('audio start'); };
  recognition.onspeechstart = function () { dlog('speech detected'); };
  recognition.onspeechend = function () { dlog('speech ended'); };
  recognition.onaudioend = function () { dlog('audio end'); };

  recognition.onend = function () {
    isStarted = false;
    dlog('Recognition ENDED, wantRunning=' + wantRunning);
    postToRN({ type: 'end' });
    if (wantRunning) {
      setTimeout(function () {
        if (wantRunning && !isStarted) {
          try {
            recognition.start();
            dlog('Auto-restart attempted');
          } catch (e) {
            dlog('Restart failed: ' + e.message, 'err');
          }
        }
      }, 300);
    }
  };

  recognition.onerror = function (e) {
    dlog('Recognition ERROR: ' + e.error + ' — ' + (e.message || ''), 'err');
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
      dlog('FINAL: "' + finalText.trim() + '"');
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

  // ── RN -> WebView commands ────────────────────────────────────────────
  document.addEventListener('message', handleRNMessage);
  window.addEventListener('message', handleRNMessage);

  function handleRNMessage(evt) {
    var msg;
    try { msg = JSON.parse(evt.data); } catch (e) { return; }
    dlog('RN cmd: ' + msg.action);

    if (msg.action === 'start') {
      wantRunning = true;
      try {
        recognition.start();
        dlog('recognition.start() called', 'ok');
      } catch (e) {
        dlog('start() threw: ' + e.message, 'err');
      }
    } else if (msg.action === 'stop') {
      wantRunning = false;
      try { recognition.stop(); } catch (e) {}
    } else if (msg.action === 'reset') {
      wantRunning = false;
      try { recognition.stop(); } catch (e) {}
      pointer = 0;
      lastDone = -1;
      totalSpokenWordsLocked = 0;
      cumulativeFinalText = '';
      wordNodes.forEach(function (n) {
        n.classList.remove('done');
        n.classList.remove('current');
      });
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (msg.action === 'hideDebug') {
      debugEl.classList.remove('on');
      debugEl.style.display = 'none';
    }
  }

  postToRN({ type: 'ready' });
  dlog('Ready — waiting for start command', 'ok');
})();
</script>
</body>
</html>`;
}