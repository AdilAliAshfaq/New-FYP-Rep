import React from 'react';
import { requireNativeComponent, View, StyleSheet, Image } from 'react-native';

// Look for the VirtualCamera we just restored!
const NativeVirtualCamera = requireNativeComponent('VirtualCamera');

export default function VirtualCamera({ 
  height, 
  cameraPosition = 'front', 
  isRecording, 
  backgroundSource,
}) {

  const resolvedBgSource = backgroundSource 
    ? Image.resolveAssetSource(backgroundSource).uri 
    : null;

  return (
    <View style={[styles.container, { height }]}>
      <NativeVirtualCamera
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        backgroundSource={resolvedBgSource}
        isRecording={isRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', backgroundColor: '#000' },
});