import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useScripts } from '../context/ScriptContext';
import { SUPPORTED_LANGUAGES } from '../utils/languages';

export default function HomeScreen({ navigation }) {
  const { scripts, deleteScript, recordings, deleteRecording } = useScripts();
  const [activeTab, setActiveTab] = useState('scripts'); // 'scripts' | 'recordings'
  
  // Track how many recordings the user has "seen"
  const [seenCount, setSeenCount] = useState(recordings.length);

  // Clear the notification dot when the recordings tab is active
  useEffect(() => {
    if (activeTab === 'recordings') {
      setSeenCount(recordings.length);
    }
  }, [activeTab, recordings.length]);

  const hasNewRecording = recordings.length > seenCount;

  // ── Scripts helpers ──────────────────────────────────────────────────────
  function handleDeleteScript(script) {
    Alert.alert('Delete Script', `Delete "${script.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteScript(script.id) },
    ]);
  }

  function getLangLabel(code) {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang ? lang.label : code;
  }

  function getLangFlag(code) {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang ? lang.flag : '🌐';
  }

  // ── Recordings helpers ───────────────────────────────────────────────────
  function handleDeleteRecording(recording) {
    Alert.alert('Delete Recording', 'Remove this recording from the list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecording(recording.id) },
    ]);
  }

  async function handleSaveToGallery(recording) {
    try {
      const videoPath = recording.path.startsWith('file://')
        ? recording.path
        : `file://${recording.path}`;

      await CameraRoll.saveAsset(videoPath, { type: 'video' });
      Alert.alert('Success', 'Video saved to your gallery! 🎥');
    } catch (error) {
      console.error('Save to gallery error:', error);
      Alert.alert('Error', 'Failed to save video. Please ensure the app has Photo Gallery permissions.');
    }
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatDate(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Render script card ───────────────────────────────────────────────────
  function renderScript({ item }) {
    const wordCount = item.content.trim().split(/\s+/).length;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => navigation.navigate('Teleprompter', { scriptId: item.id })}
        >
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {getLangFlag(item.language)} {getLangLabel(item.language)} · {wordCount} words
          </Text>
          <Text style={styles.cardPreview} numberOfLines={2}>{item.content}</Text>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('Editor', { scriptId: item.id })}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.navigate('Teleprompter', { scriptId: item.id })}
          >
            <Text style={styles.startBtnText}>▶  Start</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteScript(item)}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render recording card ────────────────────────────────────────────────
  function renderRecording({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.recordingHeader}>
            <View style={styles.recDot} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.scriptTitle}</Text>
          </View>
          <Text style={styles.cardMeta}>
            {formatDate(item.createdAt)} · {formatDuration(item.duration)}
          </Text>
          <Text style={styles.recordingPath} numberOfLines={1}>{item.path}</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.saveBtn, { flex: 1, alignItems: 'center' }]}
            onPress={() => handleSaveToGallery(item)}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, { flex: 1, alignItems: 'center' }]}
            onPress={() => handleDeleteRecording(item)}
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Empty states ─────────────────────────────────────────────────────────
  function ScriptsEmpty() {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🎬</Text>
        <Text style={styles.emptyTitle}>No scripts yet</Text>
        <Text style={styles.emptySubtitle}>Tap the button below to create your first script</Text>
      </View>
    );
  }

  function RecordingsEmpty() {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🎥</Text>
        <Text style={styles.emptyTitle}>No recordings yet</Text>
        <Text style={styles.emptySubtitle}>Recordings will appear here after you finish a teleprompter session</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scripts' && styles.tabActive]}
          onPress={() => setActiveTab('scripts')}
        >
          <Text style={[styles.tabText, activeTab === 'scripts' && styles.tabTextActive]}>
            Scripts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recordings' && styles.tabActive]}
          onPress={() => setActiveTab('recordings')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.tabText, activeTab === 'recordings' && styles.tabTextActive]}>
              Recordings
            </Text>
            {/* The Notification Dot only shows if there's a new recording AND the tab is inactive */}
            {hasNewRecording && activeTab !== 'recordings' && (
              <View style={[styles.notificationDot, { backgroundColor: '#e63946' }]} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Scripts tab */}
      {activeTab === 'scripts' && (
        <FlatList
          data={scripts}
          keyExtractor={item => item.id}
          renderItem={renderScript}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ScriptsEmpty />}
        />
      )}

      {/* Recordings tab */}
      {activeTab === 'recordings' && (
        <FlatList
          data={recordings}
          keyExtractor={item => item.id}
          renderItem={renderRecording}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<RecordingsEmpty />}
        />
      )}

      {/* Bottom buttons — only show on scripts tab */}
      {activeTab === 'scripts' && (
        <View style={styles.fabRow}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsBtnText}>⚙</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('Editor', {})}
          >
            <Text style={styles.fabText}>+ New Script</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#e63946',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },

  list: {
    padding: 16,
    paddingBottom: 110,
  },

  // Card
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  cardPreview: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },

  // Recording specific
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e63946',
  },
  recordingPath: {
    color: '#555',
    fontSize: 11,
    marginTop: 4,
  },

  // Card action buttons
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    padding: 8,
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  editBtnText: {
    color: '#ccc',
    fontSize: 14,
  },
  startBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e63946',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
  },
  deleteBtnText: {
    color: '#888',
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // FAB row
  fabRow: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  settingsBtn: {
    width: 56,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  settingsBtnText: {
    color: '#fff',
    fontSize: 22,
  },
  fab: {
    flex: 1,
    backgroundColor: '#e63946',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#e63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});