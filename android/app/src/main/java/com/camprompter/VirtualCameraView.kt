package com.camprompter

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.uimanager.ThemedReactContext
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@SuppressLint("ViewConstructor")
class VirtualCameraView(context: ThemedReactContext) : FrameLayout(context) {

    private val previewView: PreviewView = PreviewView(context)
    private val backgroundView: ImageView = ImageView(context)
    private val foregroundView: ImageView = ImageView(context)

    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraPosition: Int = CameraSelector.LENS_FACING_FRONT
    private var currentBackgroundSource: String? = null
<<<<<<< HEAD
    
    private var isRecording: Boolean = false
    private var isCameraStarted: Boolean = false
=======
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69

    // Initialize the AI Segmenter
    private val segmenter = SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder()
            .enableForegroundBitmap()
            .build()
    )

    init {
        // Layer 1: Raw Camera Feed (Bottom)
        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        
        // Layer 2: Background Image (Middle)
        backgroundView.scaleType = ImageView.ScaleType.CENTER_CROP
        backgroundView.visibility = View.GONE
        addView(backgroundView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        
        // Layer 3: AI Cut-out Foreground (Top)
        foregroundView.scaleType = ImageView.ScaleType.CENTER_CROP
        foregroundView.visibility = View.GONE
        addView(foregroundView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
<<<<<<< HEAD
    }

    // ── THE FIX: Wait until the screen is fully loaded before starting the camera ──
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (!isCameraStarted) {
            startCamera()
        }
    }

    // ── THE FIX: Safely kill the camera feed when leaving the screen ──
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            cameraProvider.unbindAll()
        }, ContextCompat.getMainExecutor(context))
        isCameraStarted = false
    }

=======
        
        startCamera()
    }

    // ── THE REACT NATIVE LAYOUT BUG FIX ──
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
    private val measureAndLayout = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        )
        layout(left, top, right, bottom)
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    fun setCameraPosition(position: String) {
        cameraPosition = if (position == "back") {
            CameraSelector.LENS_FACING_BACK
        } else {
            CameraSelector.LENS_FACING_FRONT
        }
<<<<<<< HEAD
        if (isCameraStarted) {
            startCamera()
        }
=======
        startCamera()
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
    }

    fun setBackgroundSource(source: String?) {
        currentBackgroundSource = source

        if (source == null || source == "") {
            post {
                backgroundView.visibility = View.GONE
                foregroundView.visibility = View.GONE
                backgroundView.setImageBitmap(null)
                foregroundView.setImageBitmap(null)
            }
        } else {
            post {
                backgroundView.visibility = View.VISIBLE
                foregroundView.visibility = View.VISIBLE
                backgroundView.setBackgroundColor(android.graphics.Color.parseColor("#1A1A2E")) 
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val url = URL(source)
                    val connection = url.openConnection()
                    connection.connectTimeout = 5000
                    val bitmap = BitmapFactory.decodeStream(connection.getInputStream())
                    withContext(Dispatchers.Main) {
                        if (bitmap != null) {
                            backgroundView.setImageBitmap(bitmap)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

<<<<<<< HEAD
    fun setIsRecording(recording: Boolean) {
        this.isRecording = recording
    }

=======
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
    @SuppressLint("UnsafeOptInUsageError")
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { analysis ->
                    analysis.setAnalyzer(cameraExecutor) { imageProxy: ImageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(cameraPosition)
                .build()

            try {
                cameraProvider.unbindAll()
                val reactContext = context as ThemedReactContext
                val lifecycleOwner = reactContext.currentActivity as? LifecycleOwner
                
                if (lifecycleOwner != null) {
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner, cameraSelector, preview, imageAnalyzer
                    )
<<<<<<< HEAD
                    isCameraStarted = true
=======
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
                }
            } catch (exc: Exception) {
                exc.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun processImageProxy(imageProxy: ImageProxy) {
<<<<<<< HEAD
        if (currentBackgroundSource == null || currentBackgroundSource == "") {
            imageProxy.close()
            return
        }

=======
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val rotationDegrees = imageProxy.imageInfo.rotationDegrees
            val image = InputImage.fromMediaImage(mediaImage, rotationDegrees)
            
            segmenter.process(image)
                .addOnSuccessListener { result ->
                    val fgBitmap = result.foregroundBitmap
                    
<<<<<<< HEAD
                    if (fgBitmap != null) {
                        val matrix = Matrix()
                        
=======
                    if (fgBitmap != null && currentBackgroundSource != null) {
                        val matrix = Matrix()
                        
                        // 1. Flip horizontally like a mirror (for front camera)
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
                        if (cameraPosition == CameraSelector.LENS_FACING_FRONT) {
                            matrix.postScale(-1f, 1f)
                        }
                        
<<<<<<< HEAD
                        val finalRotation = (rotationDegrees + 180) % 360
                        matrix.postRotate(finalRotation.toFloat())

=======
                        // 2. THE UPSIDE DOWN FIX: 
                        // Add 180 degrees to the sensor's rotation to flip you upright
                        val finalRotation = (rotationDegrees + 180) % 360
                        matrix.postRotate(finalRotation.toFloat())

                        // 3. Create the corrected bitmap
>>>>>>> cfdc119ce9bd5a79c2f7ad4c0824a3d9913b9b69
                        val correctedBitmap = Bitmap.createBitmap(
                            fgBitmap, 0, 0, fgBitmap.width, fgBitmap.height, matrix, true
                        )

                        foregroundView.post {
                            foregroundView.scaleX = 1f 
                            foregroundView.setImageBitmap(correctedBitmap)
                        }
                    }
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }
}