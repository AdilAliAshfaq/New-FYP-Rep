import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../components/AppBackground';
import { useScripts } from '../context/ScriptContext';
import { SUPPORTED_LANGUAGES } from '../utils/languages';
import { Theme } from '../theme/Theme';

export default function EditorScreen({ navigation, route }) {
  const { addScript, updateScript, deleteScript, getScript } = useScripts();
  const scriptId = route.params?.scriptId;
  const isEditing = !!scriptId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState(SUPPORTED_LANGUAGES[0].code);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isEditing) {
      const script = getScript(scriptId);
      if (script) {
        setTitle(script.title);
        setContent(script.content);
        setLanguage(script.language);
      } else {
        Alert.alert('Error', 'Script not found.');
        navigation.goBack();
      }
    }
  }, [scriptId]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!content.trim()) return Alert.alert('Required', 'Please enter script content.');

    const scriptData = { title: title.trim(), content: content.trim(), language };

    if (isEditing) {
      await updateScript(scriptId, scriptData);
    } else {
      await addScript(scriptData);
    }
    navigation.goBack();
  };

  const currentLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || language;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const isRTL = ['ar', 'ur'].includes(language);

  return (
    <AppBackground>
      <SafeAreaView style={styles.container}>

        <View style={[styles.customTitleBar, { marginTop: Math.max(insets.top + 16, 40) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
            <Text style={styles.integratedBackText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.integratedEditorTitle}>
            {isEditing ? 'Edit Script' : 'Create Script'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>SCRIPT TITLE</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="E.g. Monday Morning Update"
            placeholderTextColor={Theme.colors.secondary}
          />

          <Text style={styles.label}>LANGUAGE & DIRECTION</Text>
          <TouchableOpacity
            style={styles.langSelector}
            onPress={() => setShowLangDropdown(!showLangDropdown)}
          >
            <Text style={styles.langSelectorText}>{currentLangLabel}</Text>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>

          {showLangDropdown && (
            <View style={styles.langDropdown}>
              {SUPPORTED_LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, lang.code === language && styles.langOptionSelected]}
                  onPress={() => {
                    setLanguage(lang.code);
                    setShowLangDropdown(false);
                  }}
                >
                  <Text style={styles.langOptionText}>
                    {lang.flag} {lang.label}
                  </Text>
                  {lang.code === language && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.contentHeader}>
            <Text style={styles.label}>CONTENT</Text>
            <Text style={styles.wordCount}>{wordCount} words</Text>
          </View>
          <TextInput
            style={[styles.contentInput, isRTL && styles.contentInputRTL]}
            value={content}
            onChangeText={setContent}
            placeholder="Type your script here..."
            placeholderTextColor={Theme.colors.secondary}
            multiline={true}
            numberOfLines={10}
            textAlignVertical="top"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
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
  customTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  integratedBackText: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
  },
  integratedEditorTitle: {
    flex: 1,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.semiBold,
    fontSize: 20,
    textAlign: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  titleInput: {
    backgroundColor: Theme.colors.surface,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 17,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  langSelector: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 4,
  },
  langSelectorText: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
  },
  chevron: {
    color: Theme.colors.secondary,
    fontSize: 12,
  },
  langDropdown: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  langOption: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  langOptionSelected: {
    backgroundColor: Theme.colors.primaryLight,
  },
  langOptionText: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
  },
  checkmark: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 16,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordCount: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  contentInput: {
    backgroundColor: Theme.colors.surface,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    borderRadius: 16,
    padding: 16,
    minHeight: 280,
    lineHeight: 26,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 24,
  },
  contentInputRTL: {
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cancelBtnText: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Theme.colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: Theme.fonts.semiBold,
    fontSize: 16,
  },
});