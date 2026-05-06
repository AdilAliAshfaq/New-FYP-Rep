package com.camprompter

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class VirtualCameraManager : SimpleViewManager<VirtualCameraView>() {

<<<<<<< HEAD
    override fun getName(): String {
        return "VirtualCamera"
    }
=======
    override fun getName() = "VirtualCamera"
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69

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
<<<<<<< HEAD

    @ReactProp(name = "isRecording")
    fun setIsRecording(view: VirtualCameraView, isRecording: Boolean) {
        view.setIsRecording(isRecording)
=======
    
    @ReactProp(name = "isRecording")
    fun setIsRecording(view: VirtualCameraView, isRecording: Boolean) {
        // Handle recording state if needed in your native view
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
    }
}