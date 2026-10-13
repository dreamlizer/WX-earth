// 地球与月球共享视觉参数；复用项目 r108 引擎。
// 纹理由调用者持有/释放；本对象仅持有自己的几何与材质，不改变已有对象。
export const PLANET_PARAMS = Object.freeze({
  cloudRadius: 1.008, cloudOpacity: 0.62, cloudRelief: 0.0035,
  cloudShadow: 0.12, waterStrength: 0.30, waterShininess: 28,
  dayFloor: 0.12, dayFill: 1.10, dayDirect: 1.40, oceanTint: 0.12,
  terrainNormalStrength: 2.0,
  nightGain: 1.45, atmosphereRadius: 1.023, atmosphereGain: 0.82,
  moonNormalScale: 1.0, moonRoughness: 0.96
});

const vertex = `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
void main(){
  vUv=uv;
  vWorld=(modelMatrix*vec4(position,1.0)).xyz;
  vec3 n=normalize(normal);
  vec3 t=normalize(vec3(n.z,0.0,-n.x)+vec3(0.000001,0.0,0.0));
  vNormal=normalize(mat3(modelMatrix)*n);
  vTangent=normalize(mat3(modelMatrix)*t);
  vBitangent=normalize(mat3(modelMatrix)*cross(n,t));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

// 普通颜色纹理上传为 LinearEncoding，由 shader 显式解码一次。
// 使用当前 renderer 的 tone mapping，单独输出 sRGB，不改变飞行器/土星的全局色彩管线。
const common = `
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
uniform vec3 uSun;
uniform float uBrightness;
uniform mat3 uDayUv, uNightUv, uCloudUv, uMaskUv;
uniform vec2 uCloudTexel;
vec3 decodeColor(vec3 c){
 return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
vec2 coord(mat3 m,vec2 uv){return (m*vec3(uv,1.0)).xy;}
float cloudDensity(sampler2D tex, vec2 uv){return texture2D(tex,coord(uCloudUv,uv)).r;}
vec3 cloudNormal(sampler2D tex,vec2 uv,float relief){
 float dx=cloudDensity(tex,uv+vec2(uCloudTexel.x,0.0))-cloudDensity(tex,uv-vec2(uCloudTexel.x,0.0));
 float dy=cloudDensity(tex,uv+vec2(0.0,uCloudTexel.y))-cloudDensity(tex,uv-vec2(0.0,uCloudTexel.y));
 float lat=max(0.18,sin(uv.y*3.14159265));
 return normalize(vNormal - vTangent*dx*relief/(uCloudTexel.x*6.2831853*lat)
  -vBitangent*dy*relief/(uCloudTexel.y*3.14159265));
}
`;
const output = `
 gl_FragColor.rgb *= uBrightness;
 #include <tonemapping_fragment>
 gl_FragColor.rgb = mix(12.92*gl_FragColor.rgb, 1.055*pow(max(gl_FragColor.rgb,vec3(0.0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),gl_FragColor.rgb));
`;

function uvMatrix(T,texture){
  if(texture && texture.matrixAutoUpdate) texture.updateMatrix();
  return texture && texture.matrix ? texture.matrix.clone() : new T.Matrix3();
}
function uniforms(T,textures,p){
 return {
  uSun:{value:new T.Vector3(1,0,0)},uBrightness:{value:1},
  uDay:{value:textures.day},uNight:{value:textures.night},
  uCloud:{value:textures.cloud},uMask:{value:textures.mask},
  uTerrainNormal:{value:textures.terrainNormal},
  uTerrainUv:{value:uvMatrix(T,textures.terrainNormal)},
  uTerrainStrength:{value:p.terrainNormalStrength},
  uDayUv:{value:uvMatrix(T,textures.day)},uNightUv:{value:uvMatrix(T,textures.night)},
  uCloudUv:{value:uvMatrix(T,textures.cloud)},uMaskUv:{value:uvMatrix(T,textures.mask)},
  uCloudTexel:{value:new T.Vector2(1/textures.cloud.image.width,1/textures.cloud.image.height)},
  uCloudOpacity:{value:p.cloudOpacity},uRelief:{value:p.cloudRelief},
  uShadow:{value:p.cloudShadow},uWater:{value:p.waterStrength},
  uDayFloor:{value:p.dayFloor},uDayFill:{value:p.dayFill},
  uDayDirect:{value:p.dayDirect},uOceanTint:{value:p.oceanTint},
  uShininess:{value:p.waterShininess},uNightGain:{value:p.nightGain},
  uAtmosphereGain:{value:p.atmosphereGain},uCloudRotation:{value:0},uCloudEnabled:{value:1},uPureNight:{value:0}
 };
}

export function createEarthLook(T,textures,options={}){
 if(!textures.terrainNormal)throw new Error('Earth normal trial requires caller-owned terrainNormal');
 const p={...PLANET_PARAMS,...options},group=new T.Group(),u=uniforms(T,textures,p);
 const surface=new T.ShaderMaterial({uniforms:u,vertexShader:vertex,fragmentShader:common+`
 uniform sampler2D uDay,uNight,uCloud,uMask,uTerrainNormal;
 uniform mat3 uTerrainUv;
 uniform float uTerrainStrength;
 uniform float uShadow,uWater,uShininess,uNightGain,uCloudRotation;
 uniform float uDayFloor,uDayFill,uDayDirect,uOceanTint,uCloudEnabled,uPureNight;
 void main(){
  vec3 N=normalize(vNormal),L=normalize(uSun),V=normalize(cameraPosition-vWorld);
  float d=dot(N,L),day=smoothstep(-0.18,0.28,d)*(1.0-uPureNight);
  vec3 albedo=decodeColor(texture2D(uDay,coord(uDayUv,vUv)).rgb);
  float water=texture2D(uMask,coord(uMaskUv,vUv)).r;
  // 地形法线只影响陆地受光，昼夜位置、云影与海面反光使用原球面法线。
  vec3 localNormal=texture2D(uTerrainNormal,coord(uTerrainUv,vUv)).xyz*2.0-1.0;
  float land=1.0-smoothstep(0.10,0.90,water);
  float poleFade=smoothstep(0.025,0.15,sin(vUv.y*3.14159265));
  localNormal.xy*=uTerrainStrength*land*poleFade;
  localNormal=normalize(vec3(localNormal.xy,max(0.08,localNormal.z)));
  vec3 T=normalize(vTangent-N*dot(N,vTangent)),B=normalize(cross(N,T));
  vec3 terrainN=normalize(T*localNormal.x+B*localNormal.y+N*localNormal.z);
  // 云球自转时，地表影子用相同角偏移；与大气统一世界太阳方向。
  vec2 cloudUV=vUv+vec2(uCloudRotation,0.0);
  vec2 towardSun=vec2(dot(L,normalize(vTangent))/max(0.18,sin(vUv.y*3.14159))/6.28318,
                         dot(L,normalize(vBitangent))/3.14159)*0.008/max(0.16,d);
  float shadow=cloudDensity(uCloud,cloudUV+towardSun)*uShadow*uCloudEnabled*smoothstep(0.0,0.35,d);
  // 保留原图的海蓝与陆地辨识度；艺术化补光主要在日侧与晨昏带。
  albedo=mix(albedo,mix(albedo,vec3(0.016,0.065,0.14),uOceanTint),water);
  float diffuse=uDayFloor+day*(uDayFill+uDayDirect*sqrt(max(dot(terrainN,L),0.0)));
  vec3 c=albedo*diffuse*(1.0-shadow)*(1.0-uPureNight);
  c+=vec3(0.0004,0.0013,0.0038)*(1.0-day);
  vec3 night=texture2D(uNight,coord(uNightUv,vUv)).rgb;
  // 去除夜图中的暗色地形底，让局部城市灯光保留暖色。
  float lit=smoothstep(0.13,0.36,max(night.r,max(night.g,night.b)));
  c+=decodeColor(night)*vec3(1.18,0.86,0.54)*lit*uNightGain*mix(1.0-smoothstep(-0.15,0.12,d),1.0,uPureNight)
     *(1.0-0.72*uCloudEnabled*cloudDensity(uCloud,cloudUV));
  vec3 H=normalize(L+V);
  float glint=pow(max(0.0,dot(N,H)),uShininess);
  float wide=pow(max(0.0,dot(N,H)),9.0)*0.16;
  float fresnel=0.24+0.76*pow(max(0.0,1.0-dot(N,V)),5.0);
  c+=vec3(1.0,0.95,0.87)*(glint+wide)*uWater*water*(0.7+fresnel)*day*(1.0-shadow);
  float rim=pow(max(0.0,1.0-dot(N,V)),3.3)*smoothstep(-0.28,0.48,d);
  c+=vec3(0.013,0.085,0.25)*rim;
  gl_FragColor=vec4(c,1.0);
 `+output+`}`});
 const earth=options.earthMesh || new T.Mesh(new T.SphereGeometry(1,64,64),surface);
 earth.material=surface;surface.map=textures.day;earth.renderOrder=10;if(!options.earthMesh)group.add(earth);
 const cloudMat=new T.ShaderMaterial({uniforms:u,vertexShader:vertex,transparent:true,depthWrite:false,
  blending:T.NormalBlending,fragmentShader:common+`
 uniform sampler2D uCloud;
 uniform float uCloudOpacity,uRelief;
 void main(){
  float density=cloudDensity(uCloud,vUv);
  float alpha=pow(smoothstep(0.075,0.87,density),0.84)*uCloudOpacity;
  vec3 N=normalize(vNormal),L=normalize(uSun),V=normalize(cameraPosition-vWorld);
  vec3 reliefN=cloudNormal(uCloud,vUv,uRelief);
  float daylight=smoothstep(-0.13,0.22,dot(N,L));
  float shade=max(0.0,dot(reliefN,L));
  float thickness=mix(0.70,1.0,smoothstep(0.15,0.85,density));
  vec3 c=vec3(0.88,0.93,1.0)*(0.04+daylight*(0.48+0.75*shade))*thickness;
  // 低太阳角度下的云顶暖边，保持暗侧云体积而不发白。
  c+=vec3(0.21,0.13,0.055)*daylight*pow(max(0.0,dot(L,-V)),4.0)*(1.0-density)*0.35;
  gl_FragColor=vec4(c,alpha);
 `+output+`}`});
 const clouds=options.cloudMesh || new T.Mesh(new T.SphereGeometry(p.cloudRadius,64,64),cloudMat);
 clouds.material=cloudMat;clouds.renderOrder=20;
 if(options.cloudMesh)clouds.scale.setScalar(p.cloudRadius/1.012);else group.add(clouds);
 const atmosphereMat=new T.ShaderMaterial({uniforms:u,vertexShader:vertex,transparent:true,
  side:T.BackSide,depthWrite:false,blending:T.AdditiveBlending,fragmentShader:common+`
 uniform float uAtmosphereGain;
 void main(){
  vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld),L=normalize(uSun);
  // 球壳投影仅露出轮廓；内边亮、外边归零，不画均匀粗圈。
  float angle=abs(dot(N,V));
  float limb=pow(smoothstep(0.0,0.27,angle),1.6);
  float daylight=smoothstep(-0.24,0.55,dot(N,L));
  vec3 c=mix(vec3(0.008,0.015,0.04),vec3(0.025,0.28,0.85),daylight);
  gl_FragColor=vec4(c,limb*uAtmosphereGain*(0.05+0.95*daylight));
 `+output+`}`});
 const atmosphere=new T.Mesh(new T.SphereGeometry(p.atmosphereRadius,64,64),atmosphereMat);atmosphere.renderOrder=30;group.add(atmosphere);
 let disposed=false;
 return {group,earth,clouds,atmosphere,params:p,material:surface,
  setTheme(kind){u.uPureNight.value=kind==='night'?1:0;},
  setBrightness(value){u.uBrightness.value=value;},
  sync(sun,cloudRotation=0){if(disposed)return;u.uSun.value.copy(sun).normalize();clouds.rotation.y=cloudRotation;
   u.uCloudRotation.value=-cloudRotation/(2*Math.PI);u.uCloudEnabled.value=clouds.visible?1:0;
   atmosphere.visible=earth.visible;
   for(const [key,tex] of [['uDayUv',textures.day],['uNightUv',textures.night],['uCloudUv',textures.cloud],['uMaskUv',textures.mask],['uTerrainUv',textures.terrainNormal]]){
    if(tex.matrixAutoUpdate)tex.updateMatrix();u[key].value.copy(tex.matrix);
   }
  },
  dispose(){if(disposed)return;disposed=true;if(group.parent)group.parent.remove(group);
   if(!options.earthMesh)earth.geometry.dispose();
   if(!options.cloudMesh)clouds.geometry.dispose();
   atmosphere.geometry.dispose();
   [earth,clouds,atmosphere].forEach(m=>m.material.dispose());}
 };
}
