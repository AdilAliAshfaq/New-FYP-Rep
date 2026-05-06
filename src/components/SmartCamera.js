import React from 'react';
import { requireNativeComponent, View, StyleSheet, Image } from 'react-native';

<<<<<<< HEAD
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
=======
// Look for the VirtualCamera we just restored!
const NativeVirtualCamera = requireNativeComponent('VirtualCamera');

export default function VirtualCamera({ 
  height, 
  cameraPosition = 'front', 
  isRecording, 
  backgroundSource,
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
}) {

  const resolvedBgSource = backgroundSource 
    ? Image.resolveAssetSource(backgroundSource).uri 
    : null;

  return (
    <View style={[styles.container, { height }]}>
<<<<<<< HEAD
      <NativeSmartCamera
=======
      <NativeVirtualCamera
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        backgroundSource={resolvedBgSource}
        isRecording={isRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
=======
  container: { width: '100%', overflow: 'hidden', backgroundColor: '#000' },
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
});