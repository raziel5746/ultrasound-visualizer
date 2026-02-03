import * as BABYLON from '@babylonjs/core';
import { volumeVertexShader, volumeFragmentShader } from '../shaders/volumeShaders';

class VolumeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.material = null;
    this.volumeTexture = null;
    this.boundingBoxMesh = null;
    this.isInitialized = false;
    this.baseScaling = null; // Store original scaling for volume length adjustments
    
    this.settings = {
      stepSize: 0.002,
      opacity: 0.3,      // Match UI default (DEFAULT_VALUES.OPACITY)
      brightness: 0.5,   // Match UI default (DEFAULT_VALUES.BRIGHTNESS)
      threshold: 0.0,
      maxSteps: 256,
      renderMode: 0, // 0 = accumulate, 1 = MIP
      volumeLength: 1.0,
      clipBounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 },
      lighting: { enabled: false, ambient: 0.3, diffuse: 0.7, specular: 0.4, shininess: 32.0 },
      transferFunction: 'grayscale',
      isosurface: { level: 0.3, smoothness: 1.0, opacity: 1.0 },
    };
  }

  initialize(volumeTexture, dimensions) {
    if (this.isInitialized) {
      this.dispose();
    }

    this.volumeTexture = volumeTexture;

    // Create bounding box mesh (unit cube)
    this.mesh = BABYLON.MeshBuilder.CreateBox('volumeBox', {
      size: 1,
      sideOrientation: BABYLON.Mesh.BACKSIDE, // Render back faces only
    }, this.scene);

    // Scale based on volume dimensions to maintain aspect ratio
    const aspectX = dimensions.width / dimensions.height;
    const aspectZ = dimensions.depth / Math.max(dimensions.width, dimensions.height);
    const scale = 15; // Match existing scale
    this.baseScaling = new BABYLON.Vector3(aspectX * scale, scale, aspectZ * scale);
    this.mesh.scaling = this.baseScaling.clone();

    // Create wireframe bounding box for visualization
    this.boundingBoxMesh = BABYLON.MeshBuilder.CreateBox('volumeBoundingBox', {
      size: 1,
    }, this.scene);
    this.boundingBoxMesh.scaling = this.baseScaling.clone();
    this.boundingBoxMesh.material = new BABYLON.StandardMaterial('boundingBoxMat', this.scene);
    this.boundingBoxMesh.material.wireframe = true;
    this.boundingBoxMesh.material.emissiveColor = new BABYLON.Color3(0.3, 0.7, 1.0);
    this.boundingBoxMesh.material.disableLighting = true;
    this.boundingBoxMesh.isVisible = false; // Hidden by default

    // Create custom shader material
    BABYLON.Effect.ShadersStore['volumeVertexShader'] = volumeVertexShader;
    BABYLON.Effect.ShadersStore['volumeFragmentShader'] = volumeFragmentShader;

    this.material = new BABYLON.ShaderMaterial('volumeMaterial', this.scene, {
      vertex: 'volume',
      fragment: 'volume',
    }, {
      attributes: ['position'],
      uniforms: [
        'world', 'worldViewProjection', 'cameraPosition',
        'volumeScale', 'stepSize', 'opacity', 'brightness',
        'threshold', 'volumeDimensions', 'maxSteps', 'renderMode',
        'clipMin', 'clipMax',
        'lightingEnabled', 'ambient', 'diffuse', 'specular', 'shininess',
        'transferFunctionType',
        'isoLevel', 'isoSmoothness', 'isoOpacity'
      ],
      samplers: ['volumeTexture'],
      needAlphaBlending: true,
    });

    this.material.setTexture('volumeTexture', volumeTexture);
    this.material.setVector3('volumeDimensions', new BABYLON.Vector3(
      dimensions.width, dimensions.height, dimensions.depth
    ));
    this.material.setVector3('volumeScale', this.mesh.scaling);
    
    this.updateUniforms();

    this.material.backFaceCulling = false;
    this.material.alphaMode = BABYLON.Constants.ALPHA_COMBINE;

    this.mesh.material = this.material;
    
    // Set initial visibility to false (will be shown when volume mode is selected)
    this.mesh.isVisible = false;
    
    this.isInitialized = true;

    console.log('VolumeRenderer initialized with dimensions:', dimensions);
    console.log('Volume mesh scaling:', this.mesh.scaling);
    return this;
  }

  updateUniforms() {
    if (!this.material) return;

    this.material.setFloat('stepSize', this.settings.stepSize);
    this.material.setFloat('opacity', this.settings.opacity);
    this.material.setFloat('brightness', this.settings.brightness);
    this.material.setFloat('threshold', this.settings.threshold);
    this.material.setInt('maxSteps', this.settings.maxSteps);
    this.material.setInt('renderMode', this.settings.renderMode);
    
    // Set clip bounds
    const cb = this.settings.clipBounds;
    this.material.setVector3('clipMin', new BABYLON.Vector3(cb.xMin, cb.yMin, cb.zMin));
    this.material.setVector3('clipMax', new BABYLON.Vector3(cb.xMax, cb.yMax, cb.zMax));
    
    // Set lighting
    const lt = this.settings.lighting;
    this.material.setInt('lightingEnabled', lt.enabled ? 1 : 0);
    this.material.setFloat('ambient', lt.ambient);
    this.material.setFloat('diffuse', lt.diffuse);
    this.material.setFloat('specular', lt.specular);
    this.material.setFloat('shininess', lt.shininess);
    
    // Set transfer function type
    const tfMap = { grayscale: 0, heat: 1, cool: 2, bone: 3, copper: 4, viridis: 5, plasma: 6, rainbow: 7 };
    this.material.setInt('transferFunctionType', tfMap[this.settings.transferFunction] || 0);
    
    // Set isosurface parameters
    const iso = this.settings.isosurface;
    this.material.setFloat('isoLevel', iso.level);
    this.material.setFloat('isoSmoothness', iso.smoothness);
    this.material.setFloat('isoOpacity', iso.opacity);
  }

  setStepSize(value) {
    this.settings.stepSize = value;
    this.updateUniforms();
  }

  setOpacity(value) {
    this.settings.opacity = value;
    this.updateUniforms();
  }

  setBrightness(value) {
    this.settings.brightness = value;
    this.updateUniforms();
  }

  setThreshold(value) {
    this.settings.threshold = value;
    this.updateUniforms();
  }

  setMaxSteps(value) {
    this.settings.maxSteps = Math.floor(value);
    this.updateUniforms();
  }

  setRenderMode(mode) {
    // 0 = accumulate (standard volume rendering)
    // 1 = MIP (Maximum Intensity Projection)
    this.settings.renderMode = mode;
    this.updateUniforms();
  }

  setVolumeLength(value) {
    this.settings.volumeLength = value;
    if (this.mesh && this.baseScaling) {
      // Adjust Z scaling based on volume length
      this.mesh.scaling.z = this.baseScaling.z * value;
      if (this.boundingBoxMesh) {
        this.boundingBoxMesh.scaling.z = this.baseScaling.z * value;
      }
      // Update volumeScale uniform for shader
      if (this.material) {
        this.material.setVector3('volumeScale', this.mesh.scaling);
      }
    }
  }

  setClipBounds(bounds) {
    this.settings.clipBounds = { ...bounds };
    this.updateUniforms();
  }

  setLighting(lighting) {
    this.settings.lighting = { ...lighting };
    this.updateUniforms();
  }

  setTransferFunction(tf) {
    this.settings.transferFunction = tf;
    this.updateUniforms();
  }

  setIsosurface(iso) {
    this.settings.isosurface = { ...iso };
    this.updateUniforms();
  }

  updateCameraPosition(cameraPosition) {
    if (this.material) {
      this.material.setVector3('cameraPosition', cameraPosition);
    }
  }

  setVisible(visible) {
    if (this.mesh) {
      this.mesh.isVisible = visible;
    }
  }

  getMesh() {
    return this.mesh;
  }

  getSettings() {
    return { ...this.settings };
  }

  dispose() {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
    if (this.boundingBoxMesh) {
      this.boundingBoxMesh.material?.dispose();
      this.boundingBoxMesh.dispose();
      this.boundingBoxMesh = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    this.baseScaling = null;
    this.isInitialized = false;
  }
}

export default VolumeRenderer;
