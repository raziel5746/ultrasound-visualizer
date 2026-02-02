import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class VideoConverter {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
    this.loading = false;
    this.onProgress = null;
    this.onLog = null;
  }

  async load() {
    if (this.loaded) return true;
    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.loaded;
    }

    this.loading = true;

    try {
      // Use single-threaded version to avoid Chrome/Safari hang bug with filters
      // See: https://github.com/ffmpegwasm/ffmpeg.wasm/issues/772
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
        if (this.onLog) this.onLog(message);
      });

      this.ffmpeg.on('progress', ({ progress }) => {
        if (this.onProgress) this.onProgress(progress);
      });

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
      return true;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.loaded = false;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async convertToH264(file, onProgress = null) {
    if (!this.loaded) {
      await this.load();
    }

    this.onProgress = onProgress;

    const inputName = 'input' + this.getExtension(file.name);
    const outputName = 'output.mp4';

    try {
      // Write input file to virtual filesystem
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      // Convert to H.264 - no filters to avoid Chrome/Safari hang bug
      // Single-threaded is slower but reliable across all browsers
      const exitCode = await this.ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName
      ]);

      if (exitCode !== 0) {
        throw new Error(`Conversion failed with exit code ${exitCode}`);
      }

      // Read the output file
      const data = await this.ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });

      // Cleanup
      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      return blob;
    } catch (error) {
      console.error('Video conversion error:', error);
      throw error;
    }
  }

  getExtension(filename) {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '.mp4';
  }

  terminate() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.loaded = false;
    }
  }
}

// Singleton instance
let converterInstance = null;

export const getVideoConverter = () => {
  if (!converterInstance) {
    converterInstance = new VideoConverter();
  }
  return converterInstance;
};

export default VideoConverter;
