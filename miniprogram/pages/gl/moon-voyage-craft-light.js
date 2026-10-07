// Local material lighting only: the original Earth, Moon and orbit lights stay intact.
// The encounter camera sees sunlight entering from screen right.
export function shadeCraft(T, materials, camera) {
  const sun=new T.Vector3(1,.3,.45).normalize();
  for(const material of materials||[]) {
    if(material.name==='Fire')continue;
    const gundam=material.userData.craftLightProfile==='gundam';
    const key=gundam?new T.Vector3(.65,.85,1).normalize():sun;
    if(material.userData.craftSun){material.userData.craftSun.value.copy(key);continue;}
    const uniform={value:key.clone()};material.userData.craftSun=uniform;
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,renderer){
      if(previous)previous.call(this,shader,renderer);
      shader.uniforms.craftSun=uniform;
      shader.fragmentShader='uniform vec3 craftSun;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`
        GeometricContext geometry;
        geometry.position = -vViewPosition;
        geometry.normal = normal;
        geometry.viewDir = normalize(vViewPosition);
        #ifdef CLEARCOAT
          geometry.clearcoatNormal = clearcoatNormal;
        #endif
        IncidentLight directLight;
        directLight.direction = normalize(craftSun);
        directLight.color = ${gundam?'vec3(3.6, 3.3, 2.85)':'vec3(2.5, 2.32, 2.08)'};
        directLight.visible = true;
        RE_Direct(directLight, geometry, material, reflectedLight);
        ${gundam?`// Cool grazing light shapes the opposite armour edges.
        directLight.direction = normalize(vec3(-1.0, 0.35, -0.65));
        directLight.color = vec3(0.65, 1.65, 3.2);
        RE_Direct(directLight, geometry, material, reflectedLight);`:''}
        #if defined(RE_IndirectDiffuse)
          vec3 iblIrradiance = vec3(0.0);
          vec3 irradiance = vec3(0.15, 0.18, 0.23);
        #endif
        #if defined(RE_IndirectSpecular)
          vec3 radiance = vec3(0.0);
          vec3 clearcoatRadiance = vec3(0.0);
        #endif
      `);
      if(gundam)shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',`
        // A restrained rim on the lit silhouette, not a flat emissive body.
        float craftRim = pow(1.0 - saturate(dot(normal, geometry.viewDir)), 3.0);
        craftRim *= smoothstep(-0.2, 0.65, dot(normal, normalize(vec3(-1.0, 0.35, -0.65))));
        outgoingLight += vec3(0.12, 0.36, 0.65) * craftRim;
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
      `);
    };
    material.needsUpdate=true;
  }
}
