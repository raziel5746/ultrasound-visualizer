import * as BABYLON from '@babylonjs/core';

class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.engine = null;
    this.frameMeshes = [];
    this.light = null;
  }

  initialize() {
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = new BABYLON.Scene(this.engine);

    // Increase the camera distance
    this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 4, Math.PI / 3, 75, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);

    this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);

    // Set initial background color
    this.scene.clearColor = BABYLON.Color3.FromHexString('#000000');

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  createFrameMesh(texture, position, scale = 1, effects = {}) {
    const planeMesh = BABYLON.MeshBuilder.CreatePlane("frame", { width: 1.6 * scale, height: 1 * scale }, this.scene);
    const material = new BABYLON.StandardMaterial("frameMaterial", this.scene);
    material.diffuseTexture = texture;
    material.backFaceCulling = false;
    
    // Apply effects
    material.alpha = effects.opacity || 1;
    material.diffuseColor = new BABYLON.Color3(effects.brightness || 1, effects.brightness || 1, effects.brightness || 1);
    material.diffuseTexture.level = effects.contrast || 1;

    // Apply blending mode
    if (effects.blendMode !== undefined) {
      material.alphaMode = effects.blendMode;
    }

    // Apply blend factor for certain blend modes
    if (effects.blendFactor !== undefined && 
        (effects.blendMode === BABYLON.Constants.ALPHA_ADD)) {
      material.alpha = effects.blendFactor;
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
}

export default SceneManager;
