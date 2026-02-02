import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as BABYLON from '@babylonjs/core';
import SceneManager from './scene/SceneManager';
import ControlPanel from './components/ControlPanel';
import { FaImages, FaUndoAlt, FaExchangeAlt, FaFolderOpen, FaRedo, FaCube } from 'react-icons/fa';
import FilterToggleIcons from './components/FilterToggleIcons';
import LoadingScreen from './components/LoadingScreen';
import MobileToggle from './components/MobileToggle';
import TextureAtlas from './utils/TextureAtlas';
import ColorPalette from './components/ColorPalette';
import { ColorMaps } from './utils/ColorMaps';
import SliceControl from './components/SliceControl';
import { ControlGroup } from './components/ControlPanel';
import debounce from 'lodash/debounce';
import { SD_DIMENSIONS, HD_DIMENSIONS, VISUALIZATION, TARGET_FPS, UI, DEFAULT_VALUES } from './utils/constants';

const UltrasoundVisualizer = ({ 
  videoUrl, 
  fileName, // This is the prop
  setError, 
  onFileSelect,
  externalRectangle,
  setVideoUrl,
  isRotationLocked,
  onRotationLockChange
}) => {
  // Add this ref near the other refs at the top
  const currentHDMode = useRef(false);

  // Update the isHDMode state setter to also update the ref
  const [isHDMode, setIsHDMode] = useState(false);
  const setHDMode = useCallback((value) => {
    const newValue = typeof value === 'function' ? value(currentHDMode.current) : value;
    currentHDMode.current = newValue;
    setIsHDMode(newValue);
  }, []);

  // Add isResolutionChange ref here, with other refs
  const isResolutionChange = useRef(false);
  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const colorPaletteRef = useRef(null);
  const lastRenderTime = useRef(0);
  const animationFrameId = useRef(null);
  const currentExtractionRef = useRef(null);

  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [renderedFrames, setRenderedFrames] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [sliceRange, setSliceRange] = useState([0, 100]);
  const [textureAtlas, setTextureAtlas] = useState(null);
  const [globalLightIntensity, setGlobalLightIntensity] = useState(2.5);  // Changed from 1 to 2.5
  const [isColorPaletteExpanded, setIsColorPaletteExpanded] = useState(false);
  const [targetFps, setTargetFps] = useState(60);
  const [frameAspectRatio, setFrameAspectRatio] = useState(1.6); // Default to 1.6
  const [videoInfo, setVideoInfo] = useState({
    originalWidth: 0,
    originalHeight: 0,
    scaledWidth: 0,
    scaledHeight: 0,
    scaleFactor: 0
  });
  const [sliceRectangle, setSliceRectangle] = useState(null);
  const [storedVideoFile, setStoredVideoFile] = useState(null);
  const [showExtractionScreen, setShowExtractionScreen]=useState(true);

  // Update the defaultValues object to include all filter values
  const defaultValues = useMemo(() => ({
    stackLength: DEFAULT_VALUES.STACK_LENGTH,
    framePercentage: DEFAULT_VALUES.FRAME_PERCENTAGE,
    opacity: DEFAULT_VALUES.OPACITY,
    brightness: DEFAULT_VALUES.BRIGHTNESS,
    blendMode: BABYLON.Constants.ALPHA_COMBINE,
    sliceRange: DEFAULT_VALUES.SLICE_RANGE,
    isFrameOrderInverted: false,
    backgroundColor: DEFAULT_VALUES.BACKGROUND_COLOR,
    globalLightIntensity: DEFAULT_VALUES.GLOBAL_LIGHT_INTENSITY,
    exposure: DEFAULT_VALUES.EXPOSURE,
    contrast: DEFAULT_VALUES.CONTRAST,
    textureFilters: {
      brightness: 1,
      contrast: 0,
      isInverted: false,
      isGrayscale: false
    }
  }), []);

  const [stackLength, setStackLength] = useState(defaultValues.stackLength);
  const [framePercentage, setFramePercentage] = useState(defaultValues.framePercentage);
  const [opacity, setOpacity] = useState(defaultValues.opacity);
  const [brightness, setBrightness] = useState(defaultValues.brightness);
  const [blendMode, setBlendMode] = useState(defaultValues.blendMode);
  const [isFrameOrderInverted, setIsFrameOrderInverted] = useState(defaultValues.isFrameOrderInverted);
  const [backgroundColor, setBackgroundColor] = useState(defaultValues.backgroundColor);

  // Change this state variable name to displayFileName
  const [displayFileName, setDisplayFileName] = useState('');

  // Add color map state and parameters
  const [colorMap, setColorMap] = useState('DEFAULT');
  const [colorMapParams, setColorMapParams] = useState({});

  const [textureFilters, setTextureFilters] = useState({
    brightness: defaultValues.textureFilters.brightness,
    contrast: defaultValues.textureFilters.contrast,
    isInverted: defaultValues.textureFilters.isInverted,
    isGrayscale: defaultValues.textureFilters.isGrayscale
  });

  // Initialize color map parameters when color map changes
  useEffect(() => {
    const defaultParams = ColorMaps[colorMap]?.defaultParams || {};
    setColorMapParams(defaultParams);
  }, [colorMap]);

  // Update the useEffect to use the new state variable name
  useEffect(() => {
    if (fileName) {
      setDisplayFileName(fileName);
    } else {
      setDisplayFileName('No file selected');
    }
  }, [fileName]);

  // Remove or comment out the old useEffect that was trying to extract the file name from videoUrl

  // Move updateFrameStack definition before its first use
  // Add this before the useEffect that uses it (around line 138)

  // Modify updateFrameStack to apply opacity after creating meshes
  const updateFrameStack = useCallback(() => {
    if (sceneManagerRef.current && textureAtlas) {
      sceneManagerRef.current.clearFrameMeshes();
      const framesToShow = Math.max(2, Math.floor(textureAtlas.frames.length * (framePercentage / 100)));
      setRenderedFrames(framesToShow);
      
      const scale = 15;
      const actualFrameDistance = (stackLength / (framesToShow - 1)) * 1.5 * scale;
      const totalStackLength = (framesToShow - 1) * actualFrameDistance;
      const offset = totalStackLength / 2;

      const [startPercentage, endPercentage] = sliceRange;
      const startIndex = Math.floor(startPercentage / 100 * framesToShow);
      const endIndex = Math.ceil(endPercentage / 100 * framesToShow);

      for (let i = startIndex; i < endIndex; i++) {
        const frameIndex = isFrameOrderInverted
          ? textureAtlas.frames.length - 1 - Math.min(Math.floor(i * (textureAtlas.frames.length - 1) / (framesToShow - 1)), textureAtlas.frames.length - 1)
          : Math.min(Math.floor(i * (textureAtlas.frames.length - 1) / (framesToShow - 1)), textureAtlas.frames.length - 1);
        const position = new BABYLON.Vector3(0, 0, i * actualFrameDistance - offset);
        
        sceneManagerRef.current.createFrameMesh(textureAtlas.atlas, position, scale, {
          brightness,
          blendMode,
          uv: textureAtlas.getFrameUV(frameIndex),
          colorMap: (value) => ColorMaps[colorMap].map(value, colorMapParams)
        });
      }

      sceneManagerRef.current.updateMeshOpacity(opacity);
      sceneManagerRef.current.updateClipPlanes(currentClipBounds.current);
    }
  }, [
    textureAtlas,
    framePercentage,
    stackLength,
    sliceRange,
    isFrameOrderInverted,
    opacity,
    brightness,
    blendMode,
    colorMap,
    colorMapParams
  ]);

  // Then move the useEffect that uses it after the definition
  useEffect(() => {
    if (canvasRef.current) {
      // Only create a new scene manager if one doesn't exist
      if (!sceneManagerRef.current) {
        sceneManagerRef.current = new SceneManager(canvasRef.current);
        sceneManagerRef.current.initialize();
        sceneManagerRef.current.setBackgroundColor(backgroundColor);
        sceneManagerRef.current.setGlobalLightIntensity(globalLightIntensity);
      }

      const renderLoop = (time) => {
        if (time - lastRenderTime.current >= 1000 / targetFps) {
          if (sceneManagerRef.current) {
            sceneManagerRef.current.renderFrame();
          }
          lastRenderTime.current = time;
        }
        animationFrameId.current = requestAnimationFrame(renderLoop);
      };

      animationFrameId.current = requestAnimationFrame(renderLoop);

      // Cleanup only when component unmounts
      return () => {
        cancelAnimationFrame(animationFrameId.current);
      };
    }
  }, [targetFps, backgroundColor, globalLightIntensity]); // Add missing dependencies

  // Add a separate cleanup effect
  useEffect(() => {
    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.clearFrameMeshes();
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, []); // Empty dependency array for cleanup on unmount only

  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setBackgroundColor(backgroundColor);
    }
  }, [backgroundColor]);

  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setGlobalLightIntensity(globalLightIntensity);
    }
  }, [globalLightIntensity]);

  // Add this ref to track the latest extraction process
  const latestExtractionId = useRef(0);

  // Update the extractFrames function to use a ref for textureFilters
  // Add this ref near the other refs at the top
  const currentTextureFilters = useRef(textureFilters);

  // Update the textureFilters state setter to also update the ref
  useEffect(() => {
    currentTextureFilters.current = textureFilters;
  }, [textureFilters]);

  // Update the extractFrames function to use the ref
  const extractFrames = useCallback((video) => {
    return new Promise((resolve, reject) => {
      const currentExtractionId = latestExtractionId.current;
      
      if (currentExtractionRef.current) {
        currentExtractionRef.current.cancel();
      }

      let isCancelled = false;
      currentExtractionRef.current = { 
        cancel: () => { 
          isCancelled = true; 
        } 
      };

      const aspectRatio = video.videoWidth / video.videoHeight;
      setFrameAspectRatio(aspectRatio);

      // Determine target dimensions based on HD mode and device
      const isMobileDevice = window.innerWidth <= UI.MOBILE_BREAKPOINT;
      const dimensions = currentHDMode.current ? HD_DIMENSIONS : SD_DIMENSIONS;
      const targetDimensions = dimensions[isMobileDevice ? 'mobile' : 'desktop'];

      // Calculate scaled dimensions while maintaining aspect ratio
      let scaledWidth, scaledHeight;
      if (video.videoWidth / video.videoHeight > targetDimensions.width / targetDimensions.height) {
        scaledWidth = targetDimensions.width;
        scaledHeight = Math.round(targetDimensions.width / aspectRatio);
      } else {
        scaledHeight = targetDimensions.height;
        scaledWidth = Math.round(targetDimensions.height * aspectRatio);
      }

      setVideoInfo(prev => ({
        ...prev,
        originalWidth: video.videoWidth,
        originalHeight: video.videoHeight,
        scaledWidth,
        scaledHeight,
        scaleFactor: (scaledWidth / video.videoWidth).toFixed(2)
      }));

      // Rectangle setup code remains the same
      if (!externalRectangle && !isResolutionChange.current) {
        const margin = 0.1;
        const canvasWidth = 200;
        const canvasHeight = 200;
        const availableWidth = canvasWidth * (1 - 2 * margin);
        const availableHeight = canvasHeight * (1 - 2 * margin);

        let rectWidth, rectHeight;
        if (availableWidth / availableHeight > aspectRatio) {
          rectHeight = availableHeight;
          rectWidth = rectHeight * aspectRatio;
        } else {
          rectWidth = availableWidth;
          rectHeight = rectWidth / aspectRatio;
        }

        const rectX = (canvasWidth - rectWidth) / 2;
        const rectY = (canvasHeight - rectHeight) / 2;

        setSliceRectangle({
          x: rectX,
          y: rectY,
          width: rectWidth,
          height: rectHeight
        });
      }

      const totalFrameCount = Math.floor(video.duration * VISUALIZATION.FRAME_RATE);
      const maxFrames = VISUALIZATION.MAX_FRAMES;
      const frameStep = Math.max(1, Math.floor(totalFrameCount / maxFrames));
      const frameCount = Math.min(maxFrames, totalFrameCount);
      
      setTotalFrames(frameCount);

      // Create an OffscreenCanvas for frame extraction
      const extractionCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
      const extractionCtx = extractionCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });

      // Configure canvas for optimal performance
      extractionCtx.imageSmoothingEnabled = true;
      extractionCtx.imageSmoothingQuality = 'high';

      // Implement batch processing
      const BATCH_SIZE = VISUALIZATION.BATCH_SIZE;
      const extractBatch = async (startIdx, endIdx) => {
        const bitmaps = [];
        for (let i = startIdx; i < endIdx && i < frameCount; i++) {
          if (isCancelled || currentExtractionId !== latestExtractionId.current) {
            bitmaps.forEach(bitmap => bitmap.close());
            throw new Error('Frame extraction cancelled');
          }

          const currentFrame = i * frameStep;
          video.currentTime = currentFrame / 30;
          await new Promise(resolve => { video.onseeked = resolve; });

          // Draw to OffscreenCanvas and create bitmap in one step
          extractionCtx.drawImage(video, 0, 0, scaledWidth, scaledHeight);
          const bitmap = await createImageBitmap(extractionCanvas);
          bitmaps.push(bitmap);
          
          // Update progress for each individual frame
          setExtractionProgress((i + 1) / frameCount);
        }
        return bitmaps;
      };

      const extractAllFrames = async () => {
        const allBitmaps = [];
        let processedFrames = 0;
        try {
          for (let i = 0; i < frameCount; i += BATCH_SIZE) {
            const batchBitmaps = await extractBatch(i, i + BATCH_SIZE);
            allBitmaps.push(...batchBitmaps);
            processedFrames += batchBitmaps.length;
          }

          const atlas = new TextureAtlas(sceneManagerRef.current.scene);
          await atlas.createAtlas(allBitmaps);
          
          // Clean up bitmaps after atlas creation
          allBitmaps.forEach(bitmap => bitmap.close());
          
          atlas.applyFilters(currentTextureFilters.current);
          setTextureAtlas(atlas);
          resolve(processedFrames);
        } catch (error) {
          // ... error handling remains the same ...
        }
      };

      extractAllFrames().catch(reject).finally(() => {
        currentExtractionRef.current = null;
      });
    });
  }, [externalRectangle, isResolutionChange]);

  // Add cleanup in component unmount
  useEffect(() => {
    return () => {
      if (textureAtlas) {
        textureAtlas.dispose();
      }
    };
  }, [textureAtlas]);

  // Then keep handleResolutionToggle after it
  const handleResolutionToggle = useCallback(async () => {
    if (!storedVideoFile) return;

    isResolutionChange.current = true;
    
    // Cancel any ongoing extraction
    if (currentExtractionRef.current) {
        currentExtractionRef.current.cancel();
    }

    // Increment extraction ID
    latestExtractionId.current++;
    const currentExtractionId = latestExtractionId.current;
    
    // Toggle HD mode immediately and wait for the state to update
    await new Promise(resolve => {
        setHDMode(prev => !prev);
        setTimeout(resolve, 0);
    });
    
    // Don't clear the texture atlas yet - keep the old one visible
    setIsLocalLoading(true);
    setError(null);
    setExtractionProgress(0);
    setTotalFrames(0);
    setRenderedFrames(0);
    setShowExtractionScreen(false);

    // Create video element and set up promise for metadata loading
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    
    try {
        await new Promise((resolve, reject) => {
            video.addEventListener('loadedmetadata', resolve, { once: true });
            video.addEventListener('error', reject, { once: true });
            video.src = URL.createObjectURL(storedVideoFile);
            video.load();
        });

        if (currentExtractionId !== latestExtractionId.current) {
            return;
        }

        await video.play();
        video.pause();

        // Extract frames and create new atlas
        const frameCount = await extractFrames(video);
        
        // Only update states if this is still the latest extraction
        if (currentExtractionId === latestExtractionId.current) {
            setTotalFrames(frameCount);
            setIsLocalLoading(false);
        }
    } catch (error) {
        if (error.message !== 'Frame extraction cancelled') {
            setError(`Error extracting frames: ${error.message}`);
            setIsLocalLoading(false);
        }
    } finally {
        URL.revokeObjectURL(video.src);
        if (currentExtractionId === latestExtractionId.current) {
            isResolutionChange.current = false;
        }
        video.remove();
    }
}, [storedVideoFile, extractFrames, setError, setHDMode]);

  // Then the video loading effect
  useEffect(() => {
    if (!videoUrl) {
      setError('No video URL provided');
      setIsLocalLoading(false);
      return;
    }

    // Check for WebGL support
    if (!window.WebGLRenderingContext) {
      setError('WebGL is not supported on this device.');
      setIsLocalLoading(false);
      return;
    }

    // Store the video file
    if (videoUrl instanceof Blob) {
      setStoredVideoFile(videoUrl);
    } else {
      // If it's a URL, fetch the file first
      fetch(videoUrl)
        .then(response => response.blob())
        .then(blob => setStoredVideoFile(blob))
        .catch(error => setError(`Error storing video file: ${error.message}`));
    }

    // Only proceed with extraction if it's not a resolution change
    if (!isResolutionChange.current) {
      // Reset states for new video
      setTextureAtlas(null);
      setIsLocalLoading(true);
      setShowExtractionScreen(true);
      setError(null);
      setExtractionProgress(0);
      setTotalFrames(0);
      setRenderedFrames(0);

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;

      const handleVideoLoad = async () => {
        try {
          await video.play();
          video.pause();
          const frameCount = await extractFrames(video);
          setTotalFrames(frameCount);
          setIsLocalLoading(false);
        } catch (error) {
          if (error.message !== 'Frame extraction cancelled') {
            setError(`Error extracting frames: ${error.message}`);
            setIsLocalLoading(false);
          }
        }
      };

      const handleVideoError = (e) => {
        const mediaError = e.target?.error;
        let errorMessage = 'Unknown error';
        if (mediaError) {
          switch (mediaError.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = 'Video loading was aborted';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading video';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = 'Video decoding failed - file may be corrupted or unsupported codec';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Video format not supported';
              break;
            default:
              errorMessage = mediaError.message || `Error code: ${mediaError.code}`;
          }
        }
        setError(`Error loading video: ${errorMessage}`);
        setIsLocalLoading(false);
      };

      video.addEventListener('loadedmetadata', handleVideoLoad);
      video.addEventListener('error', handleVideoError);

      if (videoUrl instanceof Blob) {
        video.src = URL.createObjectURL(videoUrl);
      } else {
        video.src = videoUrl;
      }

      video.load();

      return () => {
        video.removeEventListener('loadedmetadata', handleVideoLoad);
        video.removeEventListener('error', handleVideoError);
        video.pause();
        video.src = '';
        if (videoUrl instanceof Blob) {
          URL.revokeObjectURL(video.src);
        }
      };
    }
  }, [videoUrl, setError, extractFrames, isResolutionChange]);

  // Add this before resetToDefaults
  const handleTextureFilterChange = useCallback((filters) => {
    if (textureAtlas) {
      // Don't trigger loading screen for filter changes
      setTextureFilters(filters);
      textureAtlas.applyFilters(filters);
    }
  }, [textureAtlas]);

  // Then the resetToDefaults function
  const resetToDefaults = useCallback(() => {
    setStackLength(defaultValues.stackLength);
    setFramePercentage(defaultValues.framePercentage);
    setOpacity(defaultValues.opacity);
    setBrightness(defaultValues.brightness);
    setBlendMode(defaultValues.blendMode);
    setSliceRange(defaultValues.sliceRange);
    setIsFrameOrderInverted(defaultValues.isFrameOrderInverted);
    setBackgroundColor(defaultValues.backgroundColor);
    setGlobalLightIntensity(defaultValues.globalLightIntensity);
    setExposure(defaultValues.exposure);
    setContrast(defaultValues.contrast);
    // Reset texture filters
    setTextureFilters(defaultValues.textureFilters);
    handleTextureFilterChange(defaultValues.textureFilters);
    
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateCameraSettings({
        inertia: 0.5,
        angularSensibilityX: 300,
        angularSensibilityY: 300,
        panningSensibility: 200,
        wheelPrecision: 2
      });
    }
  }, [defaultValues, handleTextureFilterChange]);

  // Add a ref to store the current clipping bounds
  const currentClipBounds = useRef({
    top: 1,
    bottom: -1,
    left: -1,
    right: 1
  });

  // Update the handleClipPlanesChange function to store the bounds
  const handleClipPlanesChange = useCallback((bounds) => {
    currentClipBounds.current = bounds;
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateClipPlanes(bounds);
    }
  }, []);

  // Add these refs near the top with other refs
  const updateFrameStackScheduled = useRef(false);
  const lastUpdateTime = useRef(0);
  const pendingUpdate = useRef(null);

  // Replace the throttledUpdateFrameStack with this new version
  const throttledUpdateFrameStack = useCallback(() => {
    if (!updateFrameStackScheduled.current) {
      updateFrameStackScheduled.current = true;

      const performUpdate = () => {
        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateTime.current;

        if (timeSinceLastUpdate >= 16) { // 60fps = ~16ms
          updateFrameStack();
          lastUpdateTime.current = now;
          updateFrameStackScheduled.current = false;
          pendingUpdate.current = null;
        } else {
          // Schedule next update
          pendingUpdate.current = requestAnimationFrame(performUpdate);
        }
      };

      pendingUpdate.current = requestAnimationFrame(performUpdate);
    }
  }, [updateFrameStack]);

  // Add cleanup for the pending updates
  useEffect(() => {
    return () => {
      if (pendingUpdate.current) {
        cancelAnimationFrame(pendingUpdate.current);
      }
    };
  }, []);

  // Update handleImmediateUpdate
  const handleImmediateUpdate = useCallback((setter, property) => {
    return (value) => {
      setter(value);
      if (sceneManagerRef.current && textureAtlas) {
        switch (property) {
          case 'opacity':
            sceneManagerRef.current.updateMeshOpacity(value);
            break;
          case 'brightness':
            sceneManagerRef.current.updateMeshBrightness(
              value,
              (v) => ColorMaps[colorMap].map(v, colorMapParams)
            );
            break;
          default:
            // For other properties, use the full stack update
            throttledUpdateFrameStack();
        }
      }
    };
  }, [textureAtlas, colorMap, colorMapParams, throttledUpdateFrameStack]);

  useEffect(() => {
    throttledUpdateFrameStack();
  }, [opacity, brightness, throttledUpdateFrameStack]);

  useEffect(() => {
    const handleResize = () => {
      const isMobileDevice = window.innerWidth <= UI.MOBILE_BREAKPOINT;
      setIsMobile(isMobileDevice);
      setTargetFps(isMobileDevice ? TARGET_FPS.mobile : TARGET_FPS.desktop);

      if (sceneManagerRef.current) {
        // Store camera state before resize
        const cameraState = sceneManagerRef.current.camera ? {
          position: sceneManagerRef.current.camera.position.clone(),
          target: sceneManagerRef.current.camera.target.clone(),
          radius: sceneManagerRef.current.camera.radius,
          alpha: sceneManagerRef.current.camera.alpha,
          beta: sceneManagerRef.current.camera.beta
        } : null;

        // Don't clear meshes before resize
        sceneManagerRef.current.engine.resize(true);

        // Wait for next frame to ensure resize is complete
        requestAnimationFrame(() => {
          if (cameraState) {
            // Restore camera state
            sceneManagerRef.current.camera.position = cameraState.position;
            sceneManagerRef.current.camera.target = cameraState.target;
            sceneManagerRef.current.camera.radius = cameraState.radius;
            sceneManagerRef.current.camera.alpha = cameraState.alpha;
            sceneManagerRef.current.camera.beta = cameraState.beta;
          }

          // Update scene properties
          sceneManagerRef.current.setBackgroundColor(backgroundColor);
          
          // Only rebuild frame stack if needed
          if (textureAtlas && !sceneManagerRef.current.hasMeshes()) {
            updateFrameStack();
          }
        });
      }
    };

    // Add debouncing to prevent multiple rapid resizes
    const debouncedResize = debounce(handleResize, 250);

    handleResize(); // Initial resize
    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      debouncedResize.cancel();
    };
  }, [updateFrameStack, backgroundColor, textureAtlas]);

  useEffect(() => {
    if (textureAtlas) {
      updateFrameStack();
    }
  }, [textureAtlas, updateFrameStack]);

  const handleSliceRangeChange = useCallback((newRange) => {
    setSliceRange(newRange);
  }, []);

  const backgroundColors = ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666'];

  const resetCamera = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.resetCamera();
    }
  }, []);

  const toggleFrameOrderInversion = useCallback(() => {
    setIsFrameOrderInverted(prev => !prev);
  }, []);

  const toggleColorPalette = useCallback(() => {
    setIsColorPaletteExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    if (colorPaletteRef.current) {
      if (isColorPaletteExpanded) {
        colorPaletteRef.current.style.maxHeight = `${colorPaletteRef.current.scrollHeight}px`;
        colorPaletteRef.current.style.opacity = '1';
      } else {
        colorPaletteRef.current.style.maxHeight = '0';
        colorPaletteRef.current.style.opacity = '0';
      }
    }
  }, [isColorPaletteExpanded]);

  const handleFileSelect = useCallback(() => {
    if (onFileSelect && typeof onFileSelect === 'function') {
      try {
        onFileSelect();
      } catch (error) {
        console.error('Error in file selection:', error);
        setError('Failed to open file selection. Please try again.');
      }
    } else {
      console.error('onFileSelect is not a function');
      setError('File selection is not available. Please refresh the page and try again.');
    }
  }, [onFileSelect, setError]);

  // Add these state declarations near the other useState declarations
  const [exposure, setExposure] = useState(1);
  const [contrast, setContrast] = useState(1);

  // Add these handlers near the other handleImmediateUpdate handlers
  const onImmediateExposureChange = useCallback((value) => {
    setExposure(value);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateExposure(value);
    }
  }, []);

  const onImmediateContrastChange = useCallback((value) => {
    setContrast(value);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateContrast(value);
    }
  }, []);

  // Add this handler
  const handleSliceRectangleChange = useCallback((newRectangle) => {
    setSliceRectangle(newRectangle);
  }, []);

  // Add this function near the top of the component to determine if HD is available
  const isHDAvailable = useMemo(() => {
    const { originalWidth, originalHeight } = videoInfo;
    if (!originalWidth || !originalHeight) return false;
    
    const largerDimension = Math.max(originalWidth, originalHeight);
    
    // Check if the original resolution is higher than SD resolution
    const sdDimensions = window.innerWidth <= 768 ? SD_DIMENSIONS.mobile : SD_DIMENSIONS.desktop;
    const maxSdDimension = Math.max(sdDimensions.width, sdDimensions.height);
    
    return largerDimension > maxSdDimension;
  }, [videoInfo]);

  // Add new state for camera mode
  const [isOrthographic, setIsOrthographic] = useState(false);

  // Add toggle function
  const toggleCameraMode = useCallback(() => {
    setIsOrthographic(prev => {
      const newMode = !prev;
      if (sceneManagerRef.current) {
        sceneManagerRef.current.setCameraMode(newMode ? 'orthographic' : 'perspective');
      }
      return newMode;
    });
  }, []);

  const [showCentralInfo, setShowCentralInfo] = useState(window.innerWidth >= 1000);

  useEffect(() => {
    const handleResize = () => {
      setShowCentralInfo(window.innerWidth >= 1100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ flex: 1, position: 'relative', height: isMobile ? 'calc(100% - 50px)' : '100%' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Top controls */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000,
        }}>
          {/* File name row with folder icon and HD button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            marginBottom: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            position: 'relative',
          }}>
            {/* Folder icon on the left */}
            <FaFolderOpen 
              style={{ 
                fontSize: '24px',
                cursor: 'pointer', 
                color: 'white',
                position: 'absolute',
                left: 0,
              }} 
              onClick={handleFileSelect}
              title="Choose New File"
            />
            
            {/* Centered filename - updated for scrolling */}
            <div style={{
              flex: 1,
              position: 'relative',
              margin: '0 45px', // Space for icons on both sides
              overflow: 'hidden', // Hide overflow for child scroll
            }}>
              <div style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                paddingBottom: '6px', // Space for scrollbar
                // Hide scrollbar but keep functionality
                msOverflowStyle: 'none', // IE and Edge
                scrollbarWidth: 'none', // Firefox
                // Custom scrollbar for webkit browsers
                WebkitOverflowScrolling: 'touch',
              }}>
                {/* Actual filename text */}
                <div style={{
                  display: 'inline-block', // Keep text in one line
                  paddingLeft: '20px',
                  paddingRight: '20px',
                }}>
                  {displayFileName}
                </div>
              </div>
            </div>

            {/* HD/SD Toggle Button - moved to top right */}
            {isHDAvailable && (
              <div 
                style={{ 
                  width: '38px', // Increased from 32px (1.2 times larger)
                  height: '38px', // Increased from 32px (1.2 times larger)
                  borderRadius: '50%',
                  position: 'absolute',
                  right: 0,
                  cursor: isLocalLoading ? 'default' : 'pointer',
                  userSelect: 'none',
                }} 
                onClick={isLocalLoading ? undefined : handleResolutionToggle}
                title={isLocalLoading ? 'Processing...' : `Switch to ${isHDMode ? 'SD' : 'HD'} mode`}
              >
                {/* Background circle */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: isHDMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }} />

                {/* Progress circle - replaced with SVG */}
                {isLocalLoading && (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: 'rotate(-90deg)',
                      filter: 'drop-shadow(0 0 2px rgba(52, 152, 219, 0.5))'
                    }}
                    width="38"
                    height="38"
                    viewBox="0 0 38 38"
                  >
                    <circle
                      cx="19"
                      cy="19"
                      r="18"
                      fill="none"
                      stroke="#3498db"
                      strokeWidth="2"
                      strokeDasharray={`${extractionProgress * 113.04} 113.04`} // Updated circumference for larger circle
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* HD text */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, calc(-50% - 1px))',
                  color: isHDMode ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: '19px', // Increased from 16px (proportionally larger)
                  fontWeight: 'bold',
                  opacity: isLocalLoading ? 0.5 : 1,
                  transition: 'opacity 0.3s ease',
                }}>
                  HD
                </div>
              </div>
            )}
          </div>

          {/* Controls container */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
          }}>
            {/* Desktop layout - Action icons on the left */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <FaUndoAlt 
                  style={{ cursor: 'pointer', color: 'white' }} 
                  onClick={resetCamera}
                  title="Reset Camera"
                  size={24}  // Increased from default size
                />
                <FaExchangeAlt 
                  style={{ cursor: 'pointer', color: isFrameOrderInverted ? '#3498db' : 'white' }} 
                  onClick={toggleFrameOrderInversion}
                  title="Invert Frame Order"
                  size={24}  // Increased from default size
                />
                <FaRedo
                  style={{ cursor: 'pointer', color: 'white' }}
                  onClick={resetToDefaults}
                  title="Reset to Defaults"
                  size={24}  // Increased from default size
                />
                <FilterToggleIcons
                  textureFilters={textureFilters}
                  onFilterChange={(newFilters) => {
                    setTextureFilters(newFilters);
                    handleTextureFilterChange(newFilters);
                  }}
                />
              </div>
            )}

            {/* Central info section - updated to hide based on screen width */}
            {showCentralInfo && (
              <div style={{ 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '20px',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FaImages style={{ marginRight: '8px' }} />
                  <span>{renderedFrames}</span>
                </div>

                {videoInfo.originalWidth > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '15px',
                    fontSize: '14px',
                    color: '#a0aec0'
                  }}>
                    <div title="Original Resolution">
                      {videoInfo.originalWidth}×{videoInfo.originalHeight}
                    </div>
                    <div style={{ color: '#3498db' }} title="Scaling Factor">
                      →{videoInfo.scaleFactor}×
                    </div>
                    <div title="Scaled Resolution">
                      {videoInfo.scaledWidth}×{videoInfo.scaledHeight}
                    </div>
                  </div>
                )}

                <div style={{
                  color: '#3498db',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}>
                  {targetFps} FPS
                </div>
              </div>
            )}

            {/* Mobile version of central info - shown only on mobile */}
            {isMobile && (
              <div style={{ 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '15px',
                width: '100%',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FaImages style={{ marginRight: '8px' }} />
                  <span>{renderedFrames}</span>
                </div>

                {videoInfo.originalWidth > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: '#a0aec0'
                  }}>
                    <div title="Original Resolution">
                      {videoInfo.originalWidth}×{videoInfo.originalHeight}
                    </div>
                    <div style={{ color: '#3498db' }} title="Scaling Factor">
                      →{videoInfo.scaleFactor}×
                    </div>
                    <div title="Scaled Resolution">
                      {videoInfo.scaledWidth}×{videoInfo.scaledHeight}
                    </div>
                  </div>
                )}

                <div style={{
                  color: '#3498db',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}>
                  {targetFps} FPS
                </div>
              </div>
            )}

            {/* Desktop layout - Color palette and camera mode on the right */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <ColorPalette
                  colors={backgroundColors}
                  selectedColor={backgroundColor}
                  onColorSelect={setBackgroundColor}
                />
                <FaCube
                  style={{ 
                    cursor: 'pointer', 
                    color: isOrthographic ? '#3498db' : 'white',
                    transition: 'color 0.2s ease',
                    fontSize: '24px'  // Added this line to make it bigger
                  }}
                  onClick={toggleCameraMode}
                  title={`Switch to ${isOrthographic ? 'Perspective' : 'Orthographic'} View`}
                />
              </div>
            )}

            {/* Mobile layout - Bottom row with action icons and color palette */}
            {isMobile && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                {/* Left side - Action icons */}
                <div style={{ display: 'flex', gap: '15px' }}>
                  <FaUndoAlt 
                    style={{ cursor: 'pointer', color: 'white' }} 
                    onClick={resetCamera}
                    title="Reset Camera"
                    size={24}  // Added size prop
                  />
                  <FaExchangeAlt 
                    style={{ cursor: 'pointer', color: isFrameOrderInverted ? '#3498db' : 'white' }} 
                    onClick={toggleFrameOrderInversion}
                    title="Invert Frame Order"
                    size={24}  // Added size prop
                  />
                  <FaRedo
                    style={{ cursor: 'pointer', color: 'white' }}
                    onClick={resetToDefaults}
                    title="Reset to Defaults"
                    size={24}  // Added size prop
                  />
                  <FilterToggleIcons
                    textureFilters={textureFilters}
                    onFilterChange={(newFilters) => {
                      setTextureFilters(newFilters);
                      handleTextureFilterChange(newFilters);
                    }}
                  />
                </div>

                {/* Right side - Color palette and camera mode */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: backgroundColor,
                        cursor: 'pointer',
                        border: '2px solid white',
                        transition: 'transform 0.3s ease-in-out',
                        transform: isColorPaletteExpanded ? 'scale(1.1)' : 'scale(1)',
                      }}
                      onClick={toggleColorPalette}
                    />
                    <div
                      ref={colorPaletteRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: '0', // Changed from left: '0' to right: '0'
                        marginTop: '5px',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        borderRadius: '5px',
                        padding: '5px',
                        maxHeight: '0',
                        opacity: '0',
                        overflow: 'hidden',
                        transition: 'max-height 0.2s ease-in-out, opacity 0.2s ease-in-out',
                        zIndex: 1,
                      }}
                    >
                      <ColorPalette
                        colors={backgroundColors}
                        selectedColor={backgroundColor}
                        onColorSelect={(color) => {
                          setBackgroundColor(color);
                          setIsColorPaletteExpanded(false);
                        }}
                      />
                    </div>
                  </div>
                  <FaCube
                    style={{ 
                      cursor: 'pointer', 
                      color: isOrthographic ? '#3498db' : 'white',
                      transition: 'color 0.2s ease',
                      fontSize: '24px'  // Added this line to make it bigger
                    }}
                    onClick={toggleCameraMode}
                    title={`Switch to ${isOrthographic ? 'Perspective' : 'Orthographic'} View`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {isLocalLoading && showExtractionScreen && (
          <LoadingScreen
            extractionProgress={extractionProgress}
            totalFrames={totalFrames}
            videoInfo={videoInfo}
          />
        )}
      </div>

      {isMobile && (
        <MobileToggle
          isOpen={isControlPanelOpen}
          onToggle={() => setIsControlPanelOpen(!isControlPanelOpen)}
        />
      )}
      <ControlPanel
        stackLength={stackLength}
        setStackLength={setStackLength}
        framePercentage={framePercentage}
        setFramePercentage={setFramePercentage}
        opacity={opacity}
        setOpacity={setOpacity}
        brightness={brightness}
        setBrightness={setBrightness}
        blendMode={blendMode}
        setBlendMode={setBlendMode}
        sliceRange={sliceRange}
        setSliceRange={handleSliceRangeChange}
        isMobile={isMobile}
        isOpen={!isMobile || isControlPanelOpen}
        onImmediateOpacityChange={handleImmediateUpdate(setOpacity, 'opacity')}
        onImmediateBrightnessChange={handleImmediateUpdate(setBrightness, 'brightness')}
        globalLightIntensity={globalLightIntensity}
        setGlobalLightIntensity={setGlobalLightIntensity}
        colorMap={colorMap}
        setColorMap={setColorMap}
        colorMapParams={colorMapParams}
        setColorMapParams={setColorMapParams}
        onImmediateGlobalLightChange={handleImmediateUpdate(setGlobalLightIntensity)}
        onClipPlanesChange={handleClipPlanesChange}
        onImmediateStackLengthChange={handleImmediateUpdate(setStackLength)}
        onImmediateFramePercentageChange={handleImmediateUpdate(setFramePercentage)}
        onImmediateSlicePositionChange={(newPosition) => {
          const rangeWidth = sliceRange[1] - sliceRange[0];
          const newStart = Math.max(0, Math.min(newPosition, 100 - rangeWidth));
          const newEnd = Math.min(100, newStart + rangeWidth);
          handleSliceRangeChange([newStart, newEnd]);
          updateFrameStack();
        }}
        exposure={exposure}
        setExposure={setExposure}
        contrast={contrast}
        setContrast={setContrast}
        onImmediateExposureChange={onImmediateExposureChange}
        onImmediateContrastChange={onImmediateContrastChange}
        rectangle={sliceRectangle}
        onRectangleChange={handleSliceRectangleChange}
        style={{
          height: isMobile ? (isControlPanelOpen ? '340px' : '0') : '100%',
        }}
        frameAspectRatio={frameAspectRatio}
        isOrthographic={isOrthographic}
        textureFilters={textureFilters}
        setTextureFilters={setTextureFilters}
        onTextureFilterChange={handleTextureFilterChange}
        isRotationLocked={isRotationLocked}
        onRotationLockChange={onRotationLockChange}
      >
        <ControlGroup isMobile={isMobile}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
            <SliceControl
              width={200}
              height={200}
              onClipPlanesChange={handleClipPlanesChange}
              rectangle={sliceRectangle}
              onRectangleChange={handleSliceRectangleChange}
            />
          </div>
        </ControlGroup>
      </ControlPanel>
    </div>
  );
};

export default UltrasoundVisualizer;
