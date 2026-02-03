import * as BABYLON from '@babylonjs/core';

class VolumeTexture {
  constructor(scene) {
    this.scene = scene;
    this.texture = null;
    this.width = 0;
    this.height = 0;
    this.depth = 0;
  }

  createFromFrames(frames, options = {}) {
    if (!frames || frames.length === 0) {
      console.error('No frames provided to VolumeTexture');
      return null;
    }

    const firstFrame = frames[0];
    this.width = firstFrame.width;
    this.height = firstFrame.height;
    this.depth = frames.length;

    const engine = this.scene.getEngine();
    const gl = engine._gl;

    if (!gl.texImage3D) {
      console.error('WebGL2 3D textures not supported');
      return null;
    }

    const volumeData = this.packFramesToVolume(frames);

    this.texture = new BABYLON.RawTexture3D(
      volumeData,
      this.width,
      this.height,
      this.depth,
      BABYLON.Engine.TEXTUREFORMAT_R,
      this.scene,
      false,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      BABYLON.Engine.TEXTURETYPE_UNSIGNED_BYTE
    );

    this.texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    this.texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    this.texture.wrapR = BABYLON.Texture.CLAMP_ADDRESSMODE;

    console.log(`VolumeTexture created: ${this.width}x${this.height}x${this.depth}`);
    return this.texture;
  }

  packFramesToVolume(frames) {
    const totalSize = this.width * this.height * this.depth;
    const volumeData = new Uint8Array(totalSize);

    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    for (let z = 0; z < frames.length; z++) {
      const frame = frames[z];
      
      ctx.clearRect(0, 0, this.width, this.height);
      
      if (frame instanceof ImageBitmap || frame instanceof HTMLImageElement || 
          frame instanceof HTMLCanvasElement || frame instanceof HTMLVideoElement) {
        ctx.drawImage(frame, 0, 0, this.width, this.height);
      } else if (frame.data) {
        const imageData = new ImageData(
          new Uint8ClampedArray(frame.data),
          frame.width,
          frame.height
        );
        ctx.putImageData(imageData, 0, 0);
      }

      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      const pixels = imageData.data;

      const sliceOffset = z * this.width * this.height;
      
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const pixelIndex = (y * this.width + x) * 4;
          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          const grayscale = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          
          const volumeIndex = sliceOffset + y * this.width + x;
          volumeData[volumeIndex] = grayscale;
        }
      }
    }

    return volumeData;
  }

  createFromImageBitmaps(bitmaps) {
    return this.createFromFrames(bitmaps);
  }

  getTexture() {
    return this.texture;
  }

  getDimensions() {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth
    };
  }

  getAspectRatio() {
    return this.width / this.height;
  }

  dispose() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}

export default VolumeTexture;
