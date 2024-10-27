import * as BABYLON from '@babylonjs/core';

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;  // Keep the main camera reference
    this.engine = null;
    this.frameMeshes = [];
    this.light = null;
    this.globalLight = null;
    this.renderLoop = null;
    this.defaultPipeline = null;
    this.postProcesses = {};
    this.frameWidth = null;
    this.frameHeight = null;
    // Add these for orthographic support
    this.perspectiveCamera = null;
    this.orthographicCamera = null;
    this.currentCamera = null;
    this.orthoZoomSensitivity = 0.03; // Fixed value instead of default
  }

  initialize() {
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);

    // Create the main perspective camera
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 4,
      Math.PI / 3,
      75,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    
    // Store reference to perspective camera
    this.perspectiveCamera = this.camera;
    
    // Create orthographic camera
    const orthoRadius = 75;
    this.orthographicCamera = new BABYLON.ArcRotateCamera(
      'orthoCamera',
      -Math.PI / 4,
      Math.PI / 3,
      orthoRadius,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    
    // Set perspective camera limits first
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 150;

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
    this.camera.inertia = 0.5;
    this.camera.angularSensibilityX = 300;
    this.camera.angularSensibilityY = 300;
    this.camera.panningSensibility = 200;
    this.camera.wheelPrecision = 2;
    this.camera.lowerBetaLimit = 0.01;
    this.camera.upperBetaLimit = Math.PI - 0.01;
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 150;

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
      // Copy all camera parameters
      targetCamera.alpha = this.currentCamera.alpha;
      targetCamera.beta = this.currentCamera.beta;
      targetCamera.target = this.currentCamera.target.clone();
      
      // Copy position and target, maintaining the relative position
      const currentPosition = this.currentCamera.position.clone();
      const currentTarget = this.currentCamera.target.clone();
      const offset = currentPosition.subtract(currentTarget);
      
      // Convert zoom between perspective and orthographic
      if (mode === 'orthographic') {
        const orthoSize = this.perspectiveCamera.radius / 2.5;
        this.updateOrthographicSize(orthoSize, this.canvas.width / this.canvas.height);
        targetCamera.radius = this.perspectiveCamera.radius;
      } else {
        const currentOrthoSize = Math.abs(this.orthographicCamera.orthoTop);
        targetCamera.radius = currentOrthoSize * 2.5;
      }
      
      // Apply the position offset to maintain camera translation
      targetCamera.target = currentTarget.clone();
      targetCamera.position = targetCamera.target.add(offset);
      
      // Switch cameras
      this.currentCamera.detachControl();
      
      // Remove any existing wheel input before switching
      if (this._wheelListener) {
        this.canvas.removeEventListener('wheel', this._wheelListener);
        this._wheelListener = null;
      }
      
      // Remove existing wheel input from both cameras
      this.perspectiveCamera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
      this.orthographicCamera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
      
      this.currentCamera = targetCamera;
      this.scene.activeCamera = targetCamera;
      this.camera = targetCamera;
      
      // Dispose of old pipeline
      if (this.defaultPipeline) {
        this.defaultPipeline.dispose();
      }
      
      // Create new pipeline with the target camera
      this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
        "defaultPipeline",
        true,
        this.scene,
        [targetCamera]
      );

      // Reapply pipeline settings
      this.defaultPipeline.imageProcessing.enabled = true;
      this.defaultPipeline.imageProcessing.exposure = 1;
      this.defaultPipeline.imageProcessing.contrast = 1;

      // Reapply bloom settings
      this.defaultPipeline.bloomEnabled = true;
      this.defaultPipeline.bloomThreshold = 0.8;
      this.defaultPipeline.bloomWeight = 0.3;
      this.defaultPipeline.bloomKernel = 64;
      this.defaultPipeline.bloomScale = 0.5;

      // Reapply FXAA
      this.defaultPipeline.fxaaEnabled = true;

      // Reapply sharpening
      this.defaultPipeline.sharpenEnabled = true;
      this.defaultPipeline.sharpen.edgeAmount = 0.3;
      this.defaultPipeline.sharpen.colorAmount = 1;
      
      // Handle wheel behavior for orthographic camera
      if (mode === 'orthographic') {
        const wheel = (event) => {
          const delta = event.deltaY;
          const zoomFactor = 1 + (delta > 0 ? this.orthoZoomSensitivity : -this.orthoZoomSensitivity);
          
          const currentSize = Math.abs(this.orthographicCamera.orthoTop);
          const aspectRatio = this.canvas.width / this.canvas.height;
          
          // Use perspective camera limits to calculate ortho limits
          const minOrthoSize = this.perspectiveCamera.lowerRadiusLimit / 2.5;
          const maxOrthoSize = this.perspectiveCamera.upperRadiusLimit / 2.5;
          
          const newSize = Math.min(Math.max(currentSize * zoomFactor, minOrthoSize), maxOrthoSize);
          
          this.updateOrthographicSize(newSize, aspectRatio);
          this.perspectiveCamera.radius = newSize * 2.5; // Keep perspective camera in sync
          
          event.preventDefault();
        };
        
        this.canvas.addEventListener('wheel', wheel, { passive: false });
        this._wheelListener = wheel;
      } else {
        // Add wheel input only to perspective camera
        targetCamera.inputs.addMouseWheel();
      }
      
      this.currentCamera.attachControl(this.canvas, true);
    }
  }

  updateOrthographicSize(size, aspectRatio) {
    this.orthographicCamera.orthoLeft = -size * aspectRatio;
    this.orthographicCamera.orthoRight = size * aspectRatio;
    this.orthographicCamera.orthoBottom = -size;
    this.orthographicCamera.orthoTop = size;
  }
}

export default SceneManager;
