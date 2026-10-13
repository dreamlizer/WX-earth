/*
 * Ring reflection/transmission adapted from I,Voyager rings.gdshader.
 * Copyright 2019-2026 Charlie Whitfield. Licensed under Apache License 2.0.
 * https://www.apache.org/licenses/LICENSE-2.0
 * Modified: GLSL ES 1.0 atlas, homogeneous slab, four radial filter samples,
 * flattened planet shadows and artistic exposure. Full license/original in
 * source-models/saturn-preview/ivoyager/. Not the full Godot renderer.
 * Ring data: Bjoern Jonsson, https://bjj.mmedia.is/data/s_rings/.
 */
const DISPLAY = `
  vec3 displayColor(vec3 radiance) {
    return pow(vec3(1.0) - exp(-max(radiance, vec3(0.0)) * exposure), vec3(1.0 / 2.2));
  }
`;
export const PROFILE_SURFACE_FRAGMENT = `
  uniform sampler2D sphereTexture;
  uniform sampler2D profileTexture;
  uniform vec3 lightDirection, localCamera, sunlight;
  uniform float spin, elapsed, exposure, ambient, atmosphere;
  varying vec2 vUv;
  varying vec3 vNormal, vLocalPosition, vLight, vEye;
  ${DISPLAY}
  float shadowTransmission(float u) {
    if (u < 0.0 || u > 1.0) return 1.0;
    float tau = texture2D(profileTexture, vec2(u, .875)).a * 6.0;
    return exp(-tau / max(abs(lightDirection.y), .015));
  }
  vec3 cloudColor(vec2 uv) {
    // Very slow latitude-dependent cloud drift; diffuse map remains unlit.
    float u = fract(uv.x + spin + elapsed * .00012 * sin(uv.y * 38.0));
    vec3 color = texture2D(sphereTexture, vec2(u, uv.y)).rgb;
    // Feather the generated map's longitude seam without changing its source.
    float edge = min(u, 1.0 - u);
    vec3 opposite = texture2D(sphereTexture, vec2(1.0 - u, uv.y)).rgb;
    return mix(color, opposite, .5 * (1.0 - smoothstep(0.0, .025, edge)));
  }
  void main() {
    vec3 n = normalize(vNormal), l = normalize(vLight), eye = normalize(vEye);
    float daylight = dot(n, l);
    vec3 base = pow(cloudColor(vUv), vec3(2.2));
    float transmission = 1.0;
    float ly = abs(lightDirection.y) > .001 ? lightDirection.y : .001;
    float t = -vLocalPosition.y / ly;
    float u = (length((vLocalPosition + lightDirection * t).xz) - 1.2363) / 1.0931;
    // Derivatives run before the varying shadow branch to avoid undefined values.
    #ifdef GL_OES_standard_derivatives
      float width = max(fwidth(u), .001);
    #else
      float width = .002;
    #endif
    width = min(width, .025);
    if (t > 0.0 && abs(lightDirection.y) > .001) {
      transmission = .25 * (shadowTransmission(u - width * .375)
        + shadowTransmission(u - width * .125) + shadowTransmission(u + width * .125)
        + shadowTransmission(u + width * .375));
    }
    float limb = pow(1.0 - max(dot(n, eye), 0.0), 5.0);
    float haze = smoothstep(-.22, .35, daylight) * limb * atmosphere;
    vec3 radiance = base * (ambient * vec3(.7, .83, 1.0) + max(daylight, 0.0) * transmission * sunlight);
    radiance += sunlight * haze * .22;
    gl_FragColor = vec4(displayColor(radiance), 1.0);
  }
`;
export const ATMOSPHERE_FRAGMENT = `
  uniform vec3 sunlight;
  uniform float atmosphere, exposure;
  varying vec3 vNormal, vLight, vEye;
  ${DISPLAY}
  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vEye)), 0.0);
    float limb = pow(1.0 - facing, 4.0);
    float daylight = smoothstep(-.3, .5, dot(normalize(vNormal), normalize(vLight)));
    float coverage = limb * daylight * atmosphere * .15;
    gl_FragColor = vec4(displayColor(sunlight * .3), coverage);
  }
`;
export const PROFILE_RING_FRAGMENT = `
  uniform sampler2D profileTexture;
  uniform vec3 lightDirection, localCamera, sunlight;
  uniform float exposure, ambient, ringGain, pixelAngle, iceBlend;
  varying vec3 vPos;
  ${DISPLAY}
  vec4 profile(float u, float row, float width) {
    return (texture2D(profileTexture, vec2(clamp(u - width * .375, 0.0, 1.0), row))
      + texture2D(profileTexture, vec2(clamp(u - width * .125, 0.0, 1.0), row))
      + texture2D(profileTexture, vec2(clamp(u + width * .125, 0.0, 1.0), row))
      + texture2D(profileTexture, vec2(clamp(u + width * .375, 0.0, 1.0), row))) * .25;
  }
  float reflection(float tau, float mu, float mu0) {
    return mu0 / (mu + mu0) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
  }
  float transmission(float tau, float mu, float mu0) {
    float a = 1.0 / mu0, b = 1.0 / mu, d = b - a;
    if (abs(d) < .0001 * max(a, b)) return b * tau * exp(-a * tau);
    return max(0.0, b * (exp(-a * tau) - exp(-b * tau)) / d);
  }
  float shadow() {
    vec3 p = vPos / vec3(1.0, .902, 1.0);
    vec3 l = normalize(lightDirection / vec3(1.0, .902, 1.0));
    float along = dot(p, l);
    float axis = sqrt(max(0.0, dot(p, p) - along * along));
    return along < 0.0 ? smoothstep(.992, 1.014, axis) : 1.0;
  }
  void main() {
    vec3 ray = localCamera - vPos, eye = normalize(ray);
    float mu = max(abs(eye.y), .001), mu0 = max(abs(lightDirection.y), .001);
    float u = (length(vPos.xz) - 1.2363) / 1.0931;
    #ifdef GL_OES_standard_derivatives
      float width = max(fwidth(u), 1.0 / 4096.0);
    #else
      float width = max(pixelAngle * length(ray) / (mu * 1.0931), 1.0 / 4096.0);
    #endif
    width = min(width, .04);
    bool litFace = localCamera.y * lightDirection.y > 0.0;
    float phase = acos(clamp(dot(lightDirection, eye), -1.0, 1.0));
    float blend = clamp(phase / 2.4261, 0.0, 1.0);
    vec4 texel = litFace ? mix(profile(u, .875, width), profile(u, .625, width), blend) : profile(u, .375, width);
    float tau = texel.a * 6.0;
    float alpha = 1.0 - exp(-tau / mu);
    if (alpha < .002) discard;
    float geometry = litFace ? reflection(tau, mu, mu0) : transmission(tau, mu, mu0);
    // A softened phase curve keeps a close model review legible at high phase.
    // This exposure treatment is artistic; it is not I,Voyager's fitted curve.
    float phaseLevel = mix(1.0, .32, blend) * (1.0 + .3 * exp(-phase / .02));
    vec3 strength = texel.rgb * texel.rgb * 8.0;
    vec3 radiance = strength * (geometry * phaseLevel * shadow() * sunlight * ringGain + ambient * reflection(tau, mu, 1.0));
    // RGB is emitted light, already coverage-dependent through the slab geometry.
    // premultipliedAlpha prevents the GPU from multiplying it by alpha again.
    float nearFade = mix(1.0, smoothstep(.045, .28, length(ray)), iceBlend);
    gl_FragColor = vec4(displayColor(radiance) * nearFade, alpha * nearFade);
  }
`;
