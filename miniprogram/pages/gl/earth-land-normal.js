// Terrain relief belongs only to ordinary daytime Phong materials.
export function applyLandNormal(THREE, material, terrain, enabled = true) {
  if (!material?.isMeshPhongMaterial || !terrain) return;
  const state = material.userData;
  if (state.landNormal === terrain && state.landNormalEnabled === enabled) return;
  if (!state.landNormal) state.landNormalOriginalCompile = material.onBeforeCompile;
  state.landNormal = terrain;
  state.landNormalEnabled = enabled;
  material.normalMap = enabled ? terrain.normal : null;
  material.onBeforeCompile = state.landNormalOriginalCompile;
  if (enabled) {
    material.normalScale.set(terrain.strength, terrain.strength);
    const original = state.landNormalOriginalCompile;
    material.onBeforeCompile = (shader, renderer) => {
      original?.call(material, shader, renderer);
      shader.uniforms.uLandMask = { value: terrain.mask };
      shader.fragmentShader = 'uniform sampler2D uLandMask;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        vec3 smoothNormal = normal;
        #include <normal_fragment_maps>
        float land = 1.0 - smoothstep(0.10, 0.90, texture2D(uLandMask, vUv).r);
        normal = normalize(mix(smoothNormal, normal, land));
      `);
    };
  }
  material.transparent = false;
  material.depthWrite = true;
  material.needsUpdate = true;
}
