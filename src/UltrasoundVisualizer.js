import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FaAdjust, FaSun, FaLayerGroup, FaImages, FaEye, FaPalette, FaExchangeAlt, FaCog, FaChevronUp, FaChevronDown } from 'react-icons/fa';

const UltrasoundVisualizer = ({ videoUrl, setError }) => {
  const mountRef = useRef(null);
  const videoRef = useRef(null);
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

  // Update these state variables
  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(100);
  const [slicePosition, setSlicePosition] = useState(0);

  const [isFrameOrderInverted, setIsFrameOrderInverted] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(true);

  const [textureAtlas, setTextureAtlas] = useState(null);

  const planeGeometryRef = useRef(null);
  const instancedMeshRef = useRef(null);

  // Add a new state for atlas creation
  const [isCreatingAtlas, setIsCreatingAtlas] = useState(false);

  const dependenciesRef = useRef({
    frameData: [],
    stackLength: 1.5,
    framePercentage: 50,
    sliceStart: 0,
    sliceEnd: 100,
    isFrameOrderInverted: false,
    textureAtlas: null,
    textureMatrices: []
  });

  const [frameData, setFrameData] = useState([]);

  const [textureMatrices, setTextureMatrices] = useState([]);

  const updateFrameStack = useCallback(() => {
    console.log('updateFrameStack called');

    const {
      frameData,
      stackLength,
      framePercentage,
      sliceStart,
      sliceEnd,
      isFrameOrderInverted,
      textureAtlas,
      textureMatrices
    } = dependenciesRef.current;

    if (!sceneRef.current || !cameraRef.current || !controlsRef.current || !textureAtlas || frameData.length === 0 || !textureMatrices || textureMatrices.length === 0) {
      console.log('updateFrameStack early return', {
        scene: !!sceneRef.current,
        camera: !!cameraRef.current,
        controls: !!controlsRef.current,
        textureAtlas: !!textureAtlas,
        frameDataLength: frameData.length,
        textureMatricesLength: textureMatrices ? textureMatrices.length : 0
      });
      return;
    }

    // Store current camera position and controls target
    const currentCameraPosition = cameraRef.current.position.clone();
    const currentCameraRotation = cameraRef.current.rotation.clone();
    const currentControlsTarget = controlsRef.current.target.clone();

    const totalFrames = frameData.length;
    const framesToShow = Math.max(2, Math.min(totalFrames, Math.floor(totalFrames * (framePercentage / 100))));
    
    const startFrame = Math.floor(sliceStart * totalFrames / 100);
    const endFrame = Math.ceil(sliceEnd * totalFrames / 100);
    
    const visibleFrames = endFrame - startFrame;
    
    setRenderedFrames(visibleFrames);

    const actualFrameDistance = stackLength / (visibleFrames - 1);

    const stackCenter = new THREE.Vector3(0, 0, 0);
    stackCenterRef.current = stackCenter;

    if (!instancedMeshRef.current) {
      console.log('Creating new instanced mesh');
      planeGeometryRef.current = new THREE.PlaneGeometry(1.6, 1);
      const instancedMaterial = shaderMaterialRef.current.clone();
      instancedMeshRef.current = new THREE.InstancedMesh(planeGeometryRef.current, instancedMaterial, visibleFrames);
      sceneRef.current.add(instancedMeshRef.current);
    }

    instancedMeshRef.current.count = visibleFrames;

    const tempObject = new THREE.Object3D();
    const frameIndexAttribute = new THREE.InstancedBufferAttribute(new Float32Array(visibleFrames), 1);

    for (let i = 0; i < visibleFrames; i++) {
      const frameIndex = isFrameOrderInverted 
        ? startFrame + i
        : totalFrames - 1 - (startFrame + i);

      const zPosition = i * actualFrameDistance - stackLength / 2;
      tempObject.position.set(0, 0, zPosition);
      tempObject.updateMatrix();
      instancedMeshRef.current.setMatrixAt(i, tempObject.matrix);

      frameIndexAttribute.setX(i, frameIndex);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    instancedMeshRef.current.geometry.setAttribute('frameIndex', frameIndexAttribute);

    // Update the texture matrices in the shader
    if (shaderMaterialRef.current && shaderMaterialRef.current.uniforms) {
      const flattenedMatrices = textureMatrices.flatMap(matrix => matrix.toArray());
      shaderMaterialRef.current.uniforms.uTextureMatrix.value = flattenedMatrices;
      shaderMaterialRef.current.uniforms.uNumFrames.value = frameData.length;
    }

    // Restore camera position and controls target
    cameraRef.current.position.copy(currentCameraPosition);
    cameraRef.current.rotation.copy(currentCameraRotation);
    controlsRef.current.target.copy(currentControlsTarget);

    controlsRef.current.update();

    if (instancedMeshRef.current) {
      const box = new THREE.Box3().setFromObject(instancedMeshRef.current);
      console.log('Stack bounding box:', box);
      console.log('Stack center:', box.getCenter(new THREE.Vector3()));
    }

    console.log('updateFrameStack completed', {
      framesToShow,
      startFrame,
      endFrame,
      stackCenter: stackCenterRef.current,
      cameraPosition: cameraRef.current.position,
      cameraRotation: cameraRef.current.rotation,
      controlsTarget: controlsRef.current.target
    });
  }, [/* dependencies */]);

  // Update dependency ref when values change
  useEffect(() => {
    dependenciesRef.current = {
      frameData,
      stackLength,
      framePercentage,
      sliceStart,
      sliceEnd,
      isFrameOrderInverted,
      textureAtlas,
      textureMatrices
    };
  }, [frameData, stackLength, framePercentage, sliceStart, sliceEnd, isFrameOrderInverted, textureAtlas, textureMatrices]);

  const handleSliceStartChange = (value) => {
    const newStart = Math.max(0, Math.min(value, sliceEnd - 1));
    setSliceStart(newStart);
    updateFrameStack();
  };

  const handleSliceEndChange = (value) => {
    const newEnd = Math.min(100, Math.max(value, sliceStart + 1));
    setSliceEnd(newEnd);
    updateFrameStack();
  };

  const handleSlicePositionChange = (value) => {
    const newPosition = Math.max(0, Math.min(value, 100 - (sliceEnd - sliceStart)));
    setSlicePosition(newPosition);
    setSliceStart(newPosition);
    setSliceEnd(newPosition + (sliceEnd - sliceStart));
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
    cameraRef.current = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 0.1, 1000);
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { antialias: true }) || 
                    canvas.getContext('webgl', { antialias: true });
    
    rendererRef.current = new THREE.WebGLRenderer({
      canvas: canvas,
      context: context,
      antialias: true,
      alpha: true,
      sortObjects: true // Enable object sorting
    });
    rendererRef.current.setSize(canvasWidth, canvasHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    
    mount.appendChild(rendererRef.current.domElement);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);

    // Simplify lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    sceneRef.current.add(ambientLight);
    
    // Adjust initial camera position
    const distance = 3; // Reduced from 5
    const angle = -Math.PI / 6; // Changed from -Math.PI / 4
    cameraRef.current.position.set(
      Math.cos(angle) * distance,
      1,
      Math.sin(angle) * distance
    );
    cameraRef.current.lookAt(0, 0.5, 0); // Changed from (0, 0, 0)
    controlsRef.current.target.set(0, 0.5, 0); // Changed from (0, 0, 0)
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

  const createTextureAtlas = useCallback((frames) => {
    if (frames.length === 0) {
      console.error('No frames to create texture atlas');
      return;
    }

    setIsCreatingAtlas(true);

    const frameWidth = frames[0].canvas.width;
    const frameHeight = frames[0].canvas.height;

    // Calculate the optimal atlas size
    const totalPixels = frames.length * frameWidth * frameHeight;
    const atlasSize = Math.ceil(Math.sqrt(totalPixels));
    const framesPerRow = Math.floor(atlasSize / frameWidth);
    const framesPerColumn = Math.ceil(frames.length / framesPerRow);

    const atlasWidth = framesPerRow * frameWidth;
    const atlasHeight = framesPerColumn * frameHeight;

    const canvas = document.createElement('canvas');
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext('2d');

    frames.forEach((frame, index) => {
      const row = Math.floor(index / framesPerRow);
      const col = index % framesPerRow;
      const x = col * frameWidth;
      const y = (framesPerColumn - 1 - row) * frameHeight; // Invert the row order

      ctx.drawImage(frame.canvas, x, y);

      frame.textureCoords = {
        u: x / atlasWidth,
        v: y / atlasHeight,
        width: frameWidth / atlasWidth,
        height: frameHeight / atlasHeight,
      };
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const textureMatrices = frames.map(frame => {
      const matrix = new THREE.Matrix3();
      matrix.setUvTransform(
        frame.textureCoords.u,
        frame.textureCoords.v,
        frame.textureCoords.width,
        frame.textureCoords.height,
        0,
        0,
        0
      );
      return matrix;
    });

    setTextureAtlas(texture);
    setFrameData(frames);
    setTextureMatrices(textureMatrices);
    setIsCreatingAtlas(false);
    console.log('Texture atlas created', { atlasWidth, atlasHeight, framesCount: frames.length });
  }, []);

  const extractFrames = useCallback((video) => {
    return new Promise((resolve, reject) => {
      const totalFrameCount = Math.floor(video.duration * 30); // Assuming 30 fps
      const maxFrames = 500;
      const frameStep = Math.max(1, Math.floor(totalFrameCount / maxFrames));
      
      const newFrameData = [];

      const extractFrame = (currentFrame) => {
        return new Promise((resolveFrame) => {
          video.currentTime = (currentFrame * frameStep) / 30;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Check if the frame is not empty (you may need to adjust this check)
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const isNotEmpty = imageData.data.some(channel => channel !== 0);

            if (isNotEmpty) {
              resolveFrame({
                index: currentFrame,
                canvas: canvas,
                timestamp: video.currentTime
              });
            } else {
              resolveFrame(null);
            }
          };
        });
      };

      const extractAllFrames = async () => {
        for (let i = 0; i < totalFrameCount; i += frameStep) {
          const frameInfo = await extractFrame(i);
          if (frameInfo) {
            newFrameData.push(frameInfo);
            setExtractionProgress((newFrameData.length) / maxFrames);
          }
          if (newFrameData.length >= maxFrames) break;
        }
        setTotalFrames(newFrameData.length);
        setFrameData(newFrameData);
        createTextureAtlas(newFrameData);
        updateFrameStack();
        resolve(newFrameData);
      };

      extractAllFrames().catch(reject);
    });
  }, [createTextureAtlas, updateFrameStack]);

  // Update shader material
  useEffect(() => {
    if (!textureAtlas || frameData.length === 0 || textureMatrices.length === 0) return;

    const getBlendingMode = (mode) => {
      switch (mode) {
        case 'Normal':
          return THREE.NormalBlending;
        case 'Additive':
          return THREE.AdditiveBlending;
        case 'Custom':
          return THREE.CustomBlending;
        default:
          return THREE.NormalBlending;
      }
    };

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: textureAtlas },
        uTextureMatrix: { value: textureMatrices.flatMap(matrix => matrix.toArray()) },
        uContrast: { value: contrast },
        uBrightness: { value: brightness / 50 - 1 },
        uIsBlackAndWhite: { value: isBlackAndWhite },
        uIsInverted: { value: isInverted },
        uOpacity: { value: opacity },
        uNumFrames: { value: frameData.length },
      },
      vertexShader: `
        #define MAX_FRAMES 500 // Adjust this value based on your maximum expected frames
        uniform mat3 uTextureMatrix[MAX_FRAMES];
        uniform int uNumFrames;
        attribute float frameIndex;
        varying vec2 vUv;
        void main() {
          int index = int(frameIndex);
          if (index < uNumFrames) {
            vUv = (uTextureMatrix[index] * vec3(uv, 1.0)).xy;
          } else {
            vUv = uv;
          }
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
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
          
          vec3 color = (texColor.rgb - 0.5) * uContrast + 0.5;
          color += uBrightness;
          
          if (uIsBlackAndWhite) {
            float gray = dot(color, vec3(0.299, 0.587, 0.114));
            color = vec3(gray);
          }
          
          if (uIsInverted) {
            color = 1.0 - color;
          }
          
          float alpha = max(texColor.a * uOpacity, 0.01);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: getBlendingMode(blendMode),
      side: THREE.DoubleSide,
    });

    shaderMaterialRef.current = material;

    if (instancedMeshRef.current) {
      instancedMeshRef.current.material = material;
      console.log('Updated instanced mesh material');
    }

  }, [textureAtlas, contrast, brightness, isBlackAndWhite, isInverted, opacity, blendMode, frameData.length, textureMatrices]);

  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current || !stackCenterRef.current) return;

    const center = stackCenterRef.current;

    if (cameraPositionRef.current.lengthSq() > 0) {
      cameraRef.current.position.copy(cameraPositionRef.current);
      cameraRef.current.rotation.copy(cameraRotationRef.current);
      controlsRef.current.target.copy(controlsTargetRef.current);
    } else {
      const distance = 3;
      const angle = -Math.PI / 6;
      cameraRef.current.position.set(
        center.x + Math.cos(angle) * distance,
        center.y + 1,
        center.z + Math.sin(angle) * distance
      );
      cameraRef.current.lookAt(center);
      controlsRef.current.target.copy(center);
    }

    controlsRef.current.update();
    updateFrameStack(); // This is now okay
  }, [updateFrameStack]);

  useEffect(() => {
    console.log('Texture atlas or related values changed');
    if (sceneRef.current && textureAtlas) {
      console.log('Calling updateFrameStack');
      updateFrameStack();
    }
  }, [textureAtlas, updateFrameStack, stackLength, framePercentage, sliceStart, sliceEnd, isFrameOrderInverted]);

  const isStackVisible = useCallback(() => {
    if (!instancedMeshRef.current || !cameraRef.current) return false;

    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      cameraRef.current.projectionMatrix,
      cameraRef.current.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);

    const box = new THREE.Box3().setFromObject(instancedMeshRef.current);
    return frustum.intersectsBox(box);
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    const animate = () => {
      requestAnimationFrame(animate);
      controlsRef.current.update();
      
      if (instancedMeshRef.current && !sceneRef.current.children.includes(instancedMeshRef.current)) {
        console.error('Instanced mesh is not in the scene');
      }
      
      if (instancedMeshRef.current && !isStackVisible()) {
        console.warn('Stack is not visible in camera view');
        console.log('Camera position:', cameraRef.current.position);
        console.log('Camera rotation:', cameraRef.current.rotation);
        console.log('Controls target:', controlsRef.current.target);
        console.log('Stack center:', stackCenterRef.current);
      }
      
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
  }, [canvasWidth, canvasHeight, isStackVisible]);

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
        await extractFrames(video);
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

  useEffect(() => {
    if (shaderMaterialRef.current) {
      sceneRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.material.uniforms.uContrast.value = contrast;
          child.material.uniforms.uBrightness.value = brightness / 50 - 1;
          child.material.uniforms.uOpacity.value = opacity;
          child.material.uniforms.uIsBlackAndWhite.value = isBlackAndWhite;
          child.material.uniforms.uIsInverted.value = isInverted;
        }
      });
    }
  }, [contrast, brightness, opacity, isBlackAndWhite, isInverted]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const axesHelper = new THREE.AxesHelper(2);
    sceneRef.current.add(axesHelper);

    return () => {
      sceneRef.current.remove(axesHelper);
    };
  }, []);

  const storeCameraPosition = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraPositionRef.current.copy(cameraRef.current.position);
      cameraRotationRef.current.copy(cameraRef.current.rotation);
      controlsTargetRef.current.copy(controlsRef.current.target);
    }
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    controls.addEventListener('change', storeCameraPosition);

    return () => {
      controls.removeEventListener('change', storeCameraPosition);
    };
  }, [storeCameraPosition]);

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, position: 'relative' }}>
        {(isLocalLoading || isCreatingAtlas) && (
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
            <div style={{ marginBottom: '20px' }}>
              {isLocalLoading ? 'Extracting Frames' : 'Creating Texture Atlas'}
            </div>
            <div style={{ 
              width: '80%', 
              height: '40px', 
              backgroundColor: '#444',
              borderRadius: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${isLocalLoading ? extractionProgress * 100 : 100}%`,
                height: '100%',
                backgroundColor: '#3498db',
              }} />
            </div>
            {isLocalLoading && (
              <div style={{ marginTop: '10px' }}>
                {Math.round(extractionProgress * 100)}% ({Math.round(extractionProgress * totalFrames)} / {totalFrames} frames)
              </div>
            )}
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
                onChange={(e) => {
                  setBlendMode(e.target.value);
                }}
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
                <option value="Custom">Custom</option>
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
              value={slicePosition}
              min={0}
              max={100 - (sliceEnd - sliceStart)}
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

            <button onClick={resetCamera} style={{
              width: '100%',
              padding: '10px',
              marginBottom: '15px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Reset Camera
            </button>
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
