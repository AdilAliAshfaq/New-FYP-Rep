import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useScripts } from '../context/ScriptContext';
import { SUPPORTED_LANGUAGES } from '../utils/languages';

export default function HomeScreen({ navigation }) {
  const { scripts, deleteScript } = useScripts();

  function handleDelete(script) {
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

  function renderItem({ item }) {
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
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={scripts}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyTitle}>No scripts yet</Text>
            <Text style={styles.emptySubtitle}>Tap the button below to create your first script</Text>
          </View>
        }
      />

      {/* Bottom buttons */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
