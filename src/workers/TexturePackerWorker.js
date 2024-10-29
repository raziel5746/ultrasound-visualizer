/* eslint-disable no-restricted-globals */
self.onmessage = async function(e) {
  const { frameBitmaps, width, height, scale } = e.data;
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');
  
  let x = 0, y = 0, rowHeight = 0;
  const frames = [];
  const uvCoordinates = [];

  for (const bitmap of frameBitmaps) {
    const scaledWidth = Math.floor(bitmap.width * scale);
    const scaledHeight = Math.floor(bitmap.height * scale);

    if (x + scaledWidth > width) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }

    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, x, y, scaledWidth, scaledHeight);

    frames.push({ x, y, width: scaledWidth, height: scaledHeight });
    uvCoordinates.push({
      x: x / width,
      y: y / height,
      width: scaledWidth / width,
      height: scaledHeight / height
    });

    x += scaledWidth;
    rowHeight = Math.max(rowHeight, scaledHeight);
  }

  const blob = await offscreen.convertToBlob();
  const buffer = await blob.arrayBuffer();

  self.postMessage({ buffer, frames, uvCoordinates }, [buffer]);
}; 