// NASA source meshes and UVs; only the offline decoder and map size are changed.
export function buildChandra(T, data, buffer, maps) {
  const attribute = i => {
    const a = data.accessors[i];
    const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.type];
    return new T.BufferAttribute(new Type(buffer, a.offset, a.count * a.size), a.size);
  };
  const materials = data.materials.map(d => {
    const p = d.pbrMetallicRoughness || {}, color = p.baseColorFactor || [1, 1, 1];
    const material = new T.MeshPhongMaterial({
      name: d.name, color: new T.Color().fromArray(color),
      emissive: new T.Color().fromArray(d.emissiveFactor || [0,0,0]),
      map: p.baseColorTexture ? maps[data.textures[p.baseColorTexture.index].source] : null,
      shininess: 24, specular: 0x252525, side: d.doubleSided ? T.DoubleSide : T.FrontSide,
      depthTest: true, depthWrite: true
    });
    // r108's existing renderer outputs linear values. Convert this asset's
    // decoded sRGB maps locally, just as the retained Moon color map does.
    material.onBeforeCompile = (shader, renderer) => {
      if (renderer.outputEncoding === T.LinearEncoding) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <encodings_fragment>',
          'gl_FragColor = LinearTosRGB( gl_FragColor );');
      }
    };
    return material;
  });
  const nodes = data.nodes.map(d => {
    const group = new T.Group();
    if (d.translation) group.position.fromArray(d.translation);
    if (d.rotation) group.quaternion.fromArray(d.rotation);
    if (d.scale) group.scale.fromArray(d.scale);
    if (d.mesh !== undefined) data.meshes[d.mesh].primitives.forEach(p => {
      const geometry = new T.BufferGeometry();
      for (const [key, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv']]) {
        if (p.attributes[key] !== undefined) geometry.addAttribute(name, attribute(p.attributes[key]));
      }
      geometry.setIndex(attribute(p.indices));
      group.add(new T.Mesh(geometry, materials[p.material]));
    });
    return group;
  });
  data.nodes.forEach((d, i) => (d.children || []).forEach(j => nodes[i].add(nodes[j])));
  const raw = new T.Group();
  nodes.forEach(n => { if (!n.parent) raw.add(n); });
  raw.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(raw), size = box.getSize(new T.Vector3());
  raw.position.sub(box.getCenter(new T.Vector3()));
  const model = new T.Group();
  model.add(raw);
  model.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  return model;
}

export function releaseChandra(model) {
  if (!model) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [].concat(o.material || [])) {
      materials.add(m);
      for (const value of Object.values(m)) if (value && value.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());
  if (model.parent) model.parent.remove(model);
}
