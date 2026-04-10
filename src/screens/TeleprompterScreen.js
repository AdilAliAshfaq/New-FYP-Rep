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
import RadialGradient from 'react-native-radial-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScripts } from '../context/ScriptContext';
import CameraView from '../components/CameraView';
import {
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { Theme } from '../theme/Theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TeleprompterScreen({ navigation, route }) {
  const { getScript, settings, addRecording } = useScripts();
  const script = getScript(route.params.scriptId);
  const insets = useSafeAreaInsets();

  const [playState, setPlayState] = useState('idle');
  const [showControls, setShowControls] = useState(true);
  const [currentSpeed] = useState(settings.scrollSpeed);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraPosition, setCameraPosition] = useState(settings.cameraPosition);

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
  const controlsTimer = useRef(null);

  const cameraHeight = SCREEN_HEIGHT * settings.cameraRatio;

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
            if (!hasMicPermission) await requestMicrophonePermission();
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
      
      {/* 1. Bottom-Left Glow for Teleprompter Screen */}
      <RadialGradient
        style={StyleSheet.absoluteFill}
        colors={['#004243', '#081318']} 
        stops={[0, 0.8]}
        center={[0, SCREEN_HEIGHT * 0.9]} 
        radius={SCREEN_WIDTH * 1.2} 
      />

      {/* 2. Top-Right Glow for Teleprompter Screen */}
      <RadialGradient
        style={StyleSheet.absoluteFill}
        colors={['#013133', 'transparent']} 
        stops={[0, 0.7]}
        center={[SCREEN_WIDTH, 0]} 
        radius={SCREEN_WIDTH} 
      />

      <View style={[styles.cameraSection, { height: cameraHeight }]}>
        <CameraView
          height={cameraHeight}
          cameraPosition={cameraPosition}
          isRecording={isRecording}
          onRecordingStart={() => setIsRecording(true)}
          onRecordingStop={async (video, err) => {
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

      <TouchableOpacity
        activeOpacity={1}
        style={styles.prompterSection} 
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

      {showControls && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
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

          <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.playbackRow}>
              <TouchableOpacity style={styles.sideBtn} onPress={handleReset}>
                <Text style={styles.sideBtnText}>↺</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playBtn, isRecording && styles.playBtnRecording]}
                onPress={handleMainButton}
              >
                <Text style={styles.playBtnText}>{getMainButtonIcon()}</Text>
                {isRecording && <View style={styles.recIndicator} />}
              </TouchableOpacity>

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
    backgroundColor: '#081318', 
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: Theme.colors.primary, 
    fontFamily: Theme.fonts.bold,
    fontSize: 22,
    marginBottom: 14,
    textAlign: 'center',
  },
  permissionMessage: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 30,
    marginBottom: 16,
  },
  permissionBtnText: {
    color: Theme.colors.background,
    fontFamily: Theme.fonts.bold,
    fontSize: 16,
  },
  permissionSkipBtn: {
    paddingVertical: 10,
  },
  permissionSkipText: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
  cameraSection: {
    overflow: 'hidden',
    backgroundColor: '#000', 
  },
  divider: {
    height: 28,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  dividerHandle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.secondary,
    opacity: 0.5,
  },
  prompterSection: {
    flex: 1,
    overflow: 'hidden',
  },
  prompterContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  scriptText: {
    fontFamily: Theme.fonts.medium,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(10, 22, 25, 0.75)', 
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Theme.colors.primary, 
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
  },
  scriptTitle: {
    flex: 1,
    color: Theme.colors.primary, 
    fontFamily: Theme.fonts.bold,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bottomControls: {
    backgroundColor: 'rgba(10, 22, 25, 0.85)',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnRecording: {
    backgroundColor: '#1cebb6', 
    shadowOpacity: 0.8,
  },
  playBtnText: {
    color: Theme.colors.background, 
    fontSize: 28,
  },
  recIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.error,
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  sideBtnText: {
    color: Theme.colors.primary, 
    fontSize: 22,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 18,
    marginBottom: 16,
  },
  backLink: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
  },
});