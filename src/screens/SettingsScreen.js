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
import { useScripts } from '../context/ScriptContext';

export default function SettingsScreen() {
  const { settings, updateSettings } = useScripts();

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* CAMERA */}
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

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Camera Height</Text>
              <View style={styles.sliderRow}>
                <Slider
                  style={{ width: 150, height: 32 }}
                  minimumValue={0.3}
                  maximumValue={0.7}
                  step={0.05}
                  value={settings.cameraRatio}
                  onValueChange={v => updateSettings({ cameraRatio: v })}
                  minimumTrackTintColor="#e63946"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#e63946"
                />
                <Text style={styles.sliderVal}>
                  {Math.round(settings.cameraRatio * 100)}%
                </Text>
              </View>
            </View>

          </View>

          {/* TEXT & SCROLL */}
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
                  minimumTrackTintColor="#e63946"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#e63946"
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
                  minimumTrackTintColor="#e63946"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#e63946"
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
                trackColor={{ false: '#333', true: '#e63946' }}
                thumbColor="#fff"
              />
            </View>

          </View>

          {/* COLORS */}
          <Text style={styles.sectionTitle}>COLORS</Text>
          <View style={styles.card}>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Font Color</Text>
              <View style={styles.colorRow}>
                {['#ffffff', '#ffff00', '#00ff88', '#ff9900'].map(color => (
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
                {['#000000', '#111111', '#001a00', '#00001a'].map(color => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  segmentActive: {
    backgroundColor: '#e63946',
  },
  segmentText: {
    color: '#777',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderVal: {
    color: '#e63946',
    fontSize: 13,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#e63946',
  },
});