import * as BABYLON from '@babylonjs/core';

class TextureAtlas {
  constructor(scene, maxSize = 8192) {
    this.scene = scene;
    this.maxSize = maxSize;
    this.atlas = null;
    this.frames = [];
    this.uvCoordinates = [];
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

    console.log(`Creating texture atlas with size: ${width}x${height}, scale: ${scale}`);

    const atlas = new BABYLON.DynamicTexture('atlas', { width, height }, this.scene, false);
    const ctx = atlas.getContext();

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Pack the frames using the successful configuration
    this.packFrames(frameCanvases, ctx, width, height, scale);
    
    atlas.update(true);
    this.atlas = atlas;
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
}

export default TextureAtlas;
