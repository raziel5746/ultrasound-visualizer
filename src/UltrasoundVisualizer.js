import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as BABYLON from '@babylonjs/core';
import SceneManager from './scene/SceneManager';
import ControlPanel from './components/ControlPanel';
import { FaImages, FaUndoAlt, FaExchangeAlt, FaFolderOpen, FaRedo, FaList, FaCog } from 'react-icons/fa';
import TextureAtlas from './utils/TextureAtlas';
import ColorPalette from './components/ColorPalette';
import { ColorMaps } from './utils/ColorMaps';
import SliceControl from './components/SliceControl';
import { ControlGroup } from './components/ControlPanel';
import debounce from 'lodash/debounce';

// Add these new constants for HD resolution
const SD_DIMENSIONS = {
  mobile: { width: 640, height: 480 },
  desktop: { width: 1280, height: 720 }
};

const HD_DIMENSIONS = {
  mobile: { width: 1280, height: 720 },
  desktop: { width: 1920, height: 1080 }
};

const UltrasoundVisualizer = ({ videoUrl, setError, onFileSelect }) => {
  // Move maxDimensions declaration to the top
  const [isHDMode, setIsHDMode] = useState(false);
  const maxDimensions = useMemo(() => {
    const isMobileDevice = window.innerWidth <= 768;
    const dimensions = isHDMode ? HD_DIMENSIONS : SD_DIMENSIONS;
    return dimensions[isMobileDevice ? 'mobile' : 'desktop'];
  }, [isHDMode]);

  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [renderedFrames, setRenderedFrames] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [sliceRange, setSliceRange] = useState([0, 100]);
  const [textureAtlas, setTextureAtlas] = useState(null);
  const [globalLightIntensity, setGlobalLightIntensity] = useState(1);
  const [showPresets, setShowPresets] = useState(false);
  const [isColorPaletteExpanded, setIsColorPaletteExpanded] = useState(false);
  const colorPaletteRef = useRef(null);
  const [targetFps, setTargetFps] = useState(60);
  const lastRenderTime = useRef(0);
  const animationFrameId = useRef(null);

  const defaultValues = useMemo(() => ({
    stackLength: 1.5,
    framePercentage: 50,
    opacity: 0.3,
    brightness: 1,
    blendMode: BABYLON.Constants.ALPHA_COMBINE,
    sliceRange: [0, 100],
    isFrameOrderInverted: false,
    backgroundColor: '#000000',
  }), []);

  const [stackLength, setStackLength] = useState(defaultValues.stackLength);
  const [framePercentage, setFramePercentage] = useState(defaultValues.framePercentage);
  const [opacity, setOpacity] = useState(defaultValues.opacity);
  const [brightness, setBrightness] = useState(defaultValues.brightness);
  const [blendMode, setBlendMode] = useState(defaultValues.blendMode);
  const [isFrameOrderInverted, setIsFrameOrderInverted] = useState(defaultValues.isFrameOrderInverted);
  const [backgroundColor, setBackgroundColor] = useState(defaultValues.backgroundColor);

  // Add state for file name
  const [fileName, setFileName] = useState('');

  // Add color map state and parameters
  const [colorMap, setColorMap] = useState('DEFAULT');
  const [colorMapParams, setColorMapParams] = useState({});

  // Initialize color map parameters when color map changes
  useEffect(() => {
    const defaultParams = ColorMaps[colorMap]?.defaultParams || {};
    setColorMapParams(defaultParams);
  }, [colorMap]);

  // Update the file name when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      if (videoUrl instanceof Blob) {
        // For files uploaded through input
        const name = videoUrl.name;
        // If name doesn't include extension, try to get it from type
        if (!name.includes('.')) {
          const extension = videoUrl.type.split('/')[1];
          setFileName(`${name}.${extension}`);
        } else {
          setFileName(name);
        }
      } else {
        // For URLs, extract the file name from the path
        const urlPath = videoUrl.split('/').pop().split('?')[0];
        const name = decodeURIComponent(urlPath);
        // If name doesn't include extension, add .mp4 as default
        if (!name.includes('.')) {
          setFileName(`${name}.mp4`);
        } else {
          setFileName(name);
        }
      }
    } else {
      setFileName('No file selected');
    }
  }, [videoUrl]);

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

  // Add frameAspectRatio state near other state declarations
  const [frameAspectRatio, setFrameAspectRatio] = useState(1.6); // Default to 1.6

  // Add these new states near other state declarations
  const [videoInfo, setVideoInfo] = useState({
    originalWidth: 0,
    originalHeight: 0,
    scaledWidth: 0,
    scaledHeight: 0,
    scaleFactor: 0
  });

  // Add this ref to keep track of the current extraction process
  const currentExtractionRef = useRef(null);

  // Modify the extractFrames function
  const extractFrames = useCallback((video) => {
    return new Promise((resolve, reject) => {
      // Cancel any ongoing extraction process
      if (currentExtractionRef.current) {
        currentExtractionRef.current.cancel();
      }

      let isCancelled = false;
      currentExtractionRef.current = { cancel: () => { isCancelled = true; } };

      const aspectRatio = video.videoWidth / video.videoHeight;
      setFrameAspectRatio(aspectRatio);

      // Store original dimensions
      setVideoInfo(prev => ({
        ...prev,
        originalWidth: video.videoWidth,
        originalHeight: video.videoHeight
      }));

      // Set initial rectangle with correct aspect ratio
      const margin = 0.1;
      const canvasWidth = 200; // Default canvas width from SliceControl
      const canvasHeight = 200; // Default canvas height from SliceControl
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

      // Set the initial rectangle
      setSliceRectangle({
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight
      });

      const totalFrameCount = Math.floor(video.duration * 30); // Assuming 30 fps
      const maxFrames = 500;
      const frameStep = Math.max(1, Math.floor(totalFrameCount / maxFrames));
      const frameCount = Math.min(maxFrames, totalFrameCount);
      
      setTotalFrames(frameCount);

      const extractFrame = (currentFrame) => {
        return new Promise((resolveFrame) => {
          video.currentTime = (currentFrame * frameStep) / 30;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            
            // Determine the larger and smaller dimensions of the video
            const largerDimension = Math.max(video.videoWidth, video.videoHeight);
            const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
            
            // Determine the larger and smaller dimensions of the max allowed size
            const maxLargerDimension = Math.max(maxDimensions.width, maxDimensions.height);
            const maxSmallerDimension = Math.min(maxDimensions.width, maxDimensions.height);
            
            // Calculate scaled dimensions while maintaining aspect ratio
            let scaledWidth = video.videoWidth;
            let scaledHeight = video.videoHeight;
            
            if (largerDimension > maxLargerDimension || smallerDimension > maxSmallerDimension) {
              if (largerDimension / maxLargerDimension > smallerDimension / maxSmallerDimension) {
                // Larger dimension is the limiting factor
                const scaleFactor = maxLargerDimension / largerDimension;
                scaledWidth = Math.round(video.videoWidth * scaleFactor);
                scaledHeight = Math.round(video.videoHeight * scaleFactor);
              } else {
                // Smaller dimension is the limiting factor
                const scaleFactor = maxSmallerDimension / smallerDimension;
                scaledWidth = Math.round(video.videoWidth * scaleFactor);
                scaledHeight = Math.round(video.videoHeight * scaleFactor);
              }
            }

            // Update video info with scaled dimensions and scale factor
            if (currentFrame === 0) { // Only update on first frame
              const scaleFactor = (scaledWidth / video.videoWidth).toFixed(2);
              setVideoInfo(prev => ({
                ...prev,
                scaledWidth,
                scaledHeight,
                scaleFactor
              }));
            }
            
            // Set canvas dimensions to the scaled size
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;
            
            const ctx = canvas.getContext('2d');
            // Enable image smoothing for better quality when scaling down
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw the video frame with scaling
            ctx.drawImage(video, 0, 0, scaledWidth, scaledHeight);
            resolveFrame(canvas);
          };
        });
      };

      const extractAllFrames = async () => {
        const frameCanvases = [];
        for (let i = 0; i < frameCount; i++) {
          if (isCancelled) {
            reject(new Error('Frame extraction cancelled'));
            return;
          }
          const frameCanvas = await extractFrame(i);
          frameCanvases.push(frameCanvas);
          setExtractionProgress((i + 1) / frameCount);
        }

        if (isCancelled) {
          reject(new Error('Frame extraction cancelled'));
          return;
        }

        try {
          const atlas = new TextureAtlas(sceneManagerRef.current.getScene());
          await atlas.createAtlas(frameCanvases);
          setTextureAtlas(atlas);
          resolve(frameCanvases.length);
        } catch (error) {
          reject(error);
        }
      };

      extractAllFrames().catch(reject).finally(() => {
        currentExtractionRef.current = null;
      });
    });
  }, [maxDimensions]);

  // Add console.log in the video loading effect
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

    // Reset states for new video
    setTextureAtlas(null);
    setIsLocalLoading(true);
    // Only show extraction screen for new videos, not resolution changes
    setShowExtractionScreen(!isResolutionChange.current);
    setError(null);
    setExtractionProgress(0);
    setTotalFrames(0);
    setRenderedFrames(0);

    console.log('Video loading effect - Setting states:', {
      isLocalLoading: true,
      showExtractionScreen: !isResolutionChange.current,
      isResolutionChange: isResolutionChange.current
    });

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
      setError(`Error loading video: ${e.message}`);
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
  }, [videoUrl, setError, extractFrames]); // Remove isHDMode from dependencies

  const resetToDefaults = useCallback(() => {
    setStackLength(defaultValues.stackLength);
    setFramePercentage(defaultValues.framePercentage);
    setOpacity(defaultValues.opacity);
    setBrightness(defaultValues.brightness);
    setBlendMode(defaultValues.blendMode);
    setSliceRange(defaultValues.sliceRange);
    setIsFrameOrderInverted(defaultValues.isFrameOrderInverted);
    setBackgroundColor(defaultValues.backgroundColor);
    setGlobalLightIntensity(1);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateCameraSettings({
        inertia: 0.5,
        angularSensibilityX: 300,
        angularSensibilityY: 300,
        panningSensibility: 200,
        wheelPrecision: 2
      });
    }
  }, [defaultValues]);

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
      const isMobileDevice = window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
      setTargetFps(isMobileDevice ? 30 : 60);

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

  const presets = [
    { name: 'Default', settings: { brightness: 0.5, contrast: 0.5, opacity: 0.5, blendMode: BABYLON.Constants.ALPHA_COMBINE } },
    { name: 'High Contrast', settings: { brightness: 0.6, contrast: 0.8, opacity: 0.7, blendMode: BABYLON.Constants.ALPHA_COMBINE } },
    { name: 'Soft Tissue', settings: { brightness: 0.4, contrast: 0.3, opacity: 0.6, blendMode: BABYLON.Constants.ALPHA_ADD } },
    { name: 'Bone', settings: { brightness: 0.7, contrast: 0.9, opacity: 0.8, blendMode: BABYLON.Constants.ALPHA_MAXIMIZED } },
  ];

  const applyPreset = useCallback((settings) => {
    setBrightness(settings.brightness || brightness);
    setOpacity(settings.opacity || opacity);
    setBlendMode(settings.blendMode || blendMode);
    setShowPresets(false);
    throttledUpdateFrameStack();
  }, [brightness, opacity, blendMode, throttledUpdateFrameStack]);

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

  // Add this state near other state declarations
  const [sliceRectangle, setSliceRectangle] = useState(null);

  // Add this handler
  const handleSliceRectangleChange = useCallback((newRectangle) => {
    setSliceRectangle(newRectangle);
  }, []);

  // Add these new states
  const [storedVideoFile, setStoredVideoFile] = useState(null);
  
  // Add a ref to track if this is a resolution change
  const isResolutionChange = useRef(false);

  // Update the handleResolutionToggle callback
  const handleResolutionToggle = useCallback(async () => {
    if (!storedVideoFile) return;
    
    // Set the flag BEFORE any state changes
    isResolutionChange.current = true;
    
    // Wrap all state changes in a single requestAnimationFrame to ensure they batch together
    requestAnimationFrame(() => {
      setIsHDMode(prev => !prev);
      setTextureAtlas(null);
      setIsLocalLoading(true);
      setError(null);
      setExtractionProgress(0);
      setTotalFrames(0);
      setRenderedFrames(0);
    });

    // Cancel any ongoing extraction process
    if (currentExtractionRef.current) {
      currentExtractionRef.current.cancel();
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.src = URL.createObjectURL(storedVideoFile);

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
    } finally {
      URL.revokeObjectURL(video.src);
      isResolutionChange.current = false; // Reset the flag
    }
  }, [storedVideoFile, extractFrames, setError]);

  // Modify the video loading effect
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

    // Reset states for new video
    setTextureAtlas(null);
    setIsLocalLoading(true);
    // Only show extraction screen for new videos, not resolution changes
    setShowExtractionScreen(!isResolutionChange.current);
    setError(null);
    setExtractionProgress(0);
    setTotalFrames(0);
    setRenderedFrames(0);

    console.log('Video loading effect - Setting states:', {
      isLocalLoading: true,
      showExtractionScreen: !isResolutionChange.current,
      isResolutionChange: isResolutionChange.current
    });

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
      setError(`Error loading video: ${e.message}`);
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
  }, [videoUrl, setError, extractFrames]); // Remove isHDMode from dependencies

  // Add cleanup for stored video on unmount
  useEffect(() => {
    return () => {
      if (storedVideoFile) {
        URL.revokeObjectURL(URL.createObjectURL(storedVideoFile));
      }
    };
  }, [storedVideoFile]);

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

  // Add this new state near other state declarations
  const [showExtractionScreen, setShowExtractionScreen] = useState(true);

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
          {/* File name at the top */}
          <div style={{
            color: 'white',
            textAlign: 'center',
            padding: '5px 0',
            fontSize: '16px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            {fileName}
          </div>

          {/* Controls container */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {/* Left section */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? '10px' : '0' }}>
              {isMobile ? (
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
                      left: '0',
                      marginTop: '5px',
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      borderRadius: '5px',
                      padding: '5px',
                      maxHeight: '0',
                      opacity: '0',
                      overflow: 'hidden',
                      transition: 'max-height 0.2s ease-in-out, opacity 0.2s ease-in-out',
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
              ) : (
                <ColorPalette
                  colors={backgroundColors}
                  selectedColor={backgroundColor}
                  onColorSelect={setBackgroundColor}
                />
              )}
              <FaFolderOpen 
                style={{ marginLeft: '15px', cursor: 'pointer', color: 'white' }} 
                onClick={handleFileSelect}
                title="Choose New File"
              />
            </div>
            
            {/* Middle section */}
            <div style={{ 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: isMobile ? '10px' : '0',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FaImages style={{ marginRight: '8px' }} />
                <span>Frames: {renderedFrames}</span>
              </div>

              {/* Add resolution info */}
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

              {/* FPS Badge */}
              <div style={{
                backgroundColor: '#3498db',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '15px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '80px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}>
                {targetFps} FPS
              </div>

              {/* HD/SD Toggle Button */}
              {isHDAvailable && (
                <div 
                  style={{ 
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    position: 'relative',
                    cursor: isLocalLoading ? 'default' : 'pointer',
                    marginLeft: '10px',
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
                    border: `2px solid ${isHDMode ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}`,
                    backgroundColor: isHDMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  }} />

                  {/* Progress circle */}
                  {isLocalLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: '2px solid #3498db',
                      clipPath: `polygon(50% 50%, -50% -50%, ${Math.cos(extractionProgress * Math.PI * 2 - Math.PI/2) * 100 + 50}% ${Math.sin(extractionProgress * Math.PI * 2 - Math.PI/2) * 100 + 50}%)`,
                      transform: 'rotate(-90deg)',
                      transition: 'clip-path 0.1s ease',
                    }} />
                  )}

                  {/* HD text */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: isHDMode ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    opacity: isLocalLoading ? 0.5 : 1,
                    transition: 'opacity 0.3s ease',
                  }}>
                    HD
                  </div>
                </div>
              )}
            </div>
            
            {/* Right section */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-end' }}>
              <FaUndoAlt 
                style={{ margin: '5px', cursor: 'pointer', color: 'white' }} 
                onClick={resetCamera}
                title="Reset Camera"
              />
              <FaExchangeAlt 
                style={{ margin: '5px', cursor: 'pointer', color: isFrameOrderInverted ? '#3498db' : 'white' }} 
                onClick={toggleFrameOrderInversion}
                title="Invert Frame Order"
              />
              <FaRedo
                style={{ margin: '5px', cursor: 'pointer', color: 'white' }}
                onClick={resetToDefaults}
                title="Reset to Defaults"
              />
              <div style={{ position: 'relative', margin: '5px' }}>
                <FaList
                  style={{ cursor: 'pointer', color: 'white' }}
                  onClick={() => setShowPresets(!showPresets)}
                  title="Presets"
                />
                {showPresets && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    borderRadius: '5px',
                    padding: '10px',
                    marginTop: '5px',
                  }}>
                    {presets.map((preset, index) => (
                      <div
                        key={index}
                        style={{
                          color: 'white',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          borderRadius: '3px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        onClick={() => applyPreset(preset.settings)}
                      >
                        {preset.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading screen remains the same */}
        {isLocalLoading && showExtractionScreen && (
          console.log('Render - States:', { isLocalLoading, showExtractionScreen }),
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '24px',
            zIndex: 1000
          }}>
            <div style={{ marginBottom: '20px' }}>Extracting Frames</div>
            <div style={{ 
              width: '80%', 
              height: '40px', 
              backgroundColor: '#444',
              borderRadius: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${extractionProgress * 100}%`,
                height: '100%',
                backgroundColor: '#3498db',
              }} />
            </div>
            <div style={{ marginTop: '10px' }}>
              {Math.round(extractionProgress * 100)}% ({Math.round(extractionProgress * totalFrames)} / {totalFrames} frames)
            </div>
            
            {/* Add resolution info */}
            {videoInfo.originalWidth > 0 && (
              <div style={{
                marginTop: '20px',
                fontSize: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: '15px',
                borderRadius: '10px',
                gap: '5px'
              }}>
                <div>Original: {videoInfo.originalWidth}×{videoInfo.originalHeight}</div>
                <div>Scaled: {videoInfo.scaledWidth}×{videoInfo.scaledHeight}</div>
                <div>Scale factor: {videoInfo.scaleFactor}x</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile toggle and ControlPanel remain the same */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: isControlPanelOpen ? '340px' : 0,
            left: 0,
            right: 0,
            backgroundColor: '#282c34',
            padding: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 -2px 5px rgba(0,0,0,0.2)',
            zIndex: 1001,
            transition: 'bottom 0.2s ease-in-out',
            color: '#ffffff',
            borderTop: '1px solid #404040'
          }}
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
        >
          <FaCog style={{ marginRight: '10px', color: '#3498db' }} />
          {isControlPanelOpen ? 'Hide Controls' : 'Show Controls'}
        </div>
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
