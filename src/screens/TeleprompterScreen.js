import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScripts } from '../context/ScriptContext';
import CameraView from '../components/CameraView';
import {
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TeleprompterScreen({ navigation, route }) {
  const { getScript, settings, addRecording } = useScripts(); // ← addRecording added
  const script = getScript(route.params.scriptId);
  const insets = useSafeAreaInsets();

  const [playState, setPlayState] = useState('idle');
  const [showControls, setShowControls] = useState(true);
  const [currentSpeed] = useState(settings.scrollSpeed);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState(settings.cameraPosition);

  // ── Permissions ────────────────────────────────────────────────────────────
  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();

  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  const hasAllPermissions = hasCameraPermission && hasMicPermission;

  useEffect(() => {
    async function requestPermissions() {
      if (!hasCameraPermission) await requestCameraPermission();
      if (!hasMicPermission) await requestMicPermission();
    }
    requestPermissions();
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const contentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const controlsTimer = useRef(null);

  const cameraHeight = SCREEN_HEIGHT * settings.cameraRatio;

  // Auto-hide controls after 3 seconds when playing
  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    if (playState === 'playing') {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playState]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [playState]);

  // Smooth scroll animation loop
  const startScrollLoop = useCallback(() => {
    function animate(timestamp) {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      scrollY.current += (currentSpeed / 1000) * delta;

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
  }, [currentSpeed]);

  function stopScrollLoop() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    lastTimeRef.current = null;
  }

  useEffect(() => {
    if (playState === 'playing') startScrollLoop();
    else stopScrollLoop();
    return stopScrollLoop;
  }, [playState, startScrollLoop]);

  // ── Combined play + record button ─────────────────────────────────────────
  function handleMainButton() {
    if (playState === 'idle' || playState === 'paused') {
      setPlayState('playing');
      if (!isRecording) setIsRecording(true);
    } else if (playState === 'playing') {
      setPlayState('paused');
      if (isRecording) setIsRecording(false);
    } else if (playState === 'finished') {
      scrollY.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setPlayState('playing');
      if (!isRecording) setIsRecording(true);
    }
    resetControlsTimer();
  }
  // ──────────────────────────────────────────────────────────────────────────

  function handleReset() {
    stopScrollLoop();
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setPlayState('idle');
    setIsRecording(false);
    setShowControls(true);
  }

  function handleFlipCamera() {
    setCameraPosition(prev => (prev === 'front' ? 'back' : 'front'));
  }

  function getMainButtonIcon() {
    if (playState === 'playing') return '⏸';
    if (playState === 'finished') return '↺';
    return '▶';
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
          Camera and microphone access are needed to use the teleprompter with
          recording. Please grant both permissions to continue.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={async () => {
            if (!hasCameraPermission) await requestCameraPermission();
            if (!hasMicPermission) await requestMicPermission();
          }}
        >
          <Text style={styles.permissionBtnText}>Grant Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionSkipBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permissionSkipText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isRTL = ['ar', 'ur'].includes(script.language);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera Feed */}
      <View style={[styles.cameraSection, { height: cameraHeight }]}>
        <CameraView
          height={cameraHeight}
          cameraPosition={cameraPosition}
          isRecording={isRecording}
          onRecordingStart={() => setIsRecording(true)}
          onRecordingStop={async (video, err) => {   // ← updated callback
            setIsRecording(false);
            if (video) {
              await addRecording({
                path: video.path,
                duration: video.duration ?? 0,
                scriptTitle: script.title,
              });
              console.log('Recording saved:', video.path);
            }
          }}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerHandle} />
      </View>

      {/* Teleprompter */}
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.prompterSection, { backgroundColor: settings.backgroundColor }]}
        onPress={resetControlsTimer}
      >
        <ScrollView
          ref={scrollRef}
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
                color: settings.fontColor,
                textAlign: settings.textAlign,
                writingDirection: isRTL ? 'rtl' : 'ltr',
                transform: settings.mirrorText ? [{ scaleX: -1 }] : [],
                lineHeight: settings.fontSize * 1.6,
              },
            ]}
          >
            {script.content}
          </Text>
          <View style={{ height: 120 }} />
        </ScrollView>
      </TouchableOpacity>

      {/* Controls Overlay */}
      {showControls && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">

          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.scriptTitle} numberOfLines={1}>
              {script.title}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Bottom control bar */}
          <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.playbackRow}>

              {/* Reset */}
              <TouchableOpacity style={styles.sideBtn} onPress={handleReset}>
                <Text style={styles.sideBtnText}>↺</Text>
              </TouchableOpacity>

              {/* Main button — play/pause + record */}
              <TouchableOpacity
                style={[styles.playBtn, isRecording && styles.playBtnRecording]}
                onPress={handleMainButton}
              >
                <Text style={styles.playBtnText}>{getMainButtonIcon()}</Text>
                {isRecording && <View style={styles.recIndicator} />}
              </TouchableOpacity>

              {/* Flip Camera */}
              <TouchableOpacity style={styles.sideBtn} onPress={handleFlipCamera}>
                <Text style={styles.sideBtnText}>🔄</Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  permissionMessage: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionBtn: {
    backgroundColor: '#e63946',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 30,
    marginBottom: 16,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionSkipBtn: {
    paddingVertical: 10,
  },
  permissionSkipText: {
    color: '#e63946',
    fontSize: 15,
  },

  // Camera
  cameraSection: {
    overflow: 'hidden',
    backgroundColor: '#111',
  },

  // Divider
  divider: {
    height: 28,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#222',
  },
  dividerHandle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
  },

  // Teleprompter
  prompterSection: {
    flex: 1,
    overflow: 'hidden',
  },
  prompterContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  scriptText: {},

  // Controls overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scriptTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },

  // Bottom controls
  bottomControls: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  // Main play+record button
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnRecording: {
    backgroundColor: '#b52530',
    shadowOpacity: 0.8,
  },
  playBtnText: {
    color: '#fff',
    fontSize: 28,
  },
  recIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Side buttons
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnText: {
    color: '#fff',
    fontSize: 22,
  },

  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
  },
  backLink: {
    color: '#e63946',
    fontSize: 16,
  },
});