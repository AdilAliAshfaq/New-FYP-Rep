import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ScriptContext = createContext(null);

const SCRIPTS_KEY = '@camprompter_scripts';
const SETTINGS_KEY = '@camprompter_settings';
const RECORDINGS_KEY = '@camprompter_recordings';

const defaultSettings = {
  scrollSpeed: 50,
  fontSize: 28,
  fontColor: '#ffffff',
  backgroundColor: '#000000',
  textAlign: 'center',
  mirrorText: false,
  cameraPosition: 'front',
  cameraRatio: 0.5,
};

export function ScriptProvider({ children }) {
  const [scripts, setScripts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const savedScripts = await AsyncStorage.getItem(SCRIPTS_KEY);
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      const savedRecordings = await AsyncStorage.getItem(RECORDINGS_KEY);
      if (savedScripts) setScripts(JSON.parse(savedScripts));
      if (savedSettings) setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      if (savedRecordings) setRecordings(JSON.parse(savedRecordings));
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  async function persistScripts(updated) {
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(updated));
  }

  async function addScript(data) {
    const newScript = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newScript, ...scripts];
    setScripts(updated);
    await persistScripts(updated);
    return newScript;
  }

  async function updateScript(id, updates) {
    const updated = scripts.map(s =>
      s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
    );
    setScripts(updated);
    await persistScripts(updated);
  }

  async function deleteScript(id) {
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    await persistScripts(updated);
  }

  function getScript(id) {
    return scripts.find(s => s.id === id);
  }

  async function updateSettings(updates) {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }

  // ── Recordings ─────────────────────────────────────────────────────────────
  async function addRecording(data) {
    const newRecording = {
      id: Date.now().toString(),
      path: data.path,
      duration: data.duration ?? 0,       // seconds
      scriptTitle: data.scriptTitle ?? 'Untitled',
      createdAt: Date.now(),
    };
    const updated = [newRecording, ...recordings];
    setRecordings(updated);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
    return newRecording;
  }

  async function deleteRecording(id) {
    const updated = recordings.filter(r => r.id !== id);
    setRecordings(updated);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  }
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <ScriptContext.Provider
      value={{
        scripts,
        settings,
        recordings,
        addScript,
        updateScript,
        deleteScript,
        getScript,
        updateSettings,
        addRecording,
        deleteRecording,
      }}
    >
      {children}
    </ScriptContext.Provider>
  );
}

export function useScripts() {
  const ctx = useContext(ScriptContext);
  if (!ctx) throw new Error('useScripts must be used inside ScriptProvider');
  return ctx;
}