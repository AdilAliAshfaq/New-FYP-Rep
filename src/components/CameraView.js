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

export default function CameraView({ height, cameraPosition = 'front', isRecording, onRecordingStart, onRecordingStop }) {
  const { hasPermission: hasCamPerm } = useCameraPermission();
  const { hasPermission: hasMicPerm } = useMicrophonePermission();

  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [initError, setInitError] = useState(null);

  // ── Parent-driven recording control ────────────────────────────────────────
  useEffect(() => {
    if (isRecording && !recording) {
      startRecording();
    } else if (!isRecording && recording) {
      stopRecording();
    }
  }, [isRecording]);
  // ──────────────────────────────────────────────────────────────────────────

  if (!hasCamPerm || !hasMicPerm) {
    return <PlaceholderBox height={height} label="Camera & mic permissions required" />;
  }

  if (!device) {
    return <PlaceholderBox height={height} label="No camera device found" />;
  }

  async function startRecording() {
    if (!cameraRef.current || recording) return;
    try {
      setRecording(true);
      onRecordingStart?.();
      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          setRecording(false);
          onRecordingStop?.(video);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setRecording(false);
          onRecordingStop?.(null, error);
        },
      });
    } catch (e) {
      console.error('startRecording failed:', e);
      setRecording(false);
    }
  }

  async function stopRecording() {
    if (!cameraRef.current || !recording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch (e) {
      console.error('stopRecording failed:', e);
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
        audio={true}
        onError={(e) => setInitError(e.message)}
      />

      {/* Error overlay */}
      {initError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>⚠ {initError}</Text>
        </View>
      )}

      {/* REC badge */}
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
  container: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  // REC badge
  recBadge: {
    position: 'absolute',
    top: 14,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e63946',
  },
  recLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Error
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e63946',
    fontSize: 13,
    textAlign: 'center',
  },

  // Placeholder
  placeholder: {
    width: '100%',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
});