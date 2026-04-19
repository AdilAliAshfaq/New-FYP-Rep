import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';

const MIN_RECORDING_MS = 2000;  // 2 seconds — generous buffer for mobile cameras

export default function CameraView({
  height,
  cameraPosition = 'front',
  isRecording,
  audioEnabled = true,
  onRecordingStart,
  onRecordingStop,
}) {
  const { hasPermission: hasCamPerm } = useCameraPermission();
  const { hasPermission: hasMicPerm } = useMicrophonePermission();

  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [initError, setInitError] = useState(null);

  const recordingStartedAt = useRef(null);
  const pendingStop = useRef(false);
  const pendingStart = useRef(false);

  // ── Reset ready state when device changes ───────────────────────────────
  useEffect(() => {
    setCameraReady(false);
  }, [cameraPosition, device?.id]);

  // ── Parent-driven recording control with ready check ───────────────────
  useEffect(() => {
    if (isRecording && !recording) {
      if (cameraReady) {
        startRecording();
      } else {
        // Queue the start for when camera becomes ready
        pendingStart.current = true;
      }
    } else if (!isRecording && recording) {
      pendingStart.current = false;  // cancel any queued start
      const elapsed = recordingStartedAt.current
        ? Date.now() - recordingStartedAt.current
        : MIN_RECORDING_MS;

      if (elapsed >= MIN_RECORDING_MS) {
        stopRecording();
      } else {
        pendingStop.current = true;
        setTimeout(() => {
          if (pendingStop.current) {
            pendingStop.current = false;
            stopRecording();
          }
        }, MIN_RECORDING_MS - elapsed);
      }
    } else if (!isRecording && !recording) {
      // Clean up any queued start
      pendingStart.current = false;
    }
  }, [isRecording, cameraReady]);

  // ── When camera becomes ready, check for pending start ─────────────────
  useEffect(() => {
    if (cameraReady && pendingStart.current && isRecording && !recording) {
      pendingStart.current = false;
      startRecording();
    }
  }, [cameraReady]);

  if (!hasCamPerm || !hasMicPerm) {
    return <PlaceholderBox height={height} label="Camera & mic permissions required" />;
  }

  if (!device) {
    return <PlaceholderBox height={height} label="No camera device found" />;
  }

  function startRecording() {
    if (!cameraRef.current || recording) return;
    if (!cameraReady) {
      pendingStart.current = true;
      return;
    }

    pendingStop.current = false;
    try {
      setRecording(true);
      recordingStartedAt.current = Date.now();
      onRecordingStart?.();

      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          setRecording(false);
          recordingStartedAt.current = null;
          pendingStop.current = false;
          onRecordingStop?.(video, null);
        },
        onRecordingError: (error) => {
          // Silently handle "no-data" errors — they're usually harmless
          // (user stopped before frames arrived). Only log unexpected errors.
          if (error?.code !== 'capture/no-data') {
            console.warn('[CameraView] Recording error:', error?.code || error);
          }
          setRecording(false);
          recordingStartedAt.current = null;
          pendingStop.current = false;
          onRecordingStop?.(null, error);
        },
      });
    } catch (e) {
      console.warn('[CameraView] startRecording failed:', e?.message);
      setRecording(false);
      recordingStartedAt.current = null;
    }
  }

  async function stopRecording() {
    if (!cameraRef.current || !recording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch (e) {
      // Silent — stopping a recording that's already stopped is fine
      setRecording(false);
    }
  }

  return (
    <View style={[styles.container, { height }]}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        video={true}
        audio={audioEnabled}
        onInitialized={() => {
          setCameraReady(true);
          setInitError(null);
        }}
        onError={(e) => {
          console.warn('[CameraView] Camera error:', e?.message);
          setInitError(e?.message || 'Camera error');
          setCameraReady(false);
        }}
      />

      {/* Subtle "preparing" indicator while camera initializes */}
      {!cameraReady && !initError && (
        <View style={styles.preparingOverlay}>
          <Text style={styles.preparingText}>Preparing camera…</Text>
        </View>
      )}

      {initError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>⚠ {initError}</Text>
        </View>
      )}

      {recording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recLabel}>REC</Text>
        </View>
      )}
    </View>
  );
}

function PlaceholderBox({ height, label }) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  preparingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  recBadge: {
    position: 'absolute', top: 14, left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, gap: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' },
  recLabel: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  errorText: { color: '#e63946', fontSize: 13, textAlign: 'center' },
  placeholder: {
    width: '100%', backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderText: { color: '#666', fontSize: 13, textAlign: 'center' },
});