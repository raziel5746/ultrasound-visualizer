// Predefined color maps for different tissue types
export const ColorMaps = {
  DEFAULT: {
    name: 'Default',
    map: (value) => ({ r: value, g: value, b: value }),
  },
  BONE: {
    name: 'Bone',
    defaultParams: {
      redIntensity: 1.2,
      greenIntensity: 1.1,
      blueIntensity: 0.9,
    },
    map: (value, params = {}) => ({
      r: Math.min(1, value * (params.redIntensity || 1.2)),
      g: Math.min(1, value * (params.greenIntensity || 1.1)),
      b: Math.min(1, value * (params.blueIntensity || 0.9)),
    }),
  },
  SOFT_TISSUE: {
    name: 'Soft Tissue',
    defaultParams: {
      redIntensity: 1.1,
      greenIntensity: 0.9,
      blueIntensity: 0.8,
    },
    map: (value, params = {}) => ({
      r: Math.min(1, value * (params.redIntensity || 1.1)),
      g: Math.min(1, value * (params.greenIntensity || 0.9)),
      b: Math.min(1, value * (params.blueIntensity || 0.8)),
    }),
  },
  VASCULAR: {
    name: 'Vascular',
    defaultParams: {
      redIntensity: 1.3,
      greenIntensity: 0.7,
      blueIntensity: 0.7,
    },
    map: (value, params = {}) => ({
      r: Math.min(1, value * (params.redIntensity || 1.3)),
      g: Math.min(1, value * (params.greenIntensity || 0.7)),
      b: Math.min(1, value * (params.blueIntensity || 0.7)),
    }),
  },
  THERMAL: {
    name: 'Thermal',
    defaultParams: {
      hotIntensity: 2.0,
      midOffset: 0.5,
      coldOffset: 1.0,
    },
    map: (value, params = {}) => {
      const hotIntensity = params.hotIntensity || 2.0;
      const midOffset = params.midOffset || 0.5;
      const coldOffset = params.coldOffset || 1.0;
      return {
        r: Math.min(1, value * hotIntensity),
        g: Math.min(1, Math.max(0, value * hotIntensity - midOffset)),
        b: Math.min(1, Math.max(0, value * hotIntensity - coldOffset)),
      };
    },
  },
  PLASMA: {
    name: 'Plasma',
    defaultParams: {
      hotIntensity: 2.0,
      midOffset: 0.3,
      coldOffset: 0.7,
    },
    map: (value, params = {}) => {
      const hotIntensity = params.hotIntensity || 2.0;
      const midOffset = params.midOffset || 0.3;
      const coldOffset = params.coldOffset || 0.7;
      return {
        b: Math.min(1, value * hotIntensity),
        r: Math.min(1, Math.max(0, value * hotIntensity - midOffset)),
        g: Math.min(1, Math.max(0, value * hotIntensity - coldOffset)),
      };
    },
  },
  RAINBOW: {
    name: 'Rainbow',
    defaultParams: {
      hotIntensity: 2.5,
      midOffset: 0.4,
      coldOffset: 0.8,
    },
    map: (value, params = {}) => {
      const hotIntensity = params.hotIntensity || 2.5;
      const midOffset = params.midOffset || 0.4;
      const coldOffset = params.coldOffset || 0.8;
      return {
        r: Math.min(1, Math.max(0, value * hotIntensity - coldOffset)),
        g: Math.min(1, Math.max(0, value * hotIntensity - midOffset)),
        b: Math.min(1, value * hotIntensity),
      };
    },
  },
  MAGMA: {
    name: 'Magma',
    defaultParams: {
      hotIntensity: 2.2,
      midOffset: 0.6,
      coldOffset: 0.3,
    },
    map: (value, params = {}) => {
      const hotIntensity = params.hotIntensity || 2.2;
      const midOffset = params.midOffset || 0.6;
      const coldOffset = params.coldOffset || 0.3;
      return {
        r: Math.min(1, value * hotIntensity),
        b: Math.min(1, Math.max(0, value * hotIntensity - midOffset)),
        g: Math.min(1, Math.max(0, value * hotIntensity - coldOffset)),
      };
    },
  },
};

export const getColorMapNames = () => {
  return Object.keys(ColorMaps).map(key => ({
    key,
    name: ColorMaps[key].name,
  }));
};

export const getColorMapDefaultParams = (mapKey) => {
  const colorMap = ColorMaps[mapKey];
  return colorMap?.defaultParams || {};
};

export const applyColorMap = (value, mapKey, params = {}) => {
  const colorMap = ColorMaps[mapKey] || ColorMaps.DEFAULT;
  return colorMap.map(value, params);
};
