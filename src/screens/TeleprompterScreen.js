import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScripts } from '../context/ScriptContext';
import CameraView from '../components/CameraView';
import Icon from '../components/Icon';
import {
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { Theme } from '../theme/Theme';
import SpeechRecognition from '../modules/SpeechRecognition';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LOCALE_MAP = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  pt: 'pt-BR', ru: 'ru-RU', ar: 'ar-SA', ur: 'ur-PK', hi: 'hi-IN',
  zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', tr: 'tr-TR',
};

function toLocale(langCode) {
  if (!langCode) return 'en-US';
  if (langCode.includes('-')) return langCode;
  return LOCALE_MAP[langCode] || 'en-US';
}

const PROMPTER_BG = '#1A1A2E';

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '').trim();
}

function tokenize(text) {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

function buildPagesFromScript(content) {
  const raw = content.split(/(\s+)/);
  const items = [];
  let wordIdx = 0;
  raw.forEach(chunk => {
    if (/^\s+$/.test(chunk)) {
      items.push({ type: 'space', text: chunk });
    } else if (chunk.length > 0) {
      items.push({
        type: 'word',
        text: chunk,
        normalized: normalizeWord(chunk),
        globalIndex: wordIdx,
      });
      wordIdx++;
    }
  });
  const totalWords = wordIdx;

  const TARGET_PAGES = 6;
  const MIN = 20, MAX = 80;
  let wordsPerPage = Math.ceil(totalWords / TARGET_PAGES);
  if (wordsPerPage < MIN) wordsPerPage = MIN;
  if (wordsPerPage > MAX) wordsPerPage = MAX;
  const totalPages = Math.max(1, Math.ceil(totalWords / wordsPerPage));

  const pages = [];
  for (let p = 0; p < totalPages; p++) pages.push({ items: [], firstWord: -1, lastWord: -1 });

  let currentPage = 0;
  items.forEach(item => {
    if (item.type === 'word') {
      const pageNum = Math.floor(item.globalIndex / wordsPerPage);
      currentPage = pageNum;
      if (pages[pageNum].firstWord === -1) pages[pageNum].firstWord = item.globalIndex;
      pages[pageNum].lastWord = item.globalIndex;
      pages[pageNum].items.push(item);
    } else {
      if (pages[currentPage]) pages[currentPage].items.push(item);
    }
  });

  const normalizedWords = new Array(totalWords);
  items.forEach(it => {
    if (it.type === 'word') normalizedWords[it.globalIndex] = it.normalized;
  });

  return { pages, totalPages, totalWords, normalizedWords, wordsPerPage };
}

export default function TeleprompterScreen({ navigation, route }) {
  const { getScript, settings, addRecording } = useScripts();
  const script = getScript(route.params.scriptId);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('scroll');
  const [playState, setPlayState] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState(settings.cameraPosition);
  const [recognizing, setRecognizing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState(-1);
  const [debugLines, setDebugLines] = useState([]);

  const [langPackState, setLangPackState] = useState('idle');
  const [langPackInfo, setLangPackInfo] = useState(null);

  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicrophonePermission,
  } = useMicrophonePermission();
  const hasAllPermissions = hasCameraPermission && hasMicPermission;

  useEffect(() => {
    async function requestPermissions() {
      if (!hasCameraPermission) await requestCameraPermission();
      if (!hasMicPermission) await requestMicrophonePermission();
    }
    requestPermissions();
  }, []);

  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const contentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  const pointerRef = useRef(0);
  const cumulativeFinalRef = useRef('');
  const totalSpokenLockedRef = useRef(0);
  const currentPageIdxRef = useRef(0);
  const confirmedPointerRef = useRef(0);

  // Tracks whether we've actually called SpeechRecognition.start() natively
  const nativeStartedRef = useRef(false);

  const recordingStartTimeRef = useRef(null);
  const MIN_RECORDING_MS = 1500;

  const cameraHeight = SCREEN_HEIGHT * settings.cameraRatio;
  const isRTL = script ? ['ar', 'ur'].includes(script.language) : false;
  const scriptLocale = toLocale(script?.language);

  const pagesData = useMemo(
    () => script
      ? buildPagesFromScript(script.content)
      : { pages: [], totalPages: 0, totalWords: 0, normalizedWords: [] },
    [script],
  );

  useEffect(() => {
    currentPageIdxRef.current = currentPageIdx;
  }, [currentPageIdx]);

  const addDebug = useCallback((msg, isErr = false) => {
    setDebugLines(prev => [...prev, { msg, isErr, ts: Date.now() }].slice(-5));
    console.log('[SPEECH]', msg);
  }, []);

  // ── Language pack check ────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'voice') {
      setLangPackState('idle');
      return;
    }
    if (langPackState !== 'idle') return;
    (async () => {
      setLangPackState('checking');
      try {
        const info = await SpeechRecognition.checkLanguagePack(scriptLocale);
        setLangPackInfo(info);
        addDebug('Pack: ' + info.status);
        if (info.status === 'installed') setLangPackState('installed');
        else if (info.status === 'available-to-download') setLangPackState('needs-download');
        else setLangPackState('unsupported');
      } catch (e) {
        addDebug('Pack error: ' + e.message, true);
        setLangPackState('unsupported');
      }
    })();
  }, [mode, scriptLocale, langPackState, addDebug]);

  async function handleDownloadLanguagePack() {
    setLangPackState('downloading');
    try {
      const result = await SpeechRecognition.downloadLanguagePack(scriptLocale);
      addDebug('DL: ' + result.status);
      if (result.status === 'downloaded' || result.status === 'scheduled') {
        setTimeout(async () => {
          const info = await SpeechRecognition.checkLanguagePack(scriptLocale);
          setLangPackInfo(info);
          setLangPackState(info.status === 'installed' ? 'installed' : 'needs-download');
        }, 1500);
      } else {
        setLangPackState('failed');
      }
    } catch (e) {
      addDebug('DL failed: ' + e.message, true);
      setLangPackState('failed');
    }
  }

  // ── Matching algorithm ────────────────────────────────────────────────
  function matchWords(spokenWords, startPointer, allowRevert) {
    const { normalizedWords, totalWords } = pagesData;
    const LOOKAHEAD = 3;
    const MIN_PREFIX_LEN = 4;

    let pointer = startPointer;
    if (allowRevert && pointer > confirmedPointerRef.current) {
      pointer = confirmedPointerRef.current;
    }

    for (let s = 0; s < spokenWords.length; s++) {
      const w = spokenWords[s];
      if (!w || w.length < 1) continue;

      let found = -1;
      const limit = Math.min(pointer + LOOKAHEAD, totalWords);

      for (let j = pointer; j < limit; j++) {
        if (normalizedWords[j] === w) {
          found = j;
          break;
        }
      }

      if (found < 0 && w.length >= MIN_PREFIX_LEN) {
        for (let j = pointer; j < limit; j++) {
          const scriptWord = normalizedWords[j];
          if (scriptWord && scriptWord.length >= MIN_PREFIX_LEN) {
            if (scriptWord.startsWith(w.slice(0, MIN_PREFIX_LEN)) ||
                w.startsWith(scriptWord.slice(0, MIN_PREFIX_LEN))) {
              found = j;
              break;
            }
          }
        }
      }

      if (found >= 0) {
        pointer = found + 1;
      }
    }
    return pointer;
  }

  const applyMatch = useCallback((spokenText, isFinal) => {
    const spoken = tokenize(spokenText);
    if (spoken.length === 0) return;

    if (isFinal) {
      const newPointer = matchWords(spoken, pointerRef.current, false);
      if (newPointer > pointerRef.current) {
        pointerRef.current = newPointer;
        confirmedPointerRef.current = newPointer;
        setHighlightedWordIdx(newPointer - 1);
        maybeAdvancePage(newPointer - 1);
      } else {
        confirmedPointerRef.current = pointerRef.current;
      }
    } else {
      const tentativePointer = matchWords(spoken, confirmedPointerRef.current, true);
      if (tentativePointer > pointerRef.current) {
        pointerRef.current = tentativePointer;
        setHighlightedWordIdx(tentativePointer - 1);
        maybeAdvancePage(tentativePointer - 1);
      }
    }
  }, [pagesData]);

  function maybeAdvancePage(newHighlight) {
    const { pages, totalPages } = pagesData;
    const pageIdx = currentPageIdxRef.current;
    const currentPage = pages[pageIdx];
    if (currentPage && newHighlight >= currentPage.lastWord && pageIdx < totalPages - 1) {
      setTimeout(() => {
        setCurrentPageIdx(prev => {
          const next = Math.min(prev + 1, totalPages - 1);
          currentPageIdxRef.current = next;
          return next;
        });
      }, 500);
    }
  }

  // ── Speech listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubStart  = SpeechRecognition.addListener('start',  () => { setRecognizing(true);  addDebug('● Listening'); });
    const unsubEnd    = SpeechRecognition.addListener('end',    () => { setRecognizing(false); addDebug('◼ Ended'); });
    const unsubError  = SpeechRecognition.addListener('error',  ev  => { addDebug('ERR: ' + ev?.error, true); });
    const unsubLog    = SpeechRecognition.addListener('log',    ev  => { addDebug(ev?.message || ''); });
    const unsubResult = SpeechRecognition.addListener('result', ev  => {
      if (!ev?.transcript) return;
      if (ev.isFinal) {
        addDebug('✓ ' + ev.transcript.slice(0, 30));
        cumulativeFinalRef.current += ev.transcript + ' ';
        const allWords = tokenize(cumulativeFinalRef.current);
        const newWords = allWords.slice(totalSpokenLockedRef.current);
        totalSpokenLockedRef.current = allWords.length;
        if (newWords.length > 0) applyMatch(newWords.join(' '), true);
      } else {
        addDebug('~ ' + ev.transcript.slice(0, 25));
        applyMatch(ev.transcript, false);
      }
    });
    return () => { unsubStart(); unsubEnd(); unsubResult(); unsubError(); unsubLog(); };
  }, [applyMatch, addDebug]);

  async function startRecognition() {
    const granted = await SpeechRecognition.requestMicPermission();
    if (!granted) { addDebug('Mic denied', true); return; }
    try {
      await SpeechRecognition.start({ lang: scriptLocale, onDevice: true });
      addDebug('start() OK');
    } catch (err) {
      addDebug('start() err: ' + err.message, true);
    }
  }

  function stopRecognition() {
    SpeechRecognition.stop().catch(() => {});
  }

  // ── Scroll loop ─────────────────────────────────────────────────────────
  const startScrollLoop = useCallback(() => {
    function animate(timestamp) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      scrollY.current += (settings.scrollSpeed / 1000) * delta;
      const maxScroll = contentHeight.current - scrollViewHeight.current;
      if (scrollY.current >= maxScroll) {
        scrollY.current = maxScroll;
        setPlayState('finished');
        return;
      }
      scrollRef.current?.scrollTo({ y: scrollY.current, animated: false });
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }, [settings.scrollSpeed]);

  function stopScrollLoop() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    lastTimeRef.current = null;
  }

  useEffect(() => {
    if (mode === 'scroll' && playState === 'playing') startScrollLoop();
    else stopScrollLoop();
    return stopScrollLoop;
  }, [playState, startScrollLoop, mode]);

  // ── Voice lifecycle — only start/stop on actual state transitions ────
  useEffect(() => {
    const shouldBeListening =
      mode === 'voice' &&
      langPackState === 'installed' &&
      playState === 'playing';

    if (shouldBeListening && !nativeStartedRef.current) {
      nativeStartedRef.current = true;
      const t = setTimeout(() => {
        if (nativeStartedRef.current) startRecognition();
      }, 250);
      return () => clearTimeout(t);
    } else if (!shouldBeListening && nativeStartedRef.current) {
      nativeStartedRef.current = false;
      stopRecognition();
    }
  }, [mode, playState, langPackState]);

  function resetVoiceState() {
    pointerRef.current = 0;
    confirmedPointerRef.current = 0;
    cumulativeFinalRef.current = '';
    totalSpokenLockedRef.current = 0;
    currentPageIdxRef.current = 0;
    setHighlightedWordIdx(-1);
    setCurrentPageIdx(0);
  }

  // ── Buttons ─────────────────────────────────────────────────────────────
  function safeStopRecording() {
    if (!isRecording) return;
    const elapsed = Date.now() - (recordingStartTimeRef.current ?? 0);
    const delay = Math.max(0, MIN_RECORDING_MS - elapsed);
    setTimeout(() => setIsRecording(false), delay);
  }

  function handleMainButton() {
    if (mode === 'voice' && langPackState !== 'installed') return;
    if (playState === 'idle' || playState === 'paused') {
      if (!isRecording) { recordingStartTimeRef.current = Date.now(); setIsRecording(true); }
      setPlayState('playing');
    } else if (playState === 'playing') {
      setPlayState('paused');
      safeStopRecording();
    } else if (playState === 'finished') {
      scrollY.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (mode === 'voice') resetVoiceState();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setPlayState('playing');
    }
  }

  function handleReset() {
    stopScrollLoop();
    stopRecognition();
    nativeStartedRef.current = false;
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    resetVoiceState();
    setPlayState('idle');
    safeStopRecording();
  }

  function handleFlipCamera() {
    setCameraPosition(prev => prev === 'front' ? 'back' : 'front');
  }

  function handleModeSwitch(newMode) {
    if (newMode === mode) return;
    handleReset();
    setMode(newMode);
  }

  function getMainButtonIcon() {
    if (playState === 'playing') return <Icon name="pause" size={36} color={Theme.colors.primary} />;
    if (playState === 'finished') return <Icon name="replay" size={32} color="#FFFFFF" />;
    return <Icon name="play" size={36} color="#FFFFFF" />;
  }

  // ── Guards ─────────────────────────────────────────────────────────────
  if (!script) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Script not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasAllPermissions) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Permissions Required</Text>
        <Text style={styles.permissionMessage}>
          Camera and microphone access are needed to use the teleprompter.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={async () => {
            if (!hasCameraPermission) await requestCameraPermission();
            if (!hasMicPermission) await requestMicrophonePermission();
          }}
        >
          <Text style={styles.permissionBtnText}>Grant Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionSkipBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.permissionSkipText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPage = pagesData.pages[currentPageIdx];
  const cameraAudioEnabled = true;

  function renderLangPackOverlay() {
    if (langPackState === 'installed' || langPackState === 'idle') return null;
    let title = '', message = '', action = null;
    if (langPackState === 'checking') {
      title = 'Checking language support…';
      message = 'Looking for on-device model for ' + scriptLocale;
      action = <ActivityIndicator size="large" color={Theme.colors.primary} />;
    } else if (langPackState === 'needs-download') {
      title = 'Language pack required';
      message = `Download the on-device speech model for ${scriptLocale}.`;
      action = (
        <TouchableOpacity style={styles.langBtn} onPress={handleDownloadLanguagePack}>
          <Text style={styles.langBtnText}>Download</Text>
        </TouchableOpacity>
      );
    } else if (langPackState === 'downloading') {
      title = 'Downloading…';
      message = 'Installing the language pack.';
      action = <ActivityIndicator size="large" color={Theme.colors.primary} />;
    } else if (langPackState === 'failed') {
      title = 'Download failed';
      message = 'Could not download. Try again or use Scroll mode.';
      action = (
        <TouchableOpacity style={styles.langBtn} onPress={handleDownloadLanguagePack}>
          <Text style={styles.langBtnText}>Try Again</Text>
        </TouchableOpacity>
      );
    } else if (langPackState === 'unsupported') {
      title = 'Voice Track not available';
      message = langPackInfo?.reason || 'On-device recognition not supported.';
      action = (
        <TouchableOpacity style={styles.langBtnSecondary} onPress={() => handleModeSwitch('scroll')}>
          <Text style={styles.langBtnSecondaryText}>Use Scroll Mode</Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.langOverlay}>
        <Text style={styles.langTitle}>{title}</Text>
        <Text style={styles.langMessage}>{message}</Text>
        <View style={{ marginTop: 24 }}>{action}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={[styles.cameraSection, { height: cameraHeight }]}>
        <CameraView
          height={cameraHeight}
          cameraPosition={cameraPosition}
          isRecording={isRecording}
          audioEnabled={cameraAudioEnabled}
          onRecordingStart={() => { recordingStartTimeRef.current = Date.now(); }}
          onRecordingStop={async (video) => {
            setIsRecording(false);
            if (video) {
              await addRecording({
                path: video.path,
                duration: video.duration ?? 0,
                scriptTitle: script.title,
              });
            }
          }}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerHandle} />
      </View>

      <View style={styles.prompterSection}>
        {mode === 'scroll' ? (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            scrollEnabled={playState !== 'playing'}
            showsVerticalScrollIndicator={false}
            onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            onContentSizeChange={(_, h) => { contentHeight.current = h; }}
            onLayout={e => { scrollViewHeight.current = e.nativeEvent.layout.height; }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.prompterContent}
          >
            <Text
              style={[
                styles.scriptText,
                {
                  fontSize: settings.fontSize,
                  color: settings.fontColor || '#FFFFFF',
                  textAlign: settings.textAlign,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                  transform: settings.mirrorText ? [{ scaleX: -1 }] : [],
                  lineHeight: settings.fontSize * 1.6,
                },
              ]}
            >
              {script.content}
            </Text>
            <View style={{ height: 300 }} />
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {langPackState === 'installed' ? (
              <>
                <View style={styles.pageIndicator}>
                  <Text style={styles.pageIndicatorText}>
                    Page {currentPageIdx + 1} / {pagesData.totalPages}
                  </Text>
                  <TouchableOpacity
                    style={styles.debugToggle}
                    onPress={() => setShowDebug(s => !s)}
                  >
                    <Text style={styles.debugToggleText}>
                      {showDebug ? '▼ debug' : '▲ debug'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.pageContent}>
                  <Text
                    style={{
                      fontSize: settings.fontSize,
                      textAlign: settings.textAlign,
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                      transform: settings.mirrorText ? [{ scaleX: -1 }] : [],
                      lineHeight: settings.fontSize * 1.6,
                      fontFamily: Theme.fonts.medium,
                    }}
                  >
                    {currentPage?.items.map((item, idx) => {
                      if (item.type === 'space') {
                        return <Text key={`sp-${idx}`} style={{ color: '#FFFFFF' }}>{item.text}</Text>;
                      }
                      const isSpoken  = item.globalIndex <= highlightedWordIdx;
                      const isCurrent = item.globalIndex === highlightedWordIdx;
                      return (
                        <Text
                          key={`w-${item.globalIndex}`}
                          style={{
                            color: isSpoken ? Theme.colors.primary : '#FFFFFF',
                            opacity: isSpoken ? 1 : 0.4,
                            fontFamily: isCurrent ? Theme.fonts.semiBold : Theme.fonts.medium,
                          }}
                        >
                          {item.text}
                        </Text>
                      );
                    })}
                  </Text>
                </View>

                {showDebug && (
                  <View style={styles.debugBox}>
                    <Text style={styles.debugTitle}>
                      ptr:{pointerRef.current} cf:{confirmedPointerRef.current} hi:{highlightedWordIdx} {recognizing ? '🎙' : '○'}
                    </Text>
                    {debugLines.map((line, idx) => (
                      <Text
                        key={idx}
                        style={[styles.debugLine, line.isErr && styles.debugLineErr]}
                        numberOfLines={1}
                      >
                        {line.msg}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            ) : (
              renderLangPackOverlay()
            )}
          </View>
        )}
      </View>

      {/* ── Floating controls — ALWAYS VISIBLE ──────────────────── */}
      <View style={styles.controlsOverlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.scriptTitle} numberOfLines={1}>{script.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'scroll' && styles.modeBtnActive]}
              onPress={() => handleModeSwitch('scroll')}
            >
              <Text style={[styles.modeBtnText, mode === 'scroll' && styles.modeBtnTextActive]}>
                Scroll
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'voice' && styles.modeBtnActive]}
              onPress={() => handleModeSwitch('voice')}
            >
              <Text style={[styles.modeBtnText, mode === 'voice' && styles.modeBtnTextActive]}>
                Voice Track
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'voice' && recognizing && (
            <View style={styles.listeningPill}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningText}>Listening…</Text>
            </View>
          )}

          <View style={styles.playbackRow}>
            <TouchableOpacity style={styles.sideBtn} onPress={handleReset}>
              <Icon name="replay" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playBtn,
                isRecording && styles.playBtnRecording,
                playState === 'playing' && styles.playBtnActive,
                (mode === 'voice' && langPackState !== 'installed') && styles.playBtnDisabled,
              ]}
              onPress={handleMainButton}
              disabled={mode === 'voice' && langPackState !== 'installed'}
            >
              {getMainButtonIcon()}
              {isRecording && playState !== 'playing' && <View style={styles.recIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.sideBtn} onPress={handleFlipCamera}>
              <Icon name="flip-camera" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PROMPTER_BG },

  permissionContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, backgroundColor: Theme.colors.background,
  },
  permissionTitle: {
    color: Theme.colors.primary, fontFamily: Theme.fonts.semiBold,
    fontSize: 22, marginBottom: 14, textAlign: 'center',
  },
  permissionMessage: {
    color: Theme.colors.secondary, fontFamily: Theme.fonts.regular,
    fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  permissionBtn: {
    backgroundColor: Theme.colors.primary, paddingVertical: 14,
    paddingHorizontal: 36, borderRadius: 30, marginBottom: 16,
  },
  permissionBtnText: { color: '#FFFFFF', fontFamily: Theme.fonts.semiBold, fontSize: 16 },
  permissionSkipBtn: { paddingVertical: 10 },
  permissionSkipText: { color: Theme.colors.primary, fontFamily: Theme.fonts.medium, fontSize: 15 },
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Theme.colors.background,
  },
  errorText: { color: Theme.colors.text, fontFamily: Theme.fonts.medium, fontSize: 18, marginBottom: 16 },
  backLink: { color: Theme.colors.primary, fontFamily: Theme.fonts.medium, fontSize: 16 },

  cameraSection: { overflow: 'hidden', backgroundColor: '#000' },
  divider: {
    height: 28, backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  dividerHandle: {
    width: 48, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)',
  },

  prompterSection: { flex: 1, overflow: 'hidden', backgroundColor: PROMPTER_BG },
  prompterContent: { paddingHorizontal: 28, paddingTop: 4 },
  scriptText: { fontFamily: Theme.fonts.medium },

  pageIndicator: {
    paddingTop: 6, paddingHorizontal: 20, paddingBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pageIndicatorText: {
    color: Theme.colors.primary, fontFamily: Theme.fonts.semiBold,
    fontSize: 13, letterSpacing: 0.5, opacity: 0.85,
  },
  debugToggle: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  debugToggleText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' },
  pageContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 240,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  debugBox: {
    position: 'absolute', bottom: 240, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    maxHeight: 100,
  },
  debugTitle: {
    color: Theme.colors.primary, fontSize: 10,
    fontFamily: Theme.fonts.semiBold, marginBottom: 2,
  },
  debugLine: { color: '#FFFFFF', fontSize: 9, lineHeight: 12 },
  debugLineErr: { color: '#ff6b6b' },

  langOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  langTitle: {
    color: Theme.colors.primary, fontFamily: Theme.fonts.semiBold,
    fontSize: 22, textAlign: 'center', marginBottom: 14,
  },
  langMessage: {
    color: '#FFFFFF', fontFamily: Theme.fonts.regular,
    fontSize: 15, textAlign: 'center', lineHeight: 22, opacity: 0.85,
  },
  langBtn: {
    backgroundColor: Theme.colors.primary, paddingVertical: 14,
    paddingHorizontal: 36, borderRadius: 30, elevation: 6,
  },
  langBtnText: { color: '#FFFFFF', fontFamily: Theme.fonts.semiBold, fontSize: 16 },
  langBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 14,
    paddingHorizontal: 36, borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  langBtnSecondaryText: { color: '#FFFFFF', fontFamily: Theme.fonts.semiBold, fontSize: 16 },

  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 10, backgroundColor: 'rgba(26, 26, 46, 0.85)',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontSize: 18, fontFamily: Theme.fonts.semiBold },
  scriptTitle: {
    flex: 1, color: '#FFFFFF', fontFamily: Theme.fonts.semiBold,
    fontSize: 16, textAlign: 'center', marginHorizontal: 8,
  },
  bottomControls: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    paddingHorizontal: 20, paddingTop: 14,
  },
  modeToggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 4, marginBottom: 12, alignSelf: 'center',
  },
  modeBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  modeBtnActive: { backgroundColor: Theme.colors.primary },
  modeBtnText: {
    color: 'rgba(255,255,255,0.7)', fontFamily: Theme.fonts.medium, fontSize: 13,
  },
  modeBtnTextActive: { color: '#FFFFFF', fontFamily: Theme.fonts.semiBold },
  listeningPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    backgroundColor: 'rgba(94, 23, 235, 0.3)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, marginBottom: 10, gap: 6,
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.primary },
  listeningText: { color: '#FFFFFF', fontFamily: Theme.fonts.medium, fontSize: 12 },
  playbackRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  playBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Theme.colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  playBtnActive: { backgroundColor: '#FFFFFF' },
  playBtnRecording: {
    backgroundColor: Theme.colors.primaryDark,
    shadowOpacity: 0.9,
  },
  playBtnDisabled: { opacity: 0.4 },
  recIndicator: {
    position: 'absolute', top: 10, right: 10, width: 10, height: 10,
    borderRadius: 5, backgroundColor: Theme.colors.error,
  },
  sideBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});