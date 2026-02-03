module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore critical dependency warnings from @ffmpeg/ffmpeg
      // The library uses dynamic requires for WASM loading which is intentional
      webpackConfig.ignoreWarnings = [
        {
          module: /@ffmpeg/,
          message: /Critical dependency/,
        },
      ];
      return webpackConfig;
    },
  },
};
