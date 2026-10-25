// Every offscreen draw restores the shared renderer before yielding a frame.
export function withMoonRenderTarget(renderer, target, draw) {
  const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
  const face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(target.viewport.clone()),scissor=renderer.getScissor(target.scissor.clone()),scissorTest=renderer.getScissorTest();
  const shadowUpdate=renderer.shadowMap.needsUpdate;
  try {
    renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);
    return draw();
  } finally {
    renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setRenderTarget(previous,face,mip);
    renderer.autoClear=autoClear;renderer.shadowMap.needsUpdate=shadowUpdate;
  }
}

// r108 has no initTexture(). A real sampler draw uploads one image per frame.
export async function warmMoonTextures({THREE:T,renderer,textures,isCurrent,yieldFrame}) {
  const target=new T.WebGLRenderTarget(16,16,{depthBuffer:false,stencilBuffer:false});
  const material=new T.ShaderMaterial({uniforms:{image:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D image;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);}',depthTest:false,depthWrite:false});
  material.toneMapped=false;
  const scene=new T.Scene(),camera=new T.Camera(),geometry=new T.PlaneBufferGeometry(2,2),quad=new T.Mesh(geometry,material);
  quad.frustumCulled=false;scene.add(quad);
  try {
    for(const texture of new Set(textures)) {
      if(!isCurrent())throw Error('Cancelled Moon GPU warmup');
      material.uniforms.image.value=texture;
      withMoonRenderTarget(renderer,target,()=>renderer.render(scene,camera));
      await yieldFrame();
    }
    if(!isCurrent())throw Error('Cancelled Moon GPU warmup');
  } finally {geometry.dispose();material.dispose();target.dispose();}
}
