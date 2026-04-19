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
    console.warn('[SpeechRecognition] permission error:', e);
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

/**
 * Check whether the on-device language pack is installed for a given locale.
 * @param {string} locale  e.g. 'en-US'
 * @returns {Promise<{ status: 'installed' | 'available-to-download' | 'unsupported', locale: string, reason?: string }>}
 */
export async function checkLanguagePack(locale = 'en-US') {
  if (!SpeechModule) return { status: 'unsupported', locale, reason: 'module not registered' };
  try {
    return await SpeechModule.checkLanguagePack(locale);
  } catch (e) {
    return { status: 'unsupported', locale, reason: e?.message };
  }
}

/**
 * Trigger the system download of the on-device language pack.
 * Shows a system dialog to the user.
 * @param {string} locale  e.g. 'en-US'
 * @returns {Promise<{ status: 'downloaded' | 'scheduled' | 'failed', locale: string, reason?: string }>}
 */
export async function downloadLanguagePack(locale = 'en-US') {
  if (!SpeechModule) throw new Error('Native module not registered');
  return await SpeechModule.downloadLanguagePack(locale);
}

export function start(options = {}) {
  if (!SpeechModule) return Promise.reject(new Error('Native module not registered'));
  return SpeechModule.start({
    lang: options.lang || 'en-US',
    onDevice: options.onDevice !== false, // default true
  });
}

export function stop() {
  if (!SpeechModule) return Promise.resolve();
  return SpeechModule.stop();
}

export function addListener(event, handler) {
  if (!emitter) return () => {};
  const nativeEventName = {
    start: 'onSpeechStart',
    result: 'onSpeechResult',
    error: 'onSpeechError',
    end: 'onSpeechEnd',
    log: 'onSpeechLog',
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