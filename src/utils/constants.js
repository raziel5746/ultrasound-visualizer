// Visualization and rendering constants
export const VISUALIZATION = {
  SCALE: 15,
  MAX_FRAMES: 500,
  BATCH_SIZE: 10,
  FRAME_RATE: 30,
};

// Resolution dimensions
export const SD_DIMENSIONS = {
  mobile: { width: 640, height: 480 },
  desktop: { width: 1280, height: 720 }
};

export const HD_DIMENSIONS = {
  mobile: { width: 1280, height: 720 },
  desktop: { width: 1920, height: 1080 }
};

// Target FPS settings
export const TARGET_FPS = {
  mobile: 30,
  desktop: 60
};

// UI constants
export const UI = {
  MARGIN: 0.1,
  HANDLE_RADIUS: 15,
  MOBILE_BREAKPOINT: 768,
  CONTROL_PANEL_WIDTH: 320,
  MOBILE_PANEL_HEIGHT: 340,
};

// Camera defaults
export const CAMERA = {
  DEFAULT_RADIUS: 75,
  LOWER_RADIUS_LIMIT: 10,
  UPPER_RADIUS_LIMIT: 150,
  INERTIA: 0.5,
  ANGULAR_SENSIBILITY_X: 300,
  ANGULAR_SENSIBILITY_Y: 300,
  PANNING_SENSIBILITY: 200,
  WHEEL_PRECISION: 2,
};

// Default visualization values
export const DEFAULT_VALUES = {
  STACK_LENGTH: 1.5,
  FRAME_PERCENTAGE: 50,
  OPACITY: 0.3,
  BRIGHTNESS: 0.5,
  GLOBAL_LIGHT_INTENSITY: 2.5,
  EXPOSURE: 1,
  CONTRAST: 1,
  SLICE_RANGE: [0, 100],
  BACKGROUND_COLOR: '#000000',
};

// Texture atlas limits
export const TEXTURE_ATLAS = {
  MAX_SIZE_MOBILE: 4096,
  MAX_SIZE_DESKTOP: 8192,
  MAX_GPU_TEXTURE_SIZE: 16384,
  MIN_WARN_SIZE: 2048,
  FALLBACK_SIZE: 4096,
};
