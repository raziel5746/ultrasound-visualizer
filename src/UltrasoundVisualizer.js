import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FaAdjust, FaSun, FaLayerGroup, FaImages, FaEye, FaPalette, FaExchangeAlt, FaCog, FaChevronUp, FaChevronDown } from 'react-icons/fa';

const UltrasoundVisualizer = ({ videoUrl, setError }) => {
  const mountRef = useRef(null);
  const videoRef = useRef(null);
  const [frames, setFrames] = useState([]);
  const [stackLength, setStackLength] = useState(1.5); // Default to middle of the new range
  const [framePercentage, setFramePercentage] = useState(50);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [opacity, setOpacity] = useState(0.3);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(50); // Default to middle value
  const [blendMode, setBlendMode] = useState('Normal');
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);
  const [isInverted, setIsInverted] = useState(false);

  const controlPanelWidth = 250;

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameRef = useRef(null);

  const cameraPositionRef = useRef(new THREE.Vector3());
  const cameraRotationRef = useRef(new THREE.Euler());
  const controlsTargetRef = useRef(new THREE.Vector3());

  const [isLocalLoading, setIsLocalLoading] = useState(true);

  const shaderMaterialRef = useRef(null);

  const [extractionProgress, setExtractionProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  const stackCenterRef = useRef(new THREE.Vector3(0, 0, 0));

  // Add this new state variable near the top of your component
  const [renderedFrames, setRenderedFrames] = useState(0);

  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(100);
  const [sliceWidth, setSliceWidth] = useState(100);

  const [isFrameOrderInverted, setIsFrameOrderInverted] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(true);

  const handleSliceStartChange = (value) => {
    const newStart = Math.max(0, Math.min(value, sliceEnd - 1));
    const newWidth = sliceEnd - newStart;
    setSliceStart(newStart);
    setSliceWidth(newWidth);
    updateFrameStack();
  };

  const handleSliceEndChange = (value) => {
    const newEnd = Math.min(100, Math.max(value, sliceStart + 1));
    const newWidth = newEnd - sliceStart;
    setSliceEnd(newEnd);
    setSliceWidth(newWidth);
    updateFrameStack();
  };

  const handleSlicePositionChange = (value) => {
    const newStart = Math.max(0, Math.min(value, 100 - sliceWidth));
    setSliceStart(newStart);
    setSliceEnd(newStart + sliceWidth);
    updateFrameStack();
  };

  // Update uniforms immediately when settings change
  useEffect(() => {
    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uContrast.value = contrast;
      shaderMaterialRef.current.uniforms.uBrightness.value = brightness / 50 - 1; // Map 0-100 to -1 to 1
      shaderMaterialRef.current.uniforms.uOpacity.value = opacity;
      shaderMaterialRef.current.uniforms.uIsBlackAndWhite.value = isBlackAndWhite;
      shaderMaterialRef.current.uniforms.uIsInverted.value = isInverted;
    }
  }, [contrast, brightness, opacity, isBlackAndWhite, isInverted]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    const updateCanvasSize = () => {
      const headerHeight = document.querySelector('.App-header').offsetHeight;
      let newHeight, newWidth;

      if (isMobile) {
        newHeight = isControlPanelOpen ? window.innerHeight - headerHeight - 300 : window.innerHeight - headerHeight - 50;
        newWidth = window.innerWidth;
      } else {
        newHeight = window.innerHeight - headerHeight;
        newWidth = window.innerWidth - controlPanelWidth;
      }

      setCanvasHeight(newHeight);
      setCanvasWidth(newWidth);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isMobile, isControlPanelOpen]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    // Keep the reduced FOV for a zoomed-in view
    cameraRef.current = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 1000);
    
    // Use WebGL2 if available, fall back to WebGL1
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: true }) || 
                    canvas.getContext('webgl', { antialias: true });
    
    rendererRef.current = new THREE.WebGLRenderer({
      canvas: canvas,
      context: context,
      antialias: true,
      alpha: true
    });
    rendererRef.current.setSize(canvasWidth, canvasHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(rendererRef.current.domElement);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    sceneRef.current.add(pointLight);

    // Adjust initial camera position with a distance of 5
    const distance = 5;
    const angle = -Math.PI / 4;
    cameraRef.current.position.set(
      Math.cos(angle) * distance,
      1.25, // Slightly increased the height
      Math.sin(angle) * distance
    );
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      rendererRef.current.dispose();
      mount.removeChild(rendererRef.current.domElement);
    };
  }, [canvasWidth, canvasHeight]);

  const updateFrameStack = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current || frames.length === 0) {
      return;
    }

    cameraPositionRef.current.copy(cameraRef.current.position);
    cameraRotationRef.current.copy(cameraRef.current.rotation);
    controlsTargetRef.current.copy(controlsRef.current.target);

    sceneRef.current.children = sceneRef.current.children.filter(child => !(child instanceof THREE.Mesh));

    const framesToShow = Math.max(2, Math.floor(frames.length * (framePercentage / 100)));
    setRenderedFrames(framesToShow);
    const actualFrameDistance = stackLength / (framesToShow - 1);
    const step = (frames.length - 1) / (framesToShow - 1);

    // Calculate start and end indices based on slice values and position
    const startIndex = Math.floor(sliceStart / 100 * framesToShow);
    const endIndex = Math.ceil(sliceEnd / 100 * framesToShow);

    // Calculate the total stack length
    const totalStackLength = actualFrameDistance * (framesToShow - 1);

    // Calculate the offset to keep the end of the stack fixed
    const offsetZ = (framesToShow - endIndex) * actualFrameDistance;

    // Adjust the stack center based on the new slice, keeping the end fixed
    const stackCenter = new THREE.Vector3(0, 0.5, totalStackLength / 2 - offsetZ);
    stackCenterRef.current = stackCenter;

    // Update OrbitControls target
    controlsRef.current.target.copy(stackCenter);

    // Update shader material
    if (!shaderMaterialRef.current) {
      shaderMaterialRef.current = new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: null },
          uContrast: { value: contrast },
          uBrightness: { value: brightness / 50 - 1 }, // Map 0-100 to -1 to 1
          uIsBlackAndWhite: { value: isBlackAndWhite },
          uIsInverted: { value: isInverted },
          uOpacity: { value: opacity },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uTexture;
          uniform float uContrast;
          uniform float uBrightness;
          uniform bool uIsBlackAndWhite;
          uniform bool uIsInverted;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec4 texColor = texture2D(uTexture, vUv);
            
            // Apply contrast
            vec3 color = (texColor.rgb - 0.5) * uContrast + 0.5;
            
            // Apply brightness
            color += uBrightness;
            
            // Apply black and white
            if (uIsBlackAndWhite) {
              float gray = dot(color, vec3(0.299, 0.587, 0.114));
              color = vec3(gray);
            }
            
            // Apply invert
            if (uIsInverted) {
              color = 1.0 - color;
            }
            
            gl_FragColor = vec4(color, uOpacity);
          }
        `,
        transparent: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide, // Add this line to render both sides
      });
    }

    for (let i = startIndex; i < endIndex; i++) {
      // Modify this line to handle inverted frame order
      const frameIndex = isFrameOrderInverted
        ? Math.max(0, frames.length - 1 - Math.floor(i * step))
        : Math.min(Math.floor(i * step), frames.length - 1);
      const frameTexture = frames[frameIndex];

      const planeGeometry = new THREE.PlaneGeometry(1.6, 1);
      const planeMaterial = shaderMaterialRef.current.clone();
      planeMaterial.uniforms.uTexture.value = frameTexture;
      planeMaterial.side = THREE.DoubleSide;

      // Set blending mode based on the selected option
      switch (blendMode) {
        case 'Additive':
          planeMaterial.blending = THREE.AdditiveBlending;
          break;
        case 'Screen':
          planeMaterial.blending = THREE.CustomBlending;
          planeMaterial.blendSrc = THREE.OneFactor;
          planeMaterial.blendDst = THREE.OneMinusSrcColorFactor;
          break;
        case 'Overlay':
          planeMaterial.blending = THREE.CustomBlending;
          planeMaterial.blendSrc = THREE.OneFactor;
          planeMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
          break;
        default: // Normal
          planeMaterial.blending = THREE.NormalBlending;
      }

      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      // Position the plane relative to the stack center, keeping the end fixed
      planeMesh.position.set(0, stackCenter.y, i * actualFrameDistance - offsetZ - stackCenter.z);
      sceneRef.current.add(planeMesh);
    }

    cameraRef.current.position.copy(cameraPositionRef.current);
    cameraRef.current.rotation.copy(cameraRotationRef.current);
    controlsRef.current.target.copy(controlsTargetRef.current);

    controlsRef.current.update();
  }, [frames, stackLength, framePercentage, blendMode, opacity, contrast, brightness, isBlackAndWhite, isInverted, sliceStart, sliceEnd, isFrameOrderInverted]);

  useEffect(() => {
    if (sceneRef.current && frames.length > 0) {
      updateFrameStack();
    }
  }, [frames, updateFrameStack]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    const animate = () => {
      requestAnimationFrame(animate);
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animate();

    const handleResize = () => {
      cameraRef.current.aspect = canvasWidth / canvasHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(canvasWidth, canvasHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasWidth, canvasHeight]);

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
            const frameTexture = new THREE.CanvasTexture(canvas);
            frameTexture.needsUpdate = true;
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
    videoRef.current = video;

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
      let errorMessage = 'Error loading video: ';
      if (e.target.error && e.target.error.code) {
        switch (e.target.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage += 'You aborted the video playback.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage += 'A network error caused the video download to fail.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage += 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage += 'The video format is not supported.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
        }
      } else {
        errorMessage += e.message || 'Unknown error occurred.';
      }
      errorMessage += ' Please ensure you are using a supported video format (e.g., MP4 with H.264 codec).';
      setError(errorMessage);
      setIsLocalLoading(false);
    };

    video.addEventListener('loadedmetadata', handleVideoLoad);
    video.addEventListener('error', handleVideoError);

    // Set a timeout for video loading
    const loadTimeout = setTimeout(() => {
      if (!video.readyState) {
        handleVideoError({ target: { error: { code: 'TIMEOUT' } } });
      }
    }, 10000); // 10 seconds timeout

    // Use createObjectURL for local files
    if (videoUrl instanceof Blob) {
      video.src = URL.createObjectURL(videoUrl);
    } else {
      video.src = videoUrl;
    }

    video.load();

    return () => {
      clearTimeout(loadTimeout);
      video.removeEventListener('loadedmetadata', handleVideoLoad);
      video.removeEventListener('error', handleVideoError);
      video.pause();
      video.src = '';
      if (videoUrl instanceof Blob) {
        URL.revokeObjectURL(video.src);
      }
    };
  }, [videoUrl, setError, extractFrames]);

  // Add this new useEffect
  useEffect(() => {
    if (sceneRef.current && frames.length > 0) {
      updateFrameStack();
    }
  }, [isBlackAndWhite, isInverted, contrast, opacity, blendMode, stackLength, framePercentage, frames.length, updateFrameStack]);

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, position: 'relative' }}>
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
                // Remove the transition property
              }} />
            </div>
            <div style={{ marginTop: '10px' }}>
              {Math.round(extractionProgress * 100)}% ({Math.round(extractionProgress * totalFrames)} / {totalFrames} frames)
            </div>
          </div>
        )}
        
        {/* Frame count overlay */}
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
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#f0f0f0',
            borderTop: '1px solid #ccc',
            padding: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
        >
          <FaCog style={{ marginRight: '10px' }} />
          Control Panel
          {isControlPanelOpen ? <FaChevronDown style={{ marginLeft: '10px' }} /> : <FaChevronUp style={{ marginLeft: '10px' }} />}
        </div>
      )}
      <div
        style={{
          width: isMobile ? '100%' : `${controlPanelWidth}px`,
          height: isMobile ? (isControlPanelOpen ? '250px' : '0') : '100%',
          overflowY: 'auto',
          padding: isMobile ? (isControlPanelOpen ? '20px' : '0') : '20px',
          boxSizing: 'border-box',
          backgroundColor: '#f0f0f0',
          borderLeft: isMobile ? 'none' : '1px solid #ccc',
          borderTop: isMobile ? '1px solid #ccc' : 'none',
          transition: 'height 0.3s ease-in-out, padding 0.3s ease-in-out',
        }}
      >
        {(!isMobile || isControlPanelOpen) && (
          <>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Control Panel</h3>
            
            <ControlItem
              icon={<FaLayerGroup />}
              label="Stack Length"
              value={stackLength}
              min={0.20}
              max={3}
              step={0.01}
              onChange={(value) => {
                setStackLength(value);
                updateFrameStack();
              }}
            />

            <ControlItem
              icon={<FaImages />}
              label="Frames to Show"
              value={framePercentage}
              min={1}
              max={100}
              step={0.1}
              onChange={(value) => {
                setFramePercentage(value);
                updateFrameStack();
              }}
              unit="%"
            />

            <ControlItem
              icon={<FaEye />}
              label="Opacity"
              value={opacity}
              min={0}
              max={1}
              step={0.001}
              onChange={setOpacity}
              customScale={{
                toSlider: (value) => value <= 0.1 ? value * 5 : 0.5 + (value - 0.1) * (0.5 / 0.9),
                fromSlider: (value) => value <= 0.5 ? value / 5 : 0.1 + (value - 0.5) * (0.9 / 0.5)
              }}
            />

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBlackAndWhite}
                  onChange={() => setIsBlackAndWhite(!isBlackAndWhite)}
                  style={{ marginRight: '10px' }}
                />
                <FaAdjust style={{ marginRight: '10px' }} />
                Black & White
              </label>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isInverted}
                  onChange={() => setIsInverted(!isInverted)}
                  style={{ marginRight: '10px' }}
                />
                <FaAdjust style={{ marginRight: '10px' }} />
                Invert Colors
              </label>
            </div>

            <ControlItem
              icon={<FaAdjust />}
              label="Contrast"
              value={contrast}
              min={0}
              max={1}
              step={0.001}
              onChange={setContrast}
              customScale={{
                toSlider: (value) => value <= 1 ? value * 0.5 : 0.5 + (value - 1) * 0.125,
                fromSlider: (value) => value <= 0.5 ? value * 2 : 1 + (value - 0.5) * 8
              }}
            />

            <ControlItem
              icon={<FaSun />}
              label="Brightness"
              value={brightness}
              min={0}
              max={100}
              step={0.1}
              onChange={(value) => {
                setBrightness(value);
                updateFrameStack();
              }}
            />

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
                <FaPalette style={{ marginRight: '10px' }} />
                Blending Mode:
              </label>
              <select 
                value={blendMode} 
                onChange={(e) => setBlendMode(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '5px',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white'
                }}
              >
                <option value="Normal">Normal</option>
                <option value="Additive">Additive</option>
                <option value="Screen">Screen</option>
                <option value="Overlay">Overlay</option>
              </select>
            </div>
            
            <ControlItem
              label="Slice Start"
              value={sliceStart}
              min={0}
              max={sliceEnd - 1}
              onChange={handleSliceStartChange}
              unit="%"
            />
            
            <ControlItem
              label="Slice End"
              value={sliceEnd}
              min={sliceStart + 1}
              max={100}
              onChange={handleSliceEndChange}
              unit="%"
            />

            <ControlItem
              label="Slice Position"
              value={sliceStart}
              min={0}
              max={100 - sliceWidth}
              onChange={handleSlicePositionChange}
              unit="%"
            />

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isFrameOrderInverted}
                  onChange={() => {
                    setIsFrameOrderInverted(!isFrameOrderInverted);
                    updateFrameStack();
                  }}
                  style={{ marginRight: '10px' }}
                />
                <FaExchangeAlt style={{ marginRight: '10px' }} />
                Invert Frame Order
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ControlItem = ({ icon, label, value, min, max, step = 1, onChange, unit = '', customScale }) => {
  const handleChange = (e) => {
    let newValue = parseFloat(e.target.value);
    if (customScale) {
      newValue = customScale.fromSlider(newValue);
    }
    onChange(newValue);
  };

  const sliderValue = customScale ? customScale.toSlider(value) : value;
  const displayValue = value;

  // Show marker only for Opacity and Contrast
  const showMarker = label === "Opacity" || label === "Contrast";

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        {icon && <span style={{ marginRight: '10px' }}>{icon}</span>}
        {label}:
      </label>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', marginRight: '10px' }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderValue}
            onChange={handleChange}
            style={{ width: '100%' }}
          />
          {showMarker && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '2px',
                height: '16px',
                backgroundColor: '#007bff',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
        <span style={{ minWidth: '50px', textAlign: 'right' }}>
          {typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue}{unit}
        </span>
      </div>
    </div>
  );
};

export default UltrasoundVisualizer;
