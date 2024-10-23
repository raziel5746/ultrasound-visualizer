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

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  createFrameMesh(texture, position, scale = 1, effects = {}) {
    const planeMesh = BABYLON.MeshBuilder.CreatePlane("frame", { 
      width: 1.6 * scale, 
      height: 1 * scale, 
      sideOrientation: BABYLON.Mesh.DOUBLESIDE 
    }, this.scene);
    
    const material = new BABYLON.StandardMaterial("frameMaterial", this.scene);
    material.diffuseTexture = texture;
    material.backFaceCulling = false;
    
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
}

export default SceneManager;
