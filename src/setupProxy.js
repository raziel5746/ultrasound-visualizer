module.exports = function(app) {
  app.use((req, res, next) => {
    // Required headers for SharedArrayBuffer support (ffmpeg.wasm multi-threaded)
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });
};
