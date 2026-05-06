import { NativeModules, NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';

const { SpeechModule } = NativeModules;

if (!SpeechModule) {
  console.warn(
    '[SpeechRecognition] Native module not found. Did you register SpeechPackage in MainApplication.kt and rebuild?',
  );
}

const emitter = SpeechModule ? new NativeEventEmitter(SpeechModule) : null;

export async function requestMicPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'Needed to track your voice while reading the teleprompter.',
        buttonPositive: 'OK',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    return false;
  }
}

export async function isOnDeviceSupported() {
  if (!SpeechModule) return false;
  try {
    return await SpeechModule.isOnDeviceSupported();
  } catch {
    return false;
  }
}

export async function checkLanguagePack(locale = 'en-US') {
  if (!SpeechModule) return { status: 'unsupported', locale, reason: 'module not registered' };
  try {
    return await SpeechModule.checkLanguagePack(locale);
  } catch (e) {
    return { status: 'unsupported', locale, reason: e?.message };
  }
}

export async function downloadLanguagePack(locale = 'en-US') {
  if (!SpeechModule) throw new Error('Native module not registered');
  return await SpeechModule.downloadLanguagePack(locale);
}

export function start(options = {}) {
  if (!SpeechModule) return Promise.reject(new Error('Native module not registered'));
  return SpeechModule.start({
    lang: options.lang || 'en-US',
    onDevice: options.onDevice !== false,
  });
}

export function stop() {
  if (!SpeechModule) return Promise.resolve();
  return SpeechModule.stop();
}

export function addListener(event, handler) {
  if (!emitter) return () => {};
  
  // ── THE FIX: Added speakingStart and speakingEnd events ──
  const nativeEventName = {
    start: 'onSpeechStart',
    result: 'onSpeechResult',
    error: 'onSpeechError',
    end: 'onSpeechEnd',
    log: 'onSpeechLog',
    speakingStart: 'onSpeechStartSpeaking', 
    speakingEnd: 'onSpeechStopSpeaking',    
  }[event];
  
  if (!nativeEventName) throw new Error(`Unknown event: ${event}`);
  const sub = emitter.addListener(nativeEventName, handler);
  return () => sub.remove();
}

export default {
  requestMicPermission,
  isOnDeviceSupported,
  checkLanguagePack,
  downloadLanguagePack,
  start,
  stop,
  addListener,
};