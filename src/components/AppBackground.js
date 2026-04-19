import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '../theme/Theme';

export default function AppBackground({ children }) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});