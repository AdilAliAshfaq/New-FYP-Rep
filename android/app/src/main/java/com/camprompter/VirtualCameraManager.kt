package com.camprompter

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class VirtualCameraManager : SimpleViewManager<VirtualCameraView>() {

    override fun getName() = "VirtualCamera"

    override fun createViewInstance(reactContext: ThemedReactContext): VirtualCameraView {
        return VirtualCameraView(reactContext)
    }

    @ReactProp(name = "cameraPosition")
    fun setCameraPosition(view: VirtualCameraView, position: String?) {
        view.setCameraPosition(position ?: "front")
    }

    @ReactProp(name = "backgroundSource")
    fun setBackgroundSource(view: VirtualCameraView, source: String?) {
        view.setBackgroundSource(source)
    }
    
    @ReactProp(name = "isRecording")
    fun setIsRecording(view: VirtualCameraView, isRecording: Boolean) {
        // Handle recording state if needed in your native view
    }
}