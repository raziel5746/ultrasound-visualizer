import * as BABYLON from '@babylonjs/core';
import { TEXTURE_ATLAS, UI } from './constants';

class TextureAtlas {
  constructor(scene, maxSize = TEXTURE_ATLAS.MAX_SIZE_DESKTOP) {
    this.scene = scene;
    
    // Get the GPU's maximum texture size with fallback
    let maxTextureSize;
    try {
      const gl = scene.getEngine()._gl;
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      
      // Some devices report unrealistic values, cap it
      maxTextureSize = Math.min(maxTextureSize, TEXTURE_ATLAS.MAX_GPU_TEXTURE_SIZE);
    } catch (error) {
      console.warn('Could not detect maximum texture size:', error);
      maxTextureSize = TEXTURE_ATLAS.FALLBACK_SIZE;
    }
    
    // Set maxSize based on device and GPU capabilities
    const isMobile = window.innerWidth <= UI.MOBILE_BREAKPOINT;
    const defaultMaxSize = isMobile ? TEXTURE_ATLAS.MAX_SIZE_MOBILE : TEXTURE_ATLAS.MAX_SIZE_DESKTOP;
    this.maxSize = Math.min(maxTextureSize, defaultMaxSize, maxSize);
    
    // If the texture size is very small, warn the user
    if (this.maxSize < TEXTURE_ATLAS.MIN_WARN_SIZE) {
      console.warn(`Limited texture size detected: ${this.maxSize}px. Performance may be affected.`);
    }
    
    this.atlas = null;
    this.frames = [];
    this.uvCoordinates = [];
    this.originalAtlas = null;  // Store the original texture
    this.processedAtlas = null; // Store the processed version
    this.bitmapCache = new Map(); // Add this to store ImageBitmaps
  }

  // Add new method to create ImageBitmap from video frame
  static async createFrameBitmaps(video, frameCount) {
    const bitmapPromises = [];
    const frameInterval = video.duration / frameCount;
    
    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i * frameInterval;
      bitmapPromises.push(
        new Promise(resolve => {
          video.onseeked = () => {
            createImageBitmap(video).then(resolve);
          };
        })
      );
    }

