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

const TIMER_OPTIONS = [0, 3, 5, 7, 10]; 

function normalizeWord(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '').trim();
}

function tokenize(text) {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

export default function TeleprompterScreen({ navigation, route }) {
  const { getScript, settings, updateSettings, addRecording } = useScripts();
  const script = getScript(route.params.scriptId);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('scroll');
  const [playState, setPlayState] = useState('idle'); 
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState(settings.cameraPosition);
  const [recognizing, setRecognizing] = useState(false);
  
  // ── Global Timer State ──
  const currentTimer = settings.countdownTimer !== undefined ? settings.countdownTimer : 3;
  const [countdown, setCountdown] = useState(0);

  // ── Layout & Tracking State ──
  const [layoutReady, setLayoutReady] = useState(false);
  const [wordToLineMap, setWordToLineMap] = useState([]); 
  const currentLineIdxRef = useRef(-1);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState(-1);

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
  const confirmedPointerRef = useRef(0);

  const nativeStartedRef = useRef(false);
  const isInitialPlayRef = useRef(true); 
  const recordingStartTimeRef = useRef(null);
  const MIN_RECORDING_MS = 1500;

  const cameraHeight = SCREEN_HEIGHT * settings.cameraRatio;
  const isRTL = script ? ['ar', 'ur'].includes(script.language) : false;
  const scriptLocale = toLocale(script?.language);

  function cycleTimer() {
    const idx = TIMER_OPTIONS.indexOf(currentTimer);
    const nextIdx = (idx + 1) % TIMER_OPTIONS.length;
    updateSettings({ countdownTimer: TIMER_OPTIONS[nextIdx] });
  }

  // ── Countdown Timer Logic ──
  useEffect(() => {
    if (playState === 'counting_down' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (playState === 'counting_down' && countdown === 0) {
      executePlay();
    }
  }, [playState, countdown]);

  function executePlay() {
    if (playState === 'finished') {
      scrollY.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (mode === 'voice') resetVoiceState();
    }
    recordingStartTimeRef.current = Date.now();
    setIsRecording(true);
    isInitialPlayRef.current = true; 
    setPlayState('playing');
  }

  // ── 1. Create Logical Array for Strict Matching ──────────────────────
  const wordsData = useMemo(() => {
    if (!script) return { items: [], totalWords: 0, normalizedWords: [] };
    const raw = script.content.split(/(\s+)/);
    const items = [];
    const normalizedWords = [];
    let wordIdx = 0;

    raw.forEach(chunk => {
      if (/^\s+$/.test(chunk)) {
        items.push({ type: 'space', text: chunk, wordIdx: wordIdx });
      } else if (chunk.length > 0) {
        const norm = normalizeWord(chunk);
        items.push({ type: 'word', text: chunk, normalized: norm, wordIdx: wordIdx });
        normalizedWords.push(norm);
        wordIdx++;
      }
    });
    return { items, totalWords: wordIdx, normalizedWords };
  }, [script]);

  useEffect(() => {
    setLayoutReady(false);
    setWordToLineMap([]);
    currentLineIdxRef.current = -1;
  }, [script?.content, settings.fontSize, settings.textAlign, settings.mirrorText]);

  // ── 2. The Bulletproof Layout Measurer ───────────────────────────────
  const handleTextLayout = useCallback((e) => {
    if (layoutReady) return;
    const lines = e.nativeEvent.lines;
    const map = [];
    let wordCounter = 0;
    
    lines.forEach((line, lineIdx) => {
      const wordsInLine = line.text.split(/\s+/).filter(Boolean).length;
      for (let i = 0; i < wordsInLine; i++) {
        map[wordCounter++] = { lineIdx, y: line.y };
      }
    });
    
    setWordToLineMap(map);
    setLayoutReady(true);
  }, [layoutReady]);

  // ── 3. Strict Top-Line Snapping ──────────────────────────────────────
  useEffect(() => {
    if (mode === 'voice' && highlightedWordIdx >= 0 && scrollRef.current && layoutReady) {
      const lineInfo = wordToLineMap[highlightedWordIdx];
      
      if (lineInfo && lineInfo.lineIdx !== currentLineIdxRef.current) {
        currentLineIdxRef.current = lineInfo.lineIdx;
        scrollRef.current.scrollTo({ y: Math.max(0, lineInfo.y), animated: true });
      }
    }
  }, [highlightedWordIdx, mode, wordToLineMap, layoutReady]);

  // ── 4. Strict Matching Algorithm ───────────────────────────────────────
  function matchWords(spokenWords, startPointer, allowRevert) {
    const { normalizedWords, totalWords } = wordsData;
    let pointer = startPointer;
    
    if (allowRevert && pointer > confirmedPointerRef.current) {
      pointer = confirmedPointerRef.current;
    }

    for (let s = 0; s < spokenWords.length; s++) {
      const w = spokenWords[s];
      if (!w || w.length < 1) continue;

      let found = -1;
      const limit = Math.min(pointer + 3, totalWords); 

      for (let j = pointer; j < limit; j++) {
        if (normalizedWords[j] === w) {
          if (j === pointer || (j === pointer + 1 && w.length >= 3) || (j === pointer + 2 && w.length >= 5)) {
            found = j;
            break;
          }
        }
      }

      if (found < 0 && w.length >= 4 && normalizedWords[pointer] && normalizedWords[pointer].startsWith(w)) {
        found = pointer;
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
      } else {
        confirmedPointerRef.current = pointerRef.current;
      }
    } else {
      const tentativePointer = matchWords(spoken, confirmedPointerRef.current, true);
      if (tentativePointer > pointerRef.current) {
        pointerRef.current = tentativePointer;
        setHighlightedWordIdx(tentativePointer - 1);
      }
    }
  }, [wordsData]);

  // ── 5. High-Speed Text Slicer ──────────────────────────────────────────
  const { spokenText, currentText, upcomingText } = useMemo(() => {
    let spoken = '';
    let current = '';
    let upcoming = '';

    wordsData.items.forEach(item => {
      if (item.type === 'space') {
        const prevWordIdx = item.wordIdx - 1;
        if (prevWordIdx < highlightedWordIdx) {
          spoken += item.text;
        } else {
          upcoming += item.text;
        }
      } else if (item.wordIdx < highlightedWordIdx) {
        spoken += item.text;
      } else if (item.wordIdx === highlightedWordIdx) {
        current += item.text;
      } else {
        upcoming += item.text;
      }
    });

    return { spokenText: spoken, currentText: current, upcomingText: upcoming };
  }, [wordsData, highlightedWordIdx]);

  // ── Language pack checks ───────────────────────────────────────────────
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
        if (info.status === 'installed') setLangPackState('installed');
        else if (info.status === 'available-to-download') setLangPackState('needs-download');
        else setLangPackState('unsupported');
      } catch (e) {
        setLangPackState('unsupported');
      }
    })();
  }, [mode, scriptLocale, langPackState]);

  async function handleDownloadLanguagePack() {
    setLangPackState('downloading');
    try {
      const result = await SpeechRecognition.downloadLanguagePack(scriptLocale);
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
      setLangPackState('failed');
    }
  }

  // ── Speech listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubStart  = SpeechRecognition.addListener('start',  () => setRecognizing(true));
    const unsubEnd    = SpeechRecognition.addListener('end',    () => setRecognizing(false));
    const unsubResult = SpeechRecognition.addListener('result', ev  => {
      if (!ev?.transcript) return;
      if (ev.isFinal) {
        cumulativeFinalRef.current += ev.transcript + ' ';
        const allWords = tokenize(cumulativeFinalRef.current);
        const newWords = allWords.slice(totalSpokenLockedRef.current);
        totalSpokenLockedRef.current = allWords.length;
        if (newWords.length > 0) applyMatch(newWords.join(' '), true);
      } else {
        applyMatch(ev.transcript, false);
      }
    });
    return () => { unsubStart(); unsubEnd(); unsubResult(); };
  }, [applyMatch]);

  async function startRecognition() {
    const granted = await SpeechRecognition.requestMicPermission();
    if (!granted) return;
    try {
      await SpeechRecognition.start({ 
        lang: scriptLocale, 
        onDevice: true,
        playSound: isInitialPlayRef.current 
      });
      isInitialPlayRef.current = false; 
    } catch (err) {}
  }

  function stopRecognition() {
    SpeechRecognition.stop().catch(() => {});
  }

  // ── Scroll loop (For Manual Scroll Mode) ────────────────────────────────
  const startScrollLoop = useCallback(() => {
    function animate(timestamp) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      scrollY.current += (settings.scrollSpeed / 1000) * delta;
      
      const maxScroll = contentHeight.current - scrollViewHeight.current;
      if (scrollY.current >= maxScroll && maxScroll > 0) {
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

  useEffect(() => {
    const shouldBeListening = mode === 'voice' && langPackState === 'installed' && playState === 'playing';

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
    currentLineIdxRef.current = -1;
    setHighlightedWordIdx(-1);
  }

  function safeStopRecording() {
    if (!isRecording) return;
    const elapsed = Date.now() - (recordingStartTimeRef.current ?? 0);
    const delay = Math.max(0, MIN_RECORDING_MS - elapsed);
    setTimeout(() => setIsRecording(false), delay);
  }

  function handleMainButton() {
    if (mode === 'voice' && langPackState !== 'installed') return;
    
    if (playState === 'counting_down') {
      setPlayState('idle');
      setCountdown(0);
      return;
    }

    if (playState === 'idle' || playState === 'paused' || playState === 'finished') {
      const startDelay = currentTimer;
      if (startDelay > 0) {
        setCountdown(startDelay);
        setPlayState('counting_down');
      } else {
        executePlay();
      }
    } else if (playState === 'playing') {
      setPlayState('paused');
      safeStopRecording();
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
    setCountdown(0);
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
    if (playState === 'counting_down') return <Icon name="pause" size={36} color={Theme.colors.primary} />;
    if (playState === 'playing') return <Icon name="pause" size={36} color={Theme.colors.primary} />;
    if (playState === 'finished') return <Icon name="replay" size={32} color="#FFFFFF" />;
    return <Icon name="play" size={36} color="#FFFFFF" />;
  }

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

  function renderLangPackOverlay() {
    if (langPackState === 'installed' || langPackState === 'idle') return null;
    let title = '', message = '', action = null;
    if (langPackState === 'checking') {
      title = 'Checking language support…';
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

  const commonTextStyles = {
    fontSize: settings.fontSize,
    textAlign: settings.textAlign,
    writingDirection: isRTL ? 'rtl' : 'ltr',
    transform: settings.mirrorText ? [{ scaleX: -1 }] : [],
    lineHeight: settings.fontSize * 1.6,
    fontFamily: Theme.fonts.medium,
    color: '#FFFFFF',
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={[styles.cameraSection, { height: cameraHeight, backgroundColor: '#000' }]}>
        
        {/* Camera stays permanently at 100% opacity so the hardware surface doesn't crash/flicker */}
        <CameraView
          height={cameraHeight}
          cameraPosition={cameraPosition}
          isRecording={isRecording}
          audioEnabled={true}
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

        {/* Timer overlay WITH the 60% black dimming background built-in */}
        {playState === 'counting_down' && countdown > 0 && (
          <View style={styles.countdownCameraOverlay}>
            <Text style={styles.countdownTextGiant}>{countdown}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerHandle} />
      </View>

      <View style={styles.prompterSection}>
        
        {/* PASS 1: The Ghost Render */}
        {!layoutReady && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.prompterContent}>
             <Text 
              onTextLayout={handleTextLayout} 
              style={[commonTextStyles, { color: 'transparent' }]}
            >
              {script.content}
            </Text>
          </ScrollView>
        )}

        {/* PASS 2: The Real UI */}
        {layoutReady && (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(_, h) => { contentHeight.current = h; }}
            onLayout={e => { scrollViewHeight.current = e.nativeEvent.layout.height; }}
            contentContainerStyle={styles.prompterContent}
            scrollEnabled={playState !== 'playing' && playState !== 'counting_down'}
          >
            <Text style={commonTextStyles}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                {spokenText}
              </Text>
              
              <Text style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                {currentText}
              </Text>
              
              <Text style={{ color: '#FFFFFF' }}>
                {upcomingText}
              </Text>
            </Text>
            
            <View style={{ height: SCREEN_HEIGHT }} />
          </ScrollView>
        )}

        {mode === 'voice' && langPackState !== 'installed' && renderLangPackOverlay()}
      </View>

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

          <View style={styles.quickInfoRow}>
             <TouchableOpacity 
              style={styles.timerToggleBtn} 
              onPress={cycleTimer}
            >
              <Text style={styles.timerToggleText}>
                ⏱ {currentTimer === 0 ? 'Off' : `${currentTimer}s`}
              </Text>
            </TouchableOpacity>

            {mode === 'voice' && recognizing && (
              <View style={styles.listeningPill}>
                <View style={styles.listeningDot} />
                <Text style={styles.listeningText}>Listening…</Text>
              </View>
            )}
          </View>

          <View style={styles.playbackRow}>
            <TouchableOpacity style={styles.sideBtn} onPress={handleReset}>
              <Icon name="replay" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playBtn,
                isRecording && styles.playBtnRecording,
                (playState === 'playing' || playState === 'counting_down') && styles.playBtnActive,
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
  prompterContent: { paddingHorizontal: 28, paddingTop: 20 }, 

  countdownCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    zIndex: 20,
  },
  countdownTextGiant: {
    color: Theme.colors.primary,
    fontSize: 140,
    fontFamily: Theme.fonts.bold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },

  langOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
    backgroundColor: PROMPTER_BG, zIndex: 10
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
  
  quickInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 12,
  },
  timerToggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerToggleText: {
    color: '#FFFFFF',
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
  },
  listeningPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(94, 23, 235, 0.3)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, gap: 6,
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