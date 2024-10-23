import * as BABYLON from '@babylonjs/core';

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
    this.clipPlane = null;
    this.clipPlanes = {
      top: null,
      bottom: null,
      left: null,
      right: null
    };
    this.debugPlanes = {
      top: null,
      bottom: null,
      left: null,
      right: null
    };
  }

  initialize() {
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);

    // Increase the camera distance
    this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 4, Math.PI / 3, 75, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);

    // Configure camera inertia and sensitivity
    this.camera.inertia = 0.5;
    this.camera.angularSensibilityX = 300;
    this.camera.angularSensibilityY = 300;
    this.camera.panningSensibility = 200;
    this.camera.wheelPrecision = 2;

    // Optionally, set less restrictive limits if needed
    this.camera.lowerBetaLimit = 0.01;
    this.camera.upperBetaLimit = Math.PI - 0.01;

    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 150;

    // Replace the existing light with a HemisphericLight
    this.globalLight = new BABYLON.HemisphericLight("globalLight", new BABYLON.Vector3(0, 1, 0), this.scene);
    this.globalLight.intensity = 1; // Default intensity

    // Set initial background color
    this.scene.clearColor = BABYLON.Color3.FromHexString('#000000');

    // Store initial camera position and target
    this.initialCameraPosition = this.camera.position.clone();
    this.initialCameraTarget = this.camera.target.clone();

    // Initialize default pipeline
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

    // Create a vertical plane that cuts through the center
    this.clipPlanes.left = new BABYLON.Plane(1, 0, 0, 0);

    // Create a horizontal plane that cuts through the center
    this.clipPlanes.top = new BABYLON.Plane(0, 1, 0, 0);

    // Log the planes for debugging
    console.log('Initial clip planes:', {
      vertical: { normal: [1, 0, 0], distance: 0 },
      horizontal: { normal: [0, 1, 0], distance: 0 }
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  createFrameMesh(texture, position, scale = 1, effects = {}) {
    // Add these as class properties so we can reference them for scaling
    this.frameWidth = 1.6 * scale;
    this.frameHeight = 1.0 * scale;
    
    const planeMesh = BABYLON.MeshBuilder.CreatePlane("frame", { 
      width: this.frameWidth, 
      height: this.frameHeight, 
      sideOrientation: BABYLON.Mesh.DOUBLESIDE 
    }, this.scene);
    
    const material = new BABYLON.StandardMaterial("frameMaterial", this.scene);
    material.diffuseTexture = texture;
    material.backFaceCulling = false;
    
    // Enable clipping on the material
    material.clipPlanes = Object.values(this.clipPlanes).filter(plane => plane !== null);
    material.forceClipPlane = true; // Add this line to force clipping

    // Remove specular reflection
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    
    // Enable alpha
    material.useAlphaFromDiffuseTexture = true;

    // Apply effects
    material.alpha = effects.opacity || 1;
    
    // Apply brightness and color mapping
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

    // Apply UV coordinates if provided, without flipping them vertically
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
    // Add cleanup for debug planes
    Object.values(this.debugPlanes).forEach(plane => {
      if (plane) plane.dispose();
    });
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
    // Use the frame dimensions to scale the clip planes
    const scaleX = this.frameWidth / 2;  // Divide by 2 because normalized coords are -1 to 1
    const scaleY = this.frameHeight / 2;

    // Dispose of existing debug planes
    Object.values(this.debugPlanes).forEach(plane => {
      if (plane) plane.dispose();
    });

    // Create visible debug planes
    this.debugPlanes.left = this.createDebugPlane(new BABYLON.Color3(1, 0, 0));   // Red
    this.debugPlanes.right = this.createDebugPlane(new BABYLON.Color3(0, 1, 0));  // Green
    this.debugPlanes.top = this.createDebugPlane(new BABYLON.Color3(0, 0, 1));    // Blue
    this.debugPlanes.bottom = this.createDebugPlane(new BABYLON.Color3(1, 1, 0)); // Yellow

    // Position the planes using the frame dimensions for scaling
    this.debugPlanes.left.position = new BABYLON.Vector3(scaleX * left, 0, 0);
    this.debugPlanes.left.rotation.y = Math.PI / 2;
    this.debugPlanes.left.scaling.y = 2; // Make the planes big enough to see

    this.debugPlanes.right.position = new BABYLON.Vector3(scaleX * right, 0, 0);
    this.debugPlanes.right.rotation.y = Math.PI / 2;
    this.debugPlanes.right.scaling.y = 2;

    this.debugPlanes.top.position = new BABYLON.Vector3(0, scaleY * top, 0);
    this.debugPlanes.top.rotation.x = Math.PI / 2;
    this.debugPlanes.top.scaling.y = 2;

    this.debugPlanes.bottom.position = new BABYLON.Vector3(0, scaleY * bottom, 0);
    this.debugPlanes.bottom.rotation.x = Math.PI / 2;
    this.debugPlanes.bottom.scaling.y = 2;

    // Create clipping planes using the scaled coordinates
    this.clipPlanes.left = new BABYLON.Plane(1, 0, 0, -scaleX * left);
    this.clipPlanes.right = new BABYLON.Plane(-1, 0, 0, scaleX * right);
    this.clipPlanes.top = new BABYLON.Plane(0, 1, 0, -scaleY * top);
    this.clipPlanes.bottom = new BABYLON.Plane(0, -1, 0, scaleY * bottom);

    // Update all existing meshes with the new clip planes
    this.frameMeshes.forEach(mesh => {
      if (mesh.material) {
        const activeClipPlanes = Object.values(this.clipPlanes).filter(plane => plane !== null);
        mesh.material.clipPlanes = activeClipPlanes;
        mesh.material.markAsDirty(BABYLON.Material.ClipPlaneDirtyFlag);
      }
    });

    this.scene.markAllMaterialsAsDirty(BABYLON.Material.ClipPlaneDirtyFlag);
  }

  createDebugPlane(color) {
    const plane = BABYLON.MeshBuilder.CreatePlane("debugPlane", { 
      width: 30,  // Make it large enough to see
      height: 30
    }, this.scene);
    
    const material = new BABYLON.StandardMaterial("debugPlaneMaterial", this.scene);
    material.diffuseColor = color;
    material.alpha = 0.5; // Make it semi-transparent
    material.backFaceCulling = false;
    plane.material = material;

    return plane;
  }
}

export default SceneManager;
