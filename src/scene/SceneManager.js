import * as BABYLON from '@babylonjs/core';
import { CAMERA } from '../utils/constants';
import VolumeRenderer from './VolumeRenderer';

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.engine = null;
    this.frameMeshes = [];
    this.light = null;
    this.globalLight = null;
    this.renderLoop = null;
    this.defaultPipeline = null;
    this.postProcesses = {};
    this.frameWidth = null;
    this.frameHeight = null;
    // Orthographic camera support
    this.perspectiveCamera = null;
    this.orthographicCamera = null;
    this.currentCamera = null;
    this.orthoZoomSensitivity = 0.03;
    this.orthoPanSensitivity = 150;
    this.orthoExponent = 0.3;
    // Volume rendering
    this.volumeRenderer = null;
    this.renderMode = 'planes'; // 'planes' or 'volume'
  }

  initialize() {
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);

    // Create the main perspective camera
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 4,
      Math.PI / 3,
      CAMERA.DEFAULT_RADIUS,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    
    // Store reference to perspective camera
    this.perspectiveCamera = this.camera;
    
    // Create orthographic camera
    this.orthographicCamera = new BABYLON.ArcRotateCamera(
      'orthoCamera',
      -Math.PI / 4,
      Math.PI / 3,
      CAMERA.DEFAULT_RADIUS,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    
    // Set perspective camera limits first
    this.camera.lowerRadiusLimit = CAMERA.LOWER_RADIUS_LIMIT;
    this.camera.upperRadiusLimit = CAMERA.UPPER_RADIUS_LIMIT;

    // Set up orthographic mode with calculated limits
    const aspectRatio = this.canvas.width / this.canvas.height;
    this.orthographicCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.updateOrthographicSize(this.camera.radius / 2.5, aspectRatio);

    // Copy settings to orthographic camera
    this.orthographicCamera.inertia = this.camera.inertia;
    this.orthographicCamera.angularSensibilityX = this.camera.angularSensibilityX;
    this.orthographicCamera.angularSensibilityY = this.camera.angularSensibilityY;
    this.orthographicCamera.panningSensibility = this.camera.panningSensibility;
    this.orthographicCamera.wheelPrecision = this.camera.wheelPrecision;
    this.orthographicCamera.lowerBetaLimit = this.camera.lowerBetaLimit;
    this.orthographicCamera.upperBetaLimit = this.camera.upperBetaLimit;

    // Set initial camera and attach controls
    this.currentCamera = this.perspectiveCamera;
    this.scene.activeCamera = this.currentCamera;
    this.camera.attachControl(this.canvas, true);

    // Configure camera settings
    this.camera.inertia = CAMERA.INERTIA;
    this.camera.angularSensibilityX = CAMERA.ANGULAR_SENSIBILITY_X;
    this.camera.angularSensibilityY = CAMERA.ANGULAR_SENSIBILITY_Y;
    this.camera.panningSensibility = CAMERA.PANNING_SENSIBILITY;
    this.camera.wheelPrecision = CAMERA.WHEEL_PRECISION;
    this.camera.lowerBetaLimit = 0.01;
    this.camera.upperBetaLimit = Math.PI - 0.01;
    this.camera.lowerRadiusLimit = CAMERA.LOWER_RADIUS_LIMIT;
    this.camera.upperRadiusLimit = CAMERA.UPPER_RADIUS_LIMIT;

    // Configure orthographic camera with adjusted panning
    this.orthographicCamera.inertia = this.camera.inertia;
    this.orthographicCamera.angularSensibilityX = this.camera.angularSensibilityX;
    this.orthographicCamera.angularSensibilityY = this.camera.angularSensibilityY;
    this.orthographicCamera.panningSensibility = 50; // Lower value = faster panning
    this.orthographicCamera.wheelPrecision = this.camera.wheelPrecision;
    this.orthographicCamera.lowerBetaLimit = this.camera.lowerBetaLimit;
    this.orthographicCamera.upperBetaLimit = this.camera.upperBetaLimit;
    this.orthographicCamera.lowerRadiusLimit = this.camera.lowerRadiusLimit;
    this.orthographicCamera.upperRadiusLimit = this.camera.upperRadiusLimit;

    // Set up lighting
    this.globalLight = new BABYLON.HemisphericLight(
      "globalLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    this.globalLight.intensity = 1;

    // Store initial camera position and target
    this.initialCameraPosition = this.camera.position.clone();
    this.initialCameraTarget = this.camera.target.clone();

    // Initialize default pipeline with the main camera
    this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
      "defaultPipeline",
      true,
      this.scene,
      [this.camera]
    );

    // Configure image processing
    this.defaultPipeline.imageProcessing.enabled = true;
    this.defaultPipeline.imageProcessing.exposure = 1;
    this.defaultPipeline.imageProcessing.contrast = 1;

    // Configure bloom
    this.defaultPipeline.bloomEnabled = true;
    this.defaultPipeline.bloomThreshold = 0.8;
    this.defaultPipeline.bloomWeight = 0.3;
    this.defaultPipeline.bloomKernel = 64;
    this.defaultPipeline.bloomScale = 0.5;

    // Configure FXAA
    this.defaultPipeline.fxaaEnabled = true;

    // Configure sharpening
    this.defaultPipeline.sharpenEnabled = true;
    this.defaultPipeline.sharpen.edgeAmount = 0.3;
    this.defaultPipeline.sharpen.colorAmount = 1;

    // Configure grain
    this.defaultPipeline.grainEnabled = false;
    this.defaultPipeline.grain.intensity = 10;
    this.defaultPipeline.grain.animated = true;

    // Configure chromatic aberration
    this.defaultPipeline.chromaticAberrationEnabled = false;
    this.defaultPipeline.chromaticAberration.aberrationAmount = 30;
    this.defaultPipeline.chromaticAberration.radialIntensity = 1;

    // Set initial background color
    this.scene.clearColor = BABYLON.Color3.FromHexString('#000000');

    window.addEventListener('resize', () => {
      const aspectRatio = this.canvas.width / this.canvas.height;
      if (this.currentCamera === this.orthographicCamera) {
        const currentSize = Math.abs(this.orthographicCamera.orthoTop);
        this.updateOrthographicSize(currentSize, aspectRatio);
      }
      this.engine.resize();
    });

    // Add observers to keep cameras in sync
    this.perspectiveCamera.onViewMatrixChangedObservable.add(() => this.updateCameras());
    this.orthographicCamera.onViewMatrixChangedObservable.add(() => this.updateCameras());
  }

  createFrameMesh(texture, position, scale = 1, effects = {}) {
    // Calculate aspect ratio from UV coordinates
    if (effects.uv) {
      // UV coordinates are in this order: [topLeftU, topLeftV, topRightU, topRightV, bottomRightU, bottomRightV, bottomLeftU, bottomLeftV]
      const frameWidth = Math.abs(effects.uv[2] - effects.uv[0]);  // topRight.U - topLeft.U
      const frameHeight = Math.abs(effects.uv[5] - effects.uv[1]); // bottomRight.V - topRight.V
      const aspectRatio = frameWidth / frameHeight;
      
      this.frameWidth = aspectRatio * scale;
      this.frameHeight = 1.0 * scale;
    } else {
      // Fallback to default aspect ratio if no UV coordinates
      this.frameWidth = 1.6 * scale;
      this.frameHeight = 1.0 * scale;
    }

    const planeMesh = BABYLON.MeshBuilder.CreatePlane("frame", {
      width: this.frameWidth,
      height: this.frameHeight
    }, this.scene);

    const material = new BABYLON.StandardMaterial("frameMaterial", this.scene);
    material.diffuseTexture = texture;
    material.backFaceCulling = false;
    
    // Remove specular reflection
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    
    // Enable alpha
    material.useAlphaFromDiffuseTexture = true;

    // Apply effects
    const brightness = effects.brightness;
    if (effects.colorMap) {
      const colors = effects.colorMap(brightness);
      material.diffuseColor = new BABYLON.Color3(colors.r, colors.g, colors.b);
    } else {
      material.diffuseColor = new BABYLON.Color3(brightness, brightness, brightness);
    }

    // Apply blending mode
    switch (effects.blendMode) {
      case BABYLON.Constants.ALPHA_COMBINE:
        material.alphaMode = BABYLON.Constants.ALPHA_COMBINE;
        break;
      case BABYLON.Constants.ALPHA_ADD:
        material.alphaMode = BABYLON.Constants.ALPHA_ADD;
        break;
      case BABYLON.Constants.ALPHA_SUBTRACT:
        material.alphaMode = BABYLON.Constants.ALPHA_SUBTRACT;
        break;
      case BABYLON.Constants.ALPHA_MULTIPLY:
        material.alphaMode = BABYLON.Constants.ALPHA_MULTIPLY;
        break;
      case BABYLON.Constants.ALPHA_MAXIMIZED:
        material.alphaMode = BABYLON.Constants.ALPHA_MAXIMIZED;
        break;
      default:
        material.alphaMode = BABYLON.Constants.ALPHA_COMBINE;
    }

    // Apply UV coordinates if provided
    if (effects.uv) {
      planeMesh.setVerticesData(BABYLON.VertexBuffer.UVKind, effects.uv);
    }

    planeMesh.material = material;
    planeMesh.position = position;
    this.frameMeshes.push(planeMesh);
    return planeMesh;
  }

  clearFrameMeshes() {
    this.frameMeshes.forEach(mesh => mesh.dispose());
    this.frameMeshes = [];
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  dispose() {
    if (this._wheelListener) {
      this.canvas.removeEventListener('wheel', this._wheelListener);
      this._wheelListener = null;
    }
    this.clearFrameMeshes();
    this.scene.dispose();
    this.engine.dispose();
  }

  // Add this new method
  setBackgroundColor(color) {
    this.scene.clearColor = BABYLON.Color3.FromHexString(color);
  }

  // Add a method to update camera settings
  updateCameraSettings(settings) {
    if (settings.inertia !== undefined) this.camera.inertia = settings.inertia;
    if (settings.angularSensibilityX !== undefined) this.camera.angularSensibilityX = settings.angularSensibilityX;
    if (settings.angularSensibilityY !== undefined) this.camera.angularSensibilityY = settings.angularSensibilityY;
    if (settings.panningSensibility !== undefined) this.camera.panningSensibility = settings.panningSensibility;
    if (settings.wheelPrecision !== undefined) this.camera.wheelPrecision = settings.wheelPrecision;
  }

  resetCamera() {
    this.camera.position = this.initialCameraPosition.clone();
    this.camera.target = this.initialCameraTarget.clone();
  }

  setGlobalLightIntensity(intensity) {
    if (this.globalLight) {
      this.globalLight.intensity = intensity;
    }
  }

  update() {
    // Update logic here, if any
  }

  render() {
    this.scene.render();
  }

  // Add a method to render a single frame
  renderFrame() {
    this.scene.render();
  }

  // Add new method to update post-processing settings
  updatePostProcessing(settings) {
    if (!this.defaultPipeline) return;

    // Update image processing
    if (settings.exposure !== undefined) {
      this.defaultPipeline.imageProcessing.exposure = settings.exposure;
    }
    if (settings.contrast !== undefined) {
      this.defaultPipeline.imageProcessing.contrast = settings.contrast;
    }

    // Update bloom
    if (settings.bloomEnabled !== undefined) {
      this.defaultPipeline.bloomEnabled = settings.bloomEnabled;
    }
    if (settings.bloomThreshold !== undefined) {
      this.defaultPipeline.bloomThreshold = settings.bloomThreshold;
    }
    if (settings.bloomWeight !== undefined) {
      this.defaultPipeline.bloomWeight = settings.bloomWeight;
    }

    // Update sharpening
    if (settings.sharpenEnabled !== undefined) {
      this.defaultPipeline.sharpenEnabled = settings.sharpenEnabled;
    }
    if (settings.sharpenAmount !== undefined) {
      this.defaultPipeline.sharpen.edgeAmount = settings.sharpenAmount;
    }

    // Update grain
    if (settings.grainEnabled !== undefined) {
      this.defaultPipeline.grainEnabled = settings.grainEnabled;
    }
    if (settings.grainIntensity !== undefined) {
      this.defaultPipeline.grain.intensity = settings.grainIntensity;
    }

    // Update chromatic aberration
    if (settings.chromaticAberrationEnabled !== undefined) {
      this.defaultPipeline.chromaticAberrationEnabled = settings.chromaticAberrationEnabled;
    }
    if (settings.chromaticAberrationAmount !== undefined) {
      this.defaultPipeline.chromaticAberration.aberrationAmount = settings.chromaticAberrationAmount;
    }
  }

  updateClipPlanes(bounds) {
    if (!bounds) return;

    const { top, bottom, left, right } = bounds;
    const scaleX = this.frameWidth / 2;
    const scaleY = this.frameHeight / 2;

    // Create the clipping planes
    this.scene.clipPlane = new BABYLON.Plane(1, 0, 0, -right * scaleX);    // Right plane
    this.scene.clipPlane2 = new BABYLON.Plane(-1, 0, 0, left * scaleX);    // Left plane
    this.scene.clipPlane3 = new BABYLON.Plane(0, 1, 0, -top * scaleY);     // Top plane
    this.scene.clipPlane4 = new BABYLON.Plane(0, -1, 0, bottom * scaleY);  // Bottom plane

    // Update all existing meshes with all clipping planes
    this.frameMeshes.forEach(mesh => {
      if (mesh.material) {
        mesh.material.clipPlane = this.scene.clipPlane;
        mesh.material.clipPlane2 = this.scene.clipPlane2;
        mesh.material.clipPlane3 = this.scene.clipPlane3;
        mesh.material.clipPlane4 = this.scene.clipPlane4;
        mesh.material.forceClipPlane = true;
        mesh.material.needDepthPrePass = true;
        mesh.material.separateCullingPass = true;
        mesh.material.markAsDirty(BABYLON.Material.ClipPlaneDirtyFlag);
        mesh.material.markAsDirty(BABYLON.Material.AllDirtyFlag);
      }
    });

    this.scene.markAllMaterialsAsDirty(BABYLON.Material.ClipPlaneDirtyFlag);
    this.scene.markAllMaterialsAsDirty(BABYLON.Material.AllDirtyFlag);
  }

  updateMeshOpacity(opacity) {
    this.frameMeshes.forEach(mesh => {
      if (mesh.material) {
        mesh.material.alpha = opacity;
      }
    });
  }

  updateMeshBrightness(brightness, colorMap) {
    this.frameMeshes.forEach(mesh => {
      if (mesh.material) {
        if (colorMap) {
          const colors = colorMap(brightness);
          mesh.material.diffuseColor = new BABYLON.Color3(colors.r, colors.g, colors.b);
        } else {
          mesh.material.diffuseColor = new BABYLON.Color3(brightness, brightness, brightness);
        }
      }
    });
  }

  hasMeshes() {
    return this.scene.meshes.length > 0;
  }

  // Add these methods to the SceneManager class
  updateExposure(value) {
    if (this.defaultPipeline) {
      this.defaultPipeline.imageProcessing.exposure = value;
    }
  }

  updateContrast(value) {
    if (this.defaultPipeline) {
      this.defaultPipeline.imageProcessing.contrast = value;
    }
  }

  // Update setCameraMode to work with the main camera reference
  setCameraMode(mode) {
    const targetCamera = mode === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;
    
    if (targetCamera !== this.currentCamera) {
      // Store current camera state
      const currentState = {
        alpha: this.currentCamera.alpha,
        beta: this.currentCamera.beta,
        radius: this.currentCamera.radius,
        target: this.currentCamera.target.clone(),
        position: this.currentCamera.position.clone()
      };

      // Switch cameras
      this.currentCamera.detachControl();
      this.currentCamera = targetCamera;
      this.scene.activeCamera = targetCamera;
      this.camera = targetCamera;

      // Apply stored state to new camera
      targetCamera.alpha = currentState.alpha;
      targetCamera.beta = currentState.beta;
      targetCamera.target = currentState.target;

      if (mode === 'orthographic') {
        const orthoSize = currentState.radius / 2.5;
        this.updateOrthographicSize(orthoSize, this.canvas.width / this.canvas.height);
        targetCamera.position = currentState.position;
      } else {
        targetCamera.radius = currentState.radius;
      }

      // Recreate pipeline
      if (this.defaultPipeline) {
        this.defaultPipeline.dispose();
      }
      this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
        "defaultPipeline",
        true,
        this.scene,
        [targetCamera]
      );
      // Reapply pipeline settings...

      // Set up wheel behavior
      this.setupWheelBehavior(mode);

      this.currentCamera.attachControl(this.canvas, true);

      // Update panning sensitivity
      this.updatePanningSensitivity(mode);
    }
  }

  setupWheelBehavior(mode) {
    if (this._wheelListener) {
      this.canvas.removeEventListener('wheel', this._wheelListener);
      this._wheelListener = null;
    }

    if (mode === 'orthographic') {
      this._wheelListener = (event) => {
        const delta = event.deltaY;
        const zoomFactor = 1 + (delta > 0 ? this.orthoZoomSensitivity : -this.orthoZoomSensitivity);
        
        const currentSize = Math.abs(this.orthographicCamera.orthoTop);
        const aspectRatio = this.canvas.width / this.canvas.height;
        
        const minOrthoSize = this.perspectiveCamera.lowerRadiusLimit / 2.5;
        const maxOrthoSize = this.perspectiveCamera.upperRadiusLimit / 2.5;
        
        const newSize = Math.min(Math.max(currentSize * zoomFactor, minOrthoSize), maxOrthoSize);
        
        this.updateOrthographicSize(newSize, aspectRatio);
        this.perspectiveCamera.radius = newSize * 2.5;
        
        event.preventDefault();
      };
      this.canvas.addEventListener('wheel', this._wheelListener, { passive: false });
    } else {
      this.perspectiveCamera.inputs.addMouseWheel();
    }
  }

  updatePanningSensitivity(mode) {
    if (mode === 'orthographic') {
      const currentSize = Math.abs(this.orthographicCamera.orthoTop);
      const panningSensitivity = this.calculateOrthoPanningSensitivity(currentSize);
      this.orthographicCamera.panningSensibility = panningSensitivity;
    } else {
      this.perspectiveCamera.panningSensibility = 200;
    }
  }

  // Add this method to keep cameras in sync
  updateCameras() {
    if (this.currentCamera === this.orthographicCamera) {
      const currentOrthoSize = Math.abs(this.orthographicCamera.orthoTop);
      this.perspectiveCamera.radius = currentOrthoSize * 2.5;
      this.perspectiveCamera.alpha = this.orthographicCamera.alpha;
      this.perspectiveCamera.beta = this.orthographicCamera.beta;
      this.perspectiveCamera.target = this.orthographicCamera.target.clone();
    } else {
      const orthoSize = this.perspectiveCamera.radius / 2.5;
      this.updateOrthographicSize(orthoSize, this.canvas.width / this.canvas.height);
      this.orthographicCamera.alpha = this.perspectiveCamera.alpha;
      this.orthographicCamera.beta = this.perspectiveCamera.beta;
      this.orthographicCamera.target = this.perspectiveCamera.target.clone();
    }
  }

  updateOrthographicSize(size, aspectRatio) {
    this.orthographicCamera.orthoLeft = -size * aspectRatio;
    this.orthographicCamera.orthoRight = size * aspectRatio;
    this.orthographicCamera.orthoBottom = -size;
    this.orthographicCamera.orthoTop = size;

    // Update panning sensitivity based on zoom level using a non-linear function
    if (this.currentCamera === this.orthographicCamera) {
      const panningSensitivity = this.calculateOrthoPanningSensitivity(size);
      this.orthographicCamera.panningSensibility = panningSensitivity;
    }

    // Update perspective camera radius when orthographic size changes
    this.perspectiveCamera.radius = size * 2.5;
  }

  calculateOrthoPanningSensitivity(size) {
    const minSize = 5;
    const maxSize = 60;
    const minSensitivity = 10;
    const maxSensitivity = 200;

    const normalizedSize = (size - minSize) / (maxSize - minSize);
    const factor = Math.pow(normalizedSize, this.orthoExponent); // Use the exponent here

    const sensitivity = minSensitivity + (maxSensitivity - minSensitivity) * factor;
    return sensitivity * (this.orthoPanSensitivity / 100);
  }

  setOrthoPanSensitivity(value) {
    this.orthoPanSensitivity = value;
    this.updateOrthoPanning();
  }

  setOrthoExponent(value) { // New method
    this.orthoExponent = value;
    this.updateOrthoPanning();
  }

  updateOrthoPanning() { // Helper method to update panning
    if (this.currentCamera === this.orthographicCamera) {
      const currentSize = Math.abs(this.orthographicCamera.orthoTop);
      const panningSensitivity = this.calculateOrthoPanningSensitivity(currentSize);
      this.orthographicCamera.panningSensibility = panningSensitivity;
    }
  }

  // Volume Rendering Methods
  initializeVolumeRenderer(volumeTexture, dimensions) {
    if (!this.volumeRenderer) {
      this.volumeRenderer = new VolumeRenderer(this.scene);
    }
    this.volumeRenderer.initialize(volumeTexture, dimensions);
    this.volumeRenderer.setVisible(this.renderMode === 'volume');
    return this.volumeRenderer;
  }

  setRenderMode(mode) {
    console.log('Setting render mode to:', mode, 'frameMeshes:', this.frameMeshes.length, 'volumeRenderer:', !!this.volumeRenderer);
    this.renderMode = mode;
    
    // Toggle visibility based on mode
    if (mode === 'volume') {
      this.frameMeshes.forEach(mesh => mesh.isVisible = false);
      if (this.volumeRenderer) {
        this.volumeRenderer.setVisible(true);
        console.log('Volume renderer set to visible');
      }
    } else {
      this.frameMeshes.forEach(mesh => mesh.isVisible = true);
      if (this.volumeRenderer) {
        this.volumeRenderer.setVisible(false);
      }
    }
  }

  getRenderMode() {
    return this.renderMode;
  }

  getVolumeRenderer() {
    return this.volumeRenderer;
  }

  updateVolumeSettings(settings) {
    if (!this.volumeRenderer) return;
    
    if (settings.stepSize !== undefined) this.volumeRenderer.setStepSize(settings.stepSize);
    if (settings.opacity !== undefined) this.volumeRenderer.setOpacity(settings.opacity);
    if (settings.brightness !== undefined) this.volumeRenderer.setBrightness(settings.brightness);
    if (settings.threshold !== undefined) this.volumeRenderer.setThreshold(settings.threshold);
    if (settings.maxSteps !== undefined) this.volumeRenderer.setMaxSteps(settings.maxSteps);
    if (settings.renderMode !== undefined) this.volumeRenderer.setRenderMode(settings.renderMode);
    if (settings.volumeLength !== undefined) this.volumeRenderer.setVolumeLength(settings.volumeLength);
    if (settings.clipBounds !== undefined) this.volumeRenderer.setClipBounds(settings.clipBounds);
    if (settings.clipMode !== undefined) this.volumeRenderer.setClipMode(settings.clipMode);
    if (settings.sphereClip !== undefined) this.volumeRenderer.setSphereClip(settings.sphereClip);
    if (settings.gamma !== undefined) this.volumeRenderer.setGamma(settings.gamma);
    if (settings.softness !== undefined) this.volumeRenderer.setSoftness(settings.softness);
    if (settings.minOpacity !== undefined) this.volumeRenderer.setMinOpacity(settings.minOpacity);
    if (settings.preset !== undefined) return this.volumeRenderer.applyPreset(settings.preset);
    if (settings.lighting !== undefined) this.volumeRenderer.setLighting(settings.lighting);
    if (settings.transferFunction !== undefined) this.volumeRenderer.setTransferFunction(settings.transferFunction);
    if (settings.isosurface !== undefined) this.volumeRenderer.setIsosurface(settings.isosurface);
    if (settings.structureTensor !== undefined) this.volumeRenderer.setStructureTensor(settings.structureTensor);
    if (settings.cinematic !== undefined) this.volumeRenderer.setCinematic(settings.cinematic);
  }

  updateVolumeCameraPosition() {
    if (this.volumeRenderer && this.currentCamera) {
      this.volumeRenderer.updateCameraPosition(this.currentCamera.position);
    }
  }

  disposeVolumeRenderer() {
    if (this.volumeRenderer) {
      this.volumeRenderer.dispose();
      this.volumeRenderer = null;
    }
  }
}

export default SceneManager;
