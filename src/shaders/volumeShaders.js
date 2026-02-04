export const loadShaders = async () => {
  const vertResponse = await fetch('/shaders/volume.vert');
  const fragResponse = await fetch('/shaders/volume.frag');
  const volumeVertexShader = await vertResponse.text();
  const volumeFragmentShader = await fragResponse.text();
  return { volumeVertexShader, volumeFragmentShader };
};
