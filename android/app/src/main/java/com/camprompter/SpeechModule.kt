package com.camprompter

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.ModelDownloadListener
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.concurrent.Executors

class SpeechModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var recognizer: SpeechRecognizer? = null
  private var useOnDevice = true
  private var shouldKeepRunning = false
  private var currentLocale = "en-US"
  private var hasFallenBack = false
  private val handler = Handler(Looper.getMainLooper())

  override fun getName() = "SpeechModule"

  @ReactMethod fun addListener(eventName: String) { /* no-op */ }
  @ReactMethod fun removeListeners(count: Int) { /* no-op */ }

  @ReactMethod
  fun isOnDeviceSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
  }

  @ReactMethod
  fun requestMicPermission(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun checkLanguagePack(locale: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(Arguments.createMap().apply {
        putString("status", "unsupported")
        putString("locale", locale)
        putString("reason", "Android 13+ required")
      })
      return
    }

    handler.post {
      try {
        val checker = SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        }

        checker.checkRecognitionSupport(
          intent,
          Executors.newSingleThreadExecutor(),
          object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) {
              val installed = support.installedOnDeviceLanguages
              val available = support.supportedOnDeviceLanguages
              val pending = support.pendingOnDeviceLanguages

              val normLocale = locale.replace("_", "-").lowercase(Locale.ROOT)
              val matches: (List<String>) -> Boolean = { list ->
                list.any { it.replace("_", "-").lowercase(Locale.ROOT) == normLocale }
              }

              val status = when {
                matches(installed) -> "installed"
                matches(available) || matches(pending) -> "available-to-download"
                else -> "unsupported"
              }

              emitEvent("onSpeechLog", Arguments.createMap().apply {
                putString("message", "Pack: installed=${installed.size} available=${available.size}")
              })

              handler.post { try { checker.destroy() } catch (_: Exception) {} }
              promise.resolve(Arguments.createMap().apply {
                putString("status", status)
                putString("locale", locale)
              })
            }

            override fun onError(error: Int) {
              handler.post { try { checker.destroy() } catch (_: Exception) {} }
              promise.resolve(Arguments.createMap().apply {
                putString("status", "unsupported")
                putString("locale", locale)
                putString("reason", "check error: $error")
              })
            }
          }
        )
      } catch (e: Exception) {
        promise.resolve(Arguments.createMap().apply {
          putString("status", "unsupported")
          putString("locale", locale)
          putString("reason", e.message ?: "unknown")
        })
      }
    }
  }

  @ReactMethod
  fun downloadLanguagePack(locale: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.reject("UNSUPPORTED", "Android 13+ required")
      return
    }

    handler.post {
      try {
        val downloader = SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        }

        var resolved = false

        downloader.triggerModelDownload(
          intent,
          Executors.newSingleThreadExecutor(),
          object : ModelDownloadListener {
            override fun onProgress(completedBytes: Int) {
              emitEvent("onSpeechLog", Arguments.createMap().apply {
                putString("message", "DL: $completedBytes bytes")
              })
            }
            override fun onSuccess() {
              if (resolved) return; resolved = true
              handler.post { try { downloader.destroy() } catch (_: Exception) {} }
              promise.resolve(Arguments.createMap().apply {
                putString("status", "downloaded"); putString("locale", locale)
              })
            }
            override fun onScheduled() {
              if (resolved) return; resolved = true
              handler.post { try { downloader.destroy() } catch (_: Exception) {} }
              promise.resolve(Arguments.createMap().apply {
                putString("status", "scheduled"); putString("locale", locale)
              })
            }
            override fun onError(error: Int) {
              if (resolved) return; resolved = true
              handler.post { try { downloader.destroy() } catch (_: Exception) {} }
              promise.resolve(Arguments.createMap().apply {
                putString("status", "failed"); putString("locale", locale)
                putString("reason", "error: $error")
              })
            }
          }
        )
      } catch (e: Exception) {
        promise.reject("DOWNLOAD_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun start(options: ReadableMap, promise: Promise) {
    handler.post {
      try {
        currentLocale = if (options.hasKey("lang")) options.getString("lang") ?: "en-US" else "en-US"
        useOnDevice = if (options.hasKey("onDevice")) options.getBoolean("onDevice") else true
        hasFallenBack = false
        createAndStart()
        promise.resolve(null)
      } catch (e: Exception) {
        emitEvent("onSpeechError", Arguments.createMap().apply {
          putString("error", "start-exception")
          putString("message", e.message ?: "unknown")
        })
        promise.reject("START_ERROR", e.message, e)
      }
    }
  }

  private fun buildRecognitionIntent(): Intent {
    val context = reactApplicationContext
    return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentLocale)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, currentLocale)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)

      // Key for concurrent mic with camera:
      // MediaRecorder.AudioSource.VOICE_RECOGNITION (6) — designed to coexist
      putExtra("android.speech.extra.AUDIO_SOURCE", 6)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, useOnDevice && !hasFallenBack)
      }

      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 60000L)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 60000L)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 10000L)
    }
  }

  private fun createAndStart() {
    destroyRecognizer()
    shouldKeepRunning = true

    val context = reactApplicationContext
    val canUseOnDevice = useOnDevice &&
                         Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                         !hasFallenBack

    recognizer = if (canUseOnDevice) {
      try {
        val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        emitEvent("onSpeechLog", Arguments.createMap().apply {
          putString("message", "On-device recognizer created")
        })
        r
      } catch (e: Exception) {
        emitEvent("onSpeechLog", Arguments.createMap().apply {
          putString("message", "On-device fail, fallback: ${e.message}")
        })
        hasFallenBack = true
        SpeechRecognizer.createSpeechRecognizer(context)
      }
    } else {
      emitEvent("onSpeechLog", Arguments.createMap().apply {
        putString("message", "Online recognizer")
      })
      SpeechRecognizer.createSpeechRecognizer(context)
    }

    if (recognizer == null) {
      emitEvent("onSpeechError", Arguments.createMap().apply {
        putString("error", "no-recognizer")
      })
      return
    }

    recognizer?.setRecognitionListener(listener)

    emitEvent("onSpeechLog", Arguments.createMap().apply {
      putString("message", "startListening (audio=VOICE_RECOGNITION)")
    })

    try {
      recognizer?.startListening(buildRecognitionIntent())
    } catch (e: Exception) {
      emitEvent("onSpeechError", Arguments.createMap().apply {
        putString("error", "startListening-threw")
        putString("message", e.message ?: "unknown")
      })
    }
  }

  /**
   * Fast restart — reuses the SAME recognizer instance. Keeps the mic warm,
   * avoids the 200-500ms gap from destroy+recreate.
   * Falls back to full createAndStart() if the recognizer is gone.
   */
  private fun restartListening() {
    val r = recognizer
    if (r == null) {
      createAndStart()
      return
    }
    try {
      r.startListening(buildRecognitionIntent())
      emitEvent("onSpeechLog", Arguments.createMap().apply {
        putString("message", "re-listening")
      })
    } catch (e: Exception) {
      emitEvent("onSpeechLog", Arguments.createMap().apply {
        putString("message", "restart err, recreating: ${e.message}")
      })
      createAndStart()
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    handler.post {
      shouldKeepRunning = false
      destroyRecognizer()
      promise.resolve(null)
    }
  }

  private fun destroyRecognizer() {
    try { recognizer?.stopListening() } catch (_: Exception) {}
    try { recognizer?.cancel() } catch (_: Exception) {}
    try { recognizer?.destroy() } catch (_: Exception) {}
    recognizer = null
  }

  private fun emitEvent(name: String, params: WritableMap?) {
    try {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, params)
    } catch (_: Exception) {}
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      emitEvent("onSpeechStart", Arguments.createMap())
      emitEvent("onSpeechLog", Arguments.createMap().apply { putString("message", "onReadyForSpeech") })
    }
    override fun onBeginningOfSpeech() {
      emitEvent("onSpeechLog", Arguments.createMap().apply { putString("message", "onBeginningOfSpeech") })
    }
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {
      emitEvent("onSpeechLog", Arguments.createMap().apply { putString("message", "onEndOfSpeech") })
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      if (!matches.isNullOrEmpty()) {
        emitEvent("onSpeechResult", Arguments.createMap().apply {
          putString("transcript", matches[0])
          putBoolean("isFinal", false)
        })
      }
    }

    override fun onResults(results: Bundle?) {
      val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      if (!matches.isNullOrEmpty()) {
        emitEvent("onSpeechResult", Arguments.createMap().apply {
          putString("transcript", matches[0])
          putBoolean("isFinal", true)
        })
      }

      if (shouldKeepRunning) {
        // Restart the SAME recognizer instance — no destroy/recreate gap
        handler.postDelayed({
          if (shouldKeepRunning) {
            try { restartListening() } catch (_: Exception) {}
          }
        }, 100)
      } else {
        emitEvent("onSpeechEnd", Arguments.createMap())
      }
    }

    override fun onError(error: Int) {
      val code = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "audio"
        SpeechRecognizer.ERROR_CLIENT -> "client"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permissions"
        SpeechRecognizer.ERROR_NETWORK -> "network"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network-timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "no-match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
        SpeechRecognizer.ERROR_SERVER -> "server"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speech-timeout"
        13 -> "language-not-supported"
        14 -> "language-unavailable"
        15 -> "server-disconnected"
        16 -> "too-many-requests"
        else -> "unknown-$error"
      }

      emitEvent("onSpeechError", Arguments.createMap().apply { putString("error", code) })

      val isSoftError = error == SpeechRecognizer.ERROR_NO_MATCH ||
                        error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT

      val shouldFallback = !hasFallenBack && useOnDevice && (
        error == SpeechRecognizer.ERROR_CLIENT ||
        error == 13 || error == 14 ||
        error == SpeechRecognizer.ERROR_SERVER
      )

      if (shouldFallback) {
        hasFallenBack = true
        emitEvent("onSpeechLog", Arguments.createMap().apply {
          putString("message", "Fallback to online: $code")
        })
        handler.postDelayed({
          if (shouldKeepRunning) { try { createAndStart() } catch (_: Exception) {} }
        }, 300)
        return
      }

      if (shouldKeepRunning && isSoftError) {
        handler.postDelayed({
          if (shouldKeepRunning) {
            try { restartListening() } catch (_: Exception) {}
          }
        }, 250)
      } else if (shouldKeepRunning && error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
        handler.postDelayed({
          if (shouldKeepRunning) { try { createAndStart() } catch (_: Exception) {} }
        }, 500)
      } else if (shouldKeepRunning && error == SpeechRecognizer.ERROR_AUDIO) {
        emitEvent("onSpeechLog", Arguments.createMap().apply {
          putString("message", "Audio err → retry in 800ms")
        })
        handler.postDelayed({
          if (shouldKeepRunning) { try { createAndStart() } catch (_: Exception) {} }
        }, 800)
      } else {
        shouldKeepRunning = false
        emitEvent("onSpeechEnd", Arguments.createMap())
      }
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    handler.post {
      shouldKeepRunning = false
      destroyRecognizer()
    }
  }
}