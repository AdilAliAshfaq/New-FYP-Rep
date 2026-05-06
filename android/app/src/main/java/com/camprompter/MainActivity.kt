package com.camprompter

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "CamPrompter"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Pre-request RECORD_AUDIO and CAMERA at app launch so the WebView's Web Speech API
   * and the ML Kit Virtual Camera have necessary access immediately.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val audioPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
    val cameraPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)

    // If either permission is missing, request both
    if (audioPermission != PackageManager.PERMISSION_GRANTED || 
        cameraPermission != PackageManager.PERMISSION_GRANTED) {
      
      ActivityCompat.requestPermissions(
        this,
        arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA // Added Camera Permission
        ),
        1001
      )
    }
  }
}