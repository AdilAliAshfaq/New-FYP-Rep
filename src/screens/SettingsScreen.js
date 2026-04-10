import React from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Dynamic Insets
import AppBackground from '../components/AppBackground'; 
import { useScripts } from '../context/ScriptContext';
import { Theme } from '../theme/Theme';

export default function SettingsScreen() {
  const { settings, updateSettings } = useScripts();
  const insets = useSafeAreaInsets(); // Get notch/status bar height

  return (
    <AppBackground>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          {/* Dynamic Margin Applied Here */}
          <Text style={[styles.integratedHeaderTitle, { marginTop: Math.max(insets.top + 16, 40) }]}>
            Settings
          </Text>

          <Text style={styles.sectionTitle}>CAMERA</Text>
          <View style={styles.card}>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Camera Position</Text>
              <View style={styles.segmented}>
                {['front', 'back'].map(pos => (
                  <TouchableOpacity
                    key={pos}
                    style={[
                      styles.segment,
                      settings.cameraPosition === pos && styles.segmentActive,
                    ]}
                    onPress={() => updateSettings({ cameraPosition: pos })}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        settings.cameraPosition === pos && styles.segmentTextActive,
                      ]}
                    >
                      {pos === 'front' ? 'Front' : 'Back'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.rowLabel}>Camera Height</Text>
              <View style={styles.sliderRow}>
                <Slider
                  style={{ width: 150, height: 32 }}
                  minimumValue={0.3}
                  maximumValue={0.7}
                  step={0.05}
                  value={settings.cameraRatio}
                  onValueChange={v => updateSettings({ cameraRatio: v })}
                  minimumTrackTintColor={Theme.colors.primary}
                  maximumTrackTintColor={Theme.colors.border}
                  thumbTintColor={Theme.colors.primary}
                />
                <Text style={styles.sliderVal}>
                  {Math.round(settings.cameraRatio * 100)}%
                </Text>
              </View>
            </View>

          </View>

          <Text style={styles.sectionTitle}>TEXT & SCROLL</Text>
          <View style={styles.card}>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Font Size</Text>
              <View style={styles.sliderRow}>
                <Slider
                  style={{ width: 150, height: 32 }}
                  minimumValue={18}
                  maximumValue={56}
                  step={2}
                  value={settings.fontSize}
                  onValueChange={v => updateSettings({ fontSize: v })}
                  minimumTrackTintColor={Theme.colors.primary}
                  maximumTrackTintColor={Theme.colors.border}
                  thumbTintColor={Theme.colors.primary}
                />
                <Text style={styles.sliderVal}>{settings.fontSize}px</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Scroll Speed</Text>
              <View style={styles.sliderRow}>
                <Slider
                  style={{ width: 150, height: 32 }}
                  minimumValue={10}
                  maximumValue={200}
                  step={5}
                  value={settings.scrollSpeed}
                  onValueChange={v => updateSettings({ scrollSpeed: v })}
                  minimumTrackTintColor={Theme.colors.primary}
                  maximumTrackTintColor={Theme.colors.border}
                  thumbTintColor={Theme.colors.primary}
                />
                <Text style={styles.sliderVal}>{settings.scrollSpeed}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Text Align</Text>
              <View style={styles.segmented}>
                {['left', 'center', 'right'].map(align => (
                  <TouchableOpacity
                    key={align}
                    style={[
                      styles.segment,
                      settings.textAlign === align && styles.segmentActive,
                    ]}
                    onPress={() => updateSettings({ textAlign: align })}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        settings.textAlign === align && styles.segmentTextActive,
                      ]}
                    >
                      {align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.rowLabel}>Mirror Text</Text>
              <Switch
                value={settings.mirrorText}
                onValueChange={v => updateSettings({ mirrorText: v })}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.text}
              />
            </View>

          </View>

          <Text style={styles.sectionTitle}>COLORS</Text>
          <View style={styles.card}>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Font Color</Text>
              <View style={styles.colorRow}>
                {['#ffffff', '#00fccf', '#8b9d9f', '#ffcc00'].map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      settings.fontColor === color && styles.colorSwatchActive,
                    ]}
                    onPress={() => updateSettings({ fontColor: color })}
                  />
                ))}
              </View>
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.rowLabel}>Background</Text>
              <View style={styles.colorRow}>
                {['#0a1619', '#081318', '#122629', '#0d1a26'].map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      settings.backgroundColor === color && styles.colorSwatchActive,
                    ]}
                    onPress={() => updateSettings({ backgroundColor: color })}
                  />
                ))}
              </View>
            </View>

          </View>

        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  integratedHeaderTitle: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.semiBold,
    fontSize: 22,
    fontWeight: 'bold',
    // marginTop handled dynamically
    marginBottom: 12,
    textAlign: 'left',
  },
  scroll: {
    padding: 20,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: Theme.colors.primary,
  },
  segmentText: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  segmentTextActive: {
    color: Theme.colors.background, 
    fontFamily: Theme.fonts.bold,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderVal: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 13,
    width: 44,
    textAlign: 'right',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  colorSwatchActive: {
    borderColor: Theme.colors.primary,
    transform: [{ scale: 1.1 }], 
  },
});