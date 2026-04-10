import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import RadialGradient from 'react-native-radial-gradient';
import { Theme } from '../theme/Theme';

const { width, height } = Dimensions.get('window');

export default function AppBackground({ children }) {
  return (
    <View style={styles.container}>
      
      {/* 1. Bottom-Left Glow */}
      <RadialGradient
        style={StyleSheet.absoluteFill}
        colors={['#004243', '#081318']} // Bright teal fading into deep dark background
        stops={[0, 0.8]}
        center={[0, height * 0.9]} // Anchored bottom-left
        radius={width * 1.2} 
      />

      {/* 2. Top-Right Glow (Overlay) */}
      <RadialGradient
        style={StyleSheet.absoluteFill}
        colors={['#013133', 'transparent']} // Subtle glow fading to transparent
        stops={[0, 0.7]}
        center={[width, 0]} // Anchored top-right
        radius={width} 
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background, // Fallback base color
  },
});