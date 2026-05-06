import React from 'react';
import { requireNativeComponent, View, StyleSheet, Image } from 'react-native';

const NativeVirtualCamera = requireNativeComponent('VirtualCamera');

export default function VirtualCameraView(props) {
  return (
    <View style={[styles.container, { height: props.height }]}>
      
      {/* 1. React Native draws the background perfectly! */}
      {props.backgroundSource && (
        <Image
          source={props.backgroundSource}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      )}

      {/* 2. Kotlin draws ONLY your body on a transparent layer over it! */}
      <NativeVirtualCamera
        style={StyleSheet.absoluteFillObject}
        cameraPosition={props.cameraPosition || 'front'}
        isRecording={props.isRecording || false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});