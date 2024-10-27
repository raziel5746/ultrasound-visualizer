import * as BABYLON from '@babylonjs/core';

class TextureAtlas {
  constructor(scene, maxSize = 8192) {
    this.scene = scene;
    
    // Get the GPU's maximum texture size with fallback
    let maxTextureSize;
    try {
      const gl = scene.getEngine()._gl;
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      
      // Some devices report unrealistic values, cap it at 16384
      maxTextureSize = Math.min(maxTextureSize, 16384);
    } catch (error) {
      console.warn('Could not detect maximum texture size:', error);
      maxTextureSize = 4096; // Conservative fallback
    }
    
    // Set maxSize based on device and GPU capabilities
    const isMobile = window.innerWidth <= 768;
    const defaultMaxSize = isMobile ? 4096 : 8192;
    this.maxSize = Math.min(maxTextureSize, defaultMaxSize, maxSize);
    
    // If the texture size is very small, warn the user
    if (this.maxSize < 2048) {
      console.warn(`Limited texture size detected: ${this.maxSize}px. Performance may be affected.`);
    }
    
    this.atlas = null;
    this.frames = [];
    this.uvCoordinates = [];
    this.originalAtlas = null;  // Store the original texture
    this.processedAtlas = null; // Store the processed version
  }

  async createAtlas(frameCanvases) {
    let { width, height, scale } = this.calculateOptimalAtlasSize(frameCanvases);
    let allFramesFit = false;
    
    // Keep reducing scale until all frames fit
    while (!allFramesFit) {
      // First ensure we're within maximum texture size
      while (width > this.maxSize || height > this.maxSize) {
        scale *= 0.9; // Reduce scale by 10%
        ({ width, height } = this.calculateOptimalAtlasSize(frameCanvases, scale));
      }

      // Try to pack all frames with current dimensions
      const packingResult = this.tryPackFrames(frameCanvases, width, height, scale);
      
      if (packingResult.success) {
        allFramesFit = true;
      } else {
        // If frames don't fit, reduce scale and try again
        scale *= 0.9;
        ({ width, height } = this.calculateOptimalAtlasSize(frameCanvases, scale));
      }
    }

    const atlas = new BABYLON.DynamicTexture('atlas', { width, height }, this.scene, false);
    const ctx = atlas.getContext();

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Pack the frames using the successful configuration
    this.packFrames(frameCanvases, ctx, width, height, scale);
    
    atlas.update(true);
    this.originalAtlas = atlas;
    this.processedAtlas = atlas.clone();
    this.atlas = this.processedAtlas; // This is what we'll use for rendering

    // Add this line to apply initial filters
    this.applyFilters({ brightness: 1, contrast: 0 });  // Apply default filters
  }

  tryPackFrames(frameCanvases, width, height, scale) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (let i = 0; i < frameCanvases.length; i++) {
      const canvas = frameCanvases[i];
      const scaledWidth = Math.floor(canvas.width * scale);
      const scaledHeight = Math.floor(canvas.height * scale);

      if (x + scaledWidth > width) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }

      if (y + scaledHeight > height) {
        return { success: false };
      }

      x += scaledWidth;
      rowHeight = Math.max(rowHeight, scaledHeight);
    }

    return { success: true };
  }

  packFrames(frameCanvases, ctx, width, height, scale) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    this.frames = [];
    this.uvCoordinates = [];

    for (let i = 0; i < frameCanvases.length; i++) {
      const canvas = frameCanvases[i];
      const scaledWidth = Math.floor(canvas.width * scale);
      const scaledHeight = Math.floor(canvas.height * scale);

      if (x + scaledWidth > width) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }

      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, x, y, scaledWidth, scaledHeight);

      this.frames.push({
        x,
        y,
        width: scaledWidth,
        height: scaledHeight
      });

      this.uvCoordinates.push({
        x: x / width,
        y: y / height,
        width: scaledWidth / width,
        height: scaledHeight / height
      });

      x += scaledWidth;
      rowHeight = Math.max(rowHeight, scaledHeight);
    }
  }

  calculateOptimalAtlasSize(frameCanvases, scale = 1) {
    let totalArea = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    frameCanvases.forEach(canvas => {
      const scaledWidth = Math.floor(canvas.width * scale);
      const scaledHeight = Math.floor(canvas.height * scale);
      totalArea += scaledWidth * scaledHeight;
      maxWidth = Math.max(maxWidth, scaledWidth);
      maxHeight = Math.max(maxHeight, scaledHeight);
    });

    let width = Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea)));
    let height = Math.ceil(totalArea / width);

    // Ensure width and height are powers of 2 for optimal texture performance
    width = this.nextPowerOfTwo(width);
    height = this.nextPowerOfTwo(height);

    return { width, height, scale };
  }

  nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  getFrameUV(index) {
    const uv = this.uvCoordinates[index];
    return [
      uv.x, 1 - uv.y - uv.height,  // Top-left
      uv.x + uv.width, 1 - uv.y - uv.height,  // Top-right
      uv.x + uv.width, 1 - uv.y,  // Bottom-right
      uv.x, 1 - uv.y  // Bottom-left
    ];
  }

  // Add new method for applying filters
  applyFilters(filters) {
    const ctx = this.processedAtlas.getContext();
    const originalCtx = this.originalAtlas.getContext();
    const width = this.originalAtlas.getSize().width;
    const height = this.originalAtlas.getSize().height;

    // Get image data
    const imageData = originalCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply brightness and contrast filters
    if (filters.brightness !== undefined || filters.contrast !== undefined) {
      const brightness = filters.brightness || 1;
      const contrast = filters.contrast !== undefined ? filters.contrast : 0;
      // Adjust factor calculation to handle 0 contrast
      const factor = contrast === 0 ? 1 : (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness first
        let r = data[i] * brightness;
        let g = data[i + 1] * brightness;
        let b = data[i + 2] * brightness;

        // Then apply contrast (only if contrast > 0)
        if (contrast > 0) {
          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          b = factor * (b - 128) + 128;
        }

        // Clamp values
        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }
    }

    // Apply inversion filter
    if (filters.isInverted) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    }

    // Apply alpha-from-brightness filter
    if (filters.alphaFromBrightness) {
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        data[i + 3] = Math.round(brightness * 255);
      }
    }

    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
    this.processedAtlas.update();
  }
}

export default TextureAtlas;
