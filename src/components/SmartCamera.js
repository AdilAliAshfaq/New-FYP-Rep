import React from 'react';
import { requireNativeComponent, View, StyleSheet, Image } from 'react-native';

// ── THE FIX: Point to the VirtualCamera module that contains the ML Kit logic ──
const NativeSmartCamera = requireNativeComponent('VirtualCamera');

export default function SmartCamera({ 
  height, 
  cameraPosition = 'front', 
  isRecording, 
  audioEnabled, 
  backgroundSource,
  onRecordingStart,
  onRecordingStop 
}) {

  const resolvedBgSource = backgroundSource 
    ? Image.resolveAssetSource(backgroundSource).uri 
    : null;

  return (
    <View style={[styles.container, { height }]}>
      <NativeSmartCamera
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        backgroundSource={resolvedBgSource}
        isRecording={isRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});