    return Promise.all(bitmapPromises);
  }

  async createAtlas(frameBitmaps) {
    try {
      let { width, height, scale } = this.calculateOptimalAtlasSize(frameBitmaps);
      let allFramesFit = false;
      
      while (!allFramesFit) {
        while (width > this.maxSize || height > this.maxSize) {
          scale *= 0.9;
          ({ width, height } = this.calculateOptimalAtlasSize(frameBitmaps, scale));
        }

        const packingResult = this.tryPackFrames(frameBitmaps, width, height, scale);
        
        if (packingResult.success) {
          allFramesFit = true;
        } else {
          scale *= 0.9;
          ({ width, height } = this.calculateOptimalAtlasSize(frameBitmaps, scale));
        }
      }

      const atlas = new BABYLON.DynamicTexture('atlas', { width, height }, this.scene, false);
      const ctx = atlas.getContext();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Pack the frames using ImageBitmap
      await this.packFrameBitmaps(frameBitmaps, ctx, width, height, scale);
      
      atlas.update(true);
      this.originalAtlas = atlas;
      this.processedAtlas = atlas.clone();
      this.atlas = this.processedAtlas;

      // Apply initial filters
      this.applyFilters({ brightness: 1, contrast: 0 });

      // Clean up bitmaps after they're packed
      frameBitmaps.forEach(bitmap => {
        if (bitmap instanceof ImageBitmap) {
          bitmap.close();
        }
      });

      return this.atlas;
    } catch (error) {
      // Clean up on error
      frameBitmaps.forEach(bitmap => {
        if (bitmap instanceof ImageBitmap) {
          bitmap.close();
        }
      });
      throw error;
    }
  }

  tryPackFrames(frameBitmaps, width, height, scale) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (let i = 0; i < frameBitmaps.length; i++) {
      const bitmap = frameBitmaps[i];
      const scaledWidth = Math.floor(bitmap.width * scale);
      const scaledHeight = Math.floor(bitmap.height * scale);

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

  calculateOptimalAtlasSize(frameBitmaps, scale = 1) {
    let totalArea = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    frameBitmaps.forEach(bitmap => {
      const scaledWidth = Math.floor(bitmap.width * scale);
      const scaledHeight = Math.floor(bitmap.height * scale);
      totalArea += scaledWidth * scaledHeight;
      maxWidth = Math.max(maxWidth, scaledWidth);
      maxHeight = Math.max(maxHeight, scaledHeight);
    });

    let width = Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea)));
    let height = Math.ceil(totalArea / width);

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
    const width = this.originalAtlas.getSize().width;
    const height = this.originalAtlas.getSize().height;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Combine all filters into a single filter string
    const filterParts = [];
    
    if (filters.brightness !== undefined) {
      filterParts.push(`brightness(${filters.brightness * 100}%)`);
    }
    
    if (filters.contrast !== undefined) {
      filterParts.push(`contrast(${filters.contrast * 100 + 100}%)`);
    }

    if (filters.isGrayscale) {
      filterParts.push('grayscale(100%)');
    }

    if (filters.isInverted) {
      filterParts.push('invert(100%)');
    }
    
    // Apply all filters at once
    ctx.filter = filterParts.join(' ');

    // Draw the original image with all filters applied in one pass
    ctx.drawImage(this.originalAtlas.getContext().canvas, 0, 0);

    this.processedAtlas.update();
  }

  // Add new method to pack ImageBitmaps
  async packFrameBitmaps(frameBitmaps, ctx, width, height, scale) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    this.frames = [];
    this.uvCoordinates = [];

    for (let i = 0; i < frameBitmaps.length; i++) {
      const bitmap = frameBitmaps[i];
      const scaledWidth = Math.floor(bitmap.width * scale);
      const scaledHeight = Math.floor(bitmap.height * scale);

      if (x + scaledWidth > width) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }

      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, x, y, scaledWidth, scaledHeight);

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

  // Add cleanup method
  dispose() {
    // Clean up ImageBitmaps
    for (const bitmap of this.bitmapCache.values()) {
      bitmap.close();
    }
    this.bitmapCache.clear();
    
    // Clean up existing textures
    if (this.originalAtlas) {
      this.originalAtlas.dispose();
    }
    if (this.processedAtlas) {
      this.processedAtlas.dispose();
    }
  }

  async createProgressiveAtlas(video, frameCount, onProgress) {
    const batchSize = 10; // Process 10 frames at a time
    const frames = [];
    
    for (let i = 0; i < frameCount; i += batchSize) {
      const batchFrames = await this.extractFrameBatch(video, i, Math.min(batchSize, frameCount - i));
      frames.push(...batchFrames);
      
      if (onProgress) {
        onProgress(i / frameCount);
      }
    }
    
    return this.createAtlas(frames);
  }

  async createAtlasWithWorker(frameBitmaps) {
    try {
      const { width, height, scale } = this.calculateOptimalAtlasSize(frameBitmaps);
      
      // Create and setup worker
      const worker = new Worker(new URL('../workers/TexturePackerWorker.js', import.meta.url));
      
      // Create promise to handle worker response
      const atlasData = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          const { buffer, frames, uvCoordinates } = e.data;
          resolve({ buffer, frames, uvCoordinates });
        };
        worker.onerror = reject;
        
        // Send bitmaps to worker
        worker.postMessage({
          frameBitmaps,
          width,
          height,
          scale
        }, frameBitmaps.map(b => b));  // Transfer bitmap ownership
      });
      
      // Create texture from received buffer
      const blob = new Blob([atlasData.buffer]);
      const imageUrl = URL.createObjectURL(blob);
      const atlas = new BABYLON.Texture(imageUrl, this.scene);
      
      // Store frame data
      this.frames = atlasData.frames;
      this.uvCoordinates = atlasData.uvCoordinates;
      
      // Cleanup
      URL.revokeObjectURL(imageUrl);
      worker.terminate();
      
      return atlas;
    } catch (error) {
      console.error('Error in worker-based atlas creation:', error);
      throw error;
    }
  }
}

export default TextureAtlas;
