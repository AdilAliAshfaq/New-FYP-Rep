package com.camprompter

import android.annotation.SuppressLint
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner // <-- MISSING IMPORT ADDED
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SmartCameraViewManager : SimpleViewManager<PreviewView>() {

    override fun getName() = "SmartCamera"

    private lateinit var cameraExecutor: ExecutorService
    private var currentBackgroundSource: String? = null
    private var cameraPosition: Int = CameraSelector.LENS_FACING_FRONT

    private val segmenter = SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder()
            .enableForegroundConfidenceMask()
            .build()
    )

    override fun createViewInstance(reactContext: ThemedReactContext): PreviewView {
        val view = PreviewView(reactContext)
        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera(view, reactContext)
        return view
    }

    @ReactProp(name = "cameraPosition")
    fun setCameraPosition(view: PreviewView, position: String?) {
        cameraPosition = if (position == "back") {
            CameraSelector.LENS_FACING_BACK
        } else {
            CameraSelector.LENS_FACING_FRONT
        }
        startCamera(view, view.context as ThemedReactContext)
    }

    @ReactProp(name = "backgroundSource")
    fun setBackgroundSource(view: PreviewView, source: String?) {
        this.currentBackgroundSource = source
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun startCamera(view: PreviewView, context: ThemedReactContext) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(view.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        val mediaImage = imageProxy.image
                        if (mediaImage != null) {
                            val image = com.google.mlkit.vision.common.InputImage.fromMediaImage(
                                mediaImage, imageProxy.imageInfo.rotationDegrees
                            )
                            
                            segmenter.process(image)
                                .addOnSuccessListener { result ->
                                    val mask = result.foregroundConfidenceMask
                                }
                                .addOnCompleteListener {
                                    imageProxy.close()
                                }
                        } else {
                            imageProxy.close()
                        }
                    }
                }

            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(cameraPosition)
                .build()

            try {
                cameraProvider.unbindAll()
                
                // ── THE FIX: ACTUALLY TURN THE CAMERA ON ──
                val lifecycleOwner = context.currentActivity as? LifecycleOwner
                if (lifecycleOwner != null) {
                    cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalyzer)
                }
                
            } catch (exc: Exception) {
                exc.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
    }
}