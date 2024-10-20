import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as BABYLON from '@babylonjs/core';
import SceneManager from './scene/SceneManager';
import ControlPanel from './components/ControlPanel';
import { FaImages, FaCog } from 'react-icons/fa';

const UltrasoundVisualizer = ({ videoUrl, setError }) => {
  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const [frames, setFrames] = useState([]);
  const [isLocalLoading, setIsLocalLoading] = useState(true);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [renderedFrames, setRenderedFrames] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(true);
  const [sliceRange, setSliceRange] = useState([0, 100]);

  // Wrap defaultValues in useMemo
  const defaultValues = useMemo(() => ({
    stackLength: 1.5,
    framePercentage: 50,
    opacity: 0.3, // Changed from 1 to 0.3
    contrast: 1,
    brightness: 1,
    blendMode: BABYLON.Constants.ALPHA_COMBINE,
    sliceRange: [0, 100],
    isFrameOrderInverted: false,
    backgroundColor: '#000000',
  }), []); // Empty dependency array means this object will be created only once

  const [stackLength, setStackLength] = useState(defaultValues.stackLength);
  const [framePercentage, setFramePercentage] = useState(defaultValues.framePercentage);
  const [opacity, setOpacity] = useState(defaultValues.opacity);
  const [contrast, setContrast] = useState(defaultValues.contrast);
  const [brightness, setBrightness] = useState(defaultValues.brightness);
  const [blendMode, setBlendMode] = useState(defaultValues.blendMode);
  const [isFrameOrderInverted, setIsFrameOrderInverted] = useState(defaultValues.isFrameOrderInverted);
  const [backgroundColor, setBackgroundColor] = useState(defaultValues.backgroundColor);

  useEffect(() => {
    if (canvasRef.current) {
      sceneManagerRef.current = new SceneManager(canvasRef.current);
      sceneManagerRef.current.initialize();

      return () => {
        if (sceneManagerRef.current) {
          sceneManagerRef.current.dispose();
        }
      };
    }
  }, []);

  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setBackgroundColor(backgroundColor);
    }
  }, [backgroundColor]);

  const extractFrames = useCallback((video) => {
    return new Promise((resolve, reject) => {
      const totalFrameCount = Math.floor(video.duration * 30); // Assuming 30 fps
      const maxFrames = 500;
      const frameStep = Math.max(1, Math.floor(totalFrameCount / maxFrames));
      const frameCount = Math.min(maxFrames, totalFrameCount);
      
      setTotalFrames(frameCount);
      const extractedFrames = [];

      const extractFrame = (currentFrame) => {
        return new Promise((resolveFrame) => {
          video.currentTime = (currentFrame * frameStep) / 30;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Create a dynamic texture from the canvas
            const frameTexture = new BABYLON.DynamicTexture("frameTexture", {width: canvas.width, height: canvas.height}, sceneManagerRef.current.getScene());
            const context2D = frameTexture.getContext();
            context2D.drawImage(canvas, 0, 0, canvas.width, canvas.height);
            frameTexture.update();
            
            resolveFrame(frameTexture);
          };
        });
      };

      const extractAllFrames = async () => {
        for (let i = 0; i < frameCount; i++) {
          const frameTexture = await extractFrame(i);
          extractedFrames.push(frameTexture);
          setExtractionProgress((i + 1) / frameCount);
        }
        resolve(extractedFrames);
      };

      extractAllFrames().catch(reject);
    });
  }, []);

  useEffect(() => {
    if (!videoUrl) {
      setError('No video URL provided');
      setIsLocalLoading(false);
      return;
    }

    setIsLocalLoading(true);
    setError(null);

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;

    const handleVideoLoad = async () => {
      try {
        await video.play();
        video.pause();
        const extractedFrames = await extractFrames(video);
        setFrames(extractedFrames);
        setIsLocalLoading(false);
      } catch (error) {
        setError(`Error extracting frames: ${error.message}`);
        setIsLocalLoading(false);
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
  }, [videoUrl, setError, extractFrames]);

  const resetToDefaults = useCallback(() => {
    setStackLength(defaultValues.stackLength);
    setFramePercentage(defaultValues.framePercentage);
    setOpacity(defaultValues.opacity);
    setContrast(defaultValues.contrast);
    setBrightness(defaultValues.brightness);
    setBlendMode(defaultValues.blendMode);
    setSliceRange(defaultValues.sliceRange);
    setIsFrameOrderInverted(defaultValues.isFrameOrderInverted);
    setBackgroundColor(defaultValues.backgroundColor);
  }, [defaultValues]);

  const updateFrameStack = useCallback(() => {
    if (sceneManagerRef.current && frames.length > 0) {
      sceneManagerRef.current.clearFrameMeshes();
      const framesToShow = Math.max(2, Math.floor(frames.length * (framePercentage / 100)));
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
          ? frames.length - 1 - Math.min(Math.floor(i * (frames.length - 1) / (framesToShow - 1)), frames.length - 1)
          : Math.min(Math.floor(i * (frames.length - 1) / (framesToShow - 1)), frames.length - 1);
        const position = new BABYLON.Vector3(0, 0, i * actualFrameDistance - offset);
        sceneManagerRef.current.createFrameMesh(frames[frameIndex], position, scale, {
          opacity,
          contrast,
          brightness,
          blendMode,
        });
      }
    }
  }, [
    frames, stackLength, framePercentage, opacity, contrast, brightness, 
    blendMode, isFrameOrderInverted, sliceRange
  ]);

  useEffect(() => {
    updateFrameStack();
  }, [frames, stackLength, framePercentage, updateFrameStack]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768); // Consider devices with width <= 768px as mobile
    };

    handleResize(); // Call once to set initial state
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSliceRangeChange = useCallback((newRange) => {
    setSliceRange(newRange);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ flex: 1, position: 'relative', height: isMobile ? 'calc(100% - 50px)' : '100%' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        {isLocalLoading && (
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
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '14px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          <FaImages style={{ marginRight: '8px' }} />
          Frames: {renderedFrames}
        </div>
      </div>
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: isControlPanelOpen ? '300px' : 0, // Adjust this value based on your control panel height
            left: 0,
            right: 0,
            backgroundColor: '#f0f0f0',
            padding: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 -2px 5px rgba(0,0,0,0.1)',
            zIndex: 1001, // Ensure it's above the control panel
          }}
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
        >
          <FaCog style={{ marginRight: '10px' }} />
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
        contrast={contrast}
        setContrast={setContrast}
        brightness={brightness}
        setBrightness={setBrightness}
        blendMode={blendMode}
        setBlendMode={setBlendMode}
        sliceRange={sliceRange}
        setSliceRange={handleSliceRangeChange}
        isFrameOrderInverted={isFrameOrderInverted}
        setIsFrameOrderInverted={setIsFrameOrderInverted}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        isMobile={isMobile}
        isOpen={!isMobile || isControlPanelOpen}
        resetToDefaults={resetToDefaults}
      />
    </div>
  );
};

export default UltrasoundVisualizer;
