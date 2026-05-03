import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Share from 'react-native-share';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import AppBackground from '../components/AppBackground';
import { useScripts } from '../context/ScriptContext';
import Icon from '../components/Icon'; 
import { SUPPORTED_LANGUAGES } from '../utils/languages';
import { Theme } from '../theme/Theme';

export default function HomeScreen({ navigation }) {
  const { scripts, deleteScript, recordings, deleteRecording } = useScripts();
  const [activeTab, setActiveTab] = useState('scripts');
  const [seenCount, setSeenCount] = useState(recordings.length);
  
  // State for the video preview modal
  const [previewVideo, setPreviewVideo] = useState(null);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (activeTab === 'recordings') {
      setSeenCount(recordings.length);
    }
  }, [activeTab, recordings.length]);

  const hasNewRecording = recordings.length > seenCount;

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

  // Native File Sharing Function
  async function handleShareRecording(recording) {
    try {
      const videoPath = recording.path.startsWith('file://')
        ? recording.path
        : `file://${recording.path}`;

      await Share.open({
        url: videoPath,
        type: 'video/mp4',
        title: 'Share Recording',
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        console.log('Share error:', error);
      }
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="play" size={16} color="#FFFFFF" />
              <Text style={styles.startBtnText}>Start</Text>
            </View>
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

  function renderRecording({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.recordingHeaderRow}>
            {/* Left Side: Title and Date */}
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View style={styles.recordingHeader}>
                <View style={styles.recDot} />
                <Text style={styles.cardTitle} numberOfLines={1}>{item.scriptTitle}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {formatDate(item.createdAt)} · {formatDuration(item.duration)}
              </Text>
            </View>
            
            {/* Right Side: Play & Share Buttons */}
            <View style={styles.quickActionRow}>
              {/* Play Button */}
              <TouchableOpacity 
                style={styles.circleBtnPrimary}
                onPress={() => setPreviewVideo(item.path)}
              >
                <Icon name="play" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Share Button (Now completely identical to the Play button) */}
              <TouchableOpacity 
                style={styles.circleBtnPrimary}
                onPress={() => handleShareRecording(item)}
              >
                <Icon name="share" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          
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
    <AppBackground>
      <SafeAreaView style={styles.container}>

        <Text style={[styles.integratedHeaderTitle, { marginTop: Math.max(insets.top + 16, 40) }]}>
          CamPrompter
        </Text>

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
              {hasNewRecording && activeTab !== 'recordings' && (
                <View style={[styles.notificationDot, { backgroundColor: Theme.colors.primary }]} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {activeTab === 'scripts' && (
          <FlatList
            data={scripts}
            keyExtractor={item => item.id}
            renderItem={renderScript}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<ScriptsEmpty />}
          />
        )}

        {activeTab === 'recordings' && (
          <FlatList
            data={recordings}
            keyExtractor={item => item.id}
            renderItem={renderRecording}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<RecordingsEmpty />}
          />
        )}

        {activeTab === 'scripts' && (
          <View style={styles.fabRow}>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="settings" size={26} color={Theme.colors.primary} />
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

      {/* ── Full Screen Video Player Modal ── */}
      <Modal visible={!!previewVideo} animationType="slide" onRequestClose={() => setPreviewVideo(null)}>
        <View style={styles.playerContainer}>
          {previewVideo && (
            <Video
              source={{ uri: previewVideo.startsWith('file://') ? previewVideo : `file://${previewVideo}` }}
              style={styles.fullScreenVideo}
              controls={true}
              resizeMode="contain"
              ignoreSilentSwitch="ignore"
            />
          )}
          <View style={[styles.playerTopBar, { paddingTop: insets.top + 10 }]}>
             <TouchableOpacity style={styles.closePlayerBtn} onPress={() => setPreviewVideo(null)}>
               <Text style={styles.closePlayerBtnText}>✕ Close Preview</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    fontSize: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    textAlign: 'left',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Theme.colors.primary,
  },
  tabText: {
    color: Theme.colors.secondary,
    fontSize: 14,
    fontFamily: Theme.fonts.semiBold,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: Theme.fonts.semiBold,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  list: {
    padding: 16,
    paddingBottom: 160,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    color: Theme.colors.text,
    fontSize: 18,
    fontFamily: Theme.fonts.semiBold,
    marginBottom: 4,
  },
  cardMeta: {
    color: Theme.colors.primary,
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    marginBottom: 8,
  },
  cardPreview: {
    color: Theme.colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
  },
  recordingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
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
    backgroundColor: Theme.colors.error,
  },
  recordingPath: {
    color: Theme.colors.secondary,
    opacity: 0.6,
    fontSize: 11,
    fontFamily: Theme.fonts.regular,
    marginTop: 4,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 12, // Increased gap slightly so the identical buttons have breathing room
  },
  circleBtnPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    padding: 8,
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Theme.colors.primaryLight,
  },
  editBtnText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontFamily: Theme.fonts.semiBold,
  },
  startBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontFamily: Theme.fonts.semiBold,
    fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Theme.fonts.semiBold,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: Theme.colors.secondary,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: Theme.colors.text,
    fontSize: 22,
    fontFamily: Theme.fonts.semiBold,
  },
  emptySubtitle: {
    color: Theme.colors.secondary,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
    fontFamily: Theme.fonts.regular,
  },
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
    backgroundColor: Theme.colors.surface,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  fab: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
  },

  // Modal Player Styles
  playerContainer: {
    flex: 1, 
    backgroundColor: '#000',
  },
  fullScreenVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  playerTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end',
    zIndex: 10,
  },
  closePlayerBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
  },
  closePlayerBtnText: {
    color: '#FFF', fontFamily: Theme.fonts.semiBold, fontSize: 14,
  },
});