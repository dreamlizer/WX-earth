// Existing native 8K PBR crop + generated regolith microtexture on the original 3D surface.
export function installTerrainDetail(material,{textures,THREE,meta}){
 const {nearColor:color,nearNormal:norm,nearRough:rough,nearAO:ao,grain}=textures;
 grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
 const enabled={value:1},previous=material.onBeforeCompile;
 material.customProgramCacheKey=()=> 'ending-lit-near-detail-2';
 material.onBeforeCompile=function(s,...args){
  previous.call(this,s,...args);
  Object.assign(s.uniforms,{detailEnabled:enabled,nearColor:{value:color},nearNormal:{value:norm},nearRough:{value:rough},nearAO:{value:ao},regolith:{value:grain},cropOrigin:{value:new THREE.Vector2(...meta.uvOrigin)},cropExtent:{value:new THREE.Vector2(...meta.uvExtent)}});
  s.fragmentShader=`uniform float detailEnabled;
uniform sampler2D nearColor,nearNormal,nearRough,nearAO,regolith;
uniform vec2 cropOrigin,cropExtent;
// World triplanar projection prevents streaks on the inclined foreground.
float lunarGrain(vec3 p,vec3 weights){p=p/1.0;return dot(mapTexelToLinear(texture2D(regolith,p.zy)).rgb,vec3(.333333))*weights.x+dot(mapTexelToLinear(texture2D(regolith,p.xz)).rgb,vec3(.333333))*weights.y+dot(mapTexelToLinear(texture2D(regolith,p.xy)).rgb,vec3(.333333))*weights.z;}
vec3 residualNormal(vec3 p,vec3 n,float h){vec3 dx=dFdx(p),dy=dFdy(p),rx=cross(dy,n),ry=cross(n,dx);float det=dot(dx,rx);return normalize(abs(det)*n-sign(det)*(dFdx(h)*rx+dFdy(h)*ry));}
`+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('vec3 baseColor=mapTexelToLinear(texture2D(globalMoon,globalUV)).rgb;',`
vec2 patchUV=(vUv-cropOrigin)/cropExtent;
float patchEdge=smoothstep(0.,.06,min(min(patchUV.x,patchUV.y),min(1.-patchUV.x,1.-patchUV.y)));
float nearWeight=detailEnabled*patchEdge*(1.-smoothstep(4.,14.,distance(cameraPosition,vLunarWorld)));
vec2 safePatchUV=clamp(patchUV,vec2(.001),vec2(.999));
vec3 baseColor=mapTexelToLinear(texture2D(globalMoon,globalUV)).rgb;
diffuseColor.rgb=mix(diffuseColor.rgb,mapTexelToLinear(texture2D(nearColor,safePatchUV)).rgb,nearWeight);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','vec3 geometryNormalBeforeMap=normal;\n#include <normal_fragment_maps>');
  s.fragmentShader=s.fragmentShader.replace('vec3 localNormal=texture2D(normalMap,vUv).xyz*2.-1.;',`vec3 localNormal=mix(texture2D(normalMap,vUv).xyz,texture2D(nearNormal,safePatchUV).xyz,nearWeight)*2.-1.;`);
  s.fragmentShader=s.fragmentShader.replace('normal=normalize(normalMatrix*mix(radial,capNormal,capWeight));',`normal=normalize(normalMatrix*mix(radial,capNormal,capWeight));
 float closeDetail=nearWeight*(1.-smoothstep(2.,7.,distance(cameraPosition,vLunarWorld)));
 normal=normalize(mix(normal,geometryNormalBeforeMap,closeDetail*.9));
 vec3 geometricN=normalize(cross(dFdx(vLunarWorld),dFdy(vLunarWorld)));if(geometricN.y<0.)geometricN=-geometricN;
 vec3 triWeights=pow(abs(geometricN),vec3(4.));triWeights/=dot(triWeights,vec3(1.));
 float grainValue=lunarGrain(vLunarWorld,triWeights);
 vec3 microN=residualNormal(vLunarWorld,geometricN,grainValue*.003);
 vec3 solarDirection=vec3(.92489986,.30521965,.22671835);
 float microLight=clamp(1.+(dot(microN,solarDirection)-dot(geometricN,solarDirection))*.9,.62,1.38);
 float grainAlbedo=clamp(grainValue/.216826,.40,1.65);
 // Local color variation is deliberately restrained; the original low-frequency color remains.
 diffuseColor.rgb*=mix(1.,mix(1.,grainAlbedo,.68)*microLight,closeDetail);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(roughnessFactor,texture2D(nearRough,safePatchUV).g,nearWeight);`);
  s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vUv2 ).r','mix(texture2D( aoMap, vUv2 ).r,texture2D(nearAO,safePatchUV).r,nearWeight)'));
 };
 return {setEnabled(value){enabled.value=value?1:0},meta};
}
