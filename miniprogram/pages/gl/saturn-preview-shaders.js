/*
MIT License

Copyright (c) 2019 Ian Webster

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Adapted from Spacekit's sphere/ring shaders (MIT, Ian Webster, 2019).
// License and original source: source-models/saturn-preview/.
// Local equatorial coordinates keep shadows fixed while the texture rotates.
export const SATURN_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vLocalPosition;
  uniform vec3 lightDirection;
  varying vec3 vLight;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vLight = normalize((viewMatrix * modelMatrix * vec4(lightDirection / vec3(1.0, 0.902, 1.0), 0.0)).xyz);
    vLocalPosition = vec3(position.x, position.y * 0.902, position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SATURN_FRAGMENT = `
  uniform sampler2D sphereTexture;
  uniform sampler2D ringTexture;
  uniform vec3 lightDirection;
  uniform float spin;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vLocalPosition;
  varying vec3 vLight;
  void main() {
    vec3 n = normalize(vNormal);
    float diffuse = max(dot(n, normalize(vLight)), 0.0);
    vec3 base = pow(texture2D(sphereTexture, vec2(fract(vUv.x + spin), vUv.y)).rgb, vec3(2.2));
    // Ray to the equatorial plane: ring opacity controls the shadow on Saturn.
    float transmission = 1.0;
    if (abs(lightDirection.y) > 0.001) {
      float t = -vLocalPosition.y / lightDirection.y;
      if (t > 0.0) {
        vec3 hit = vLocalPosition + lightDirection * t;
        float u = (length(hit.xz) - 1.24) / (2.32 - 1.24);
        if (u >= 0.0 && u <= 1.0) transmission = 1.0 - texture2D(ringTexture, vec2(u, 0.5)).a * 0.88;
      }
    }
    vec3 lit = base * (vec3(0.024, 0.028, 0.035) + diffuse * transmission * vec3(1.48, 1.39, 1.22));
    // Thin, sun-facing atmospheric limb, without a uniform luminous outline.
    float rim = pow(1.0 - abs(n.z), 4.0) * smoothstep(-0.2, 0.5, dot(n, normalize(vLight)));
    lit += vec3(0.15, 0.12, 0.075) * rim * 0.22;
    gl_FragColor = vec4(pow(vec3(1.0) - exp(-lit * 1.22), vec3(1.0 / 2.2)), 1.0);
  }
`;

export const RING_VERTEX = `
  varying vec3 vPos;
  void main() {
    vPos = vec3(position.x, 0.0, -position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const RING_FRAGMENT = `
  uniform sampler2D ringTexture;
  uniform vec3 lightDirection;
  varying vec3 vPos;
  vec4 color() {
    float u = (length(vPos.xz) - 1.24) / (2.32 - 1.24);
    if (u < 0.0 || u > 1.0) discard;
    return texture2D(ringTexture, vec2(u, 0.5));
  }
  float shadow() {
    // Spacekit's ray/sphere occlusion, extended for Saturn's flattened shape.
    vec3 p = vPos / vec3(1.0, 0.902, 1.0);
    vec3 l = normalize(lightDirection / vec3(1.0, 0.902, 1.0));
    float along = dot(p, l);
    float distanceToAxis = sqrt(max(0.0, dot(p, p) - along * along));
    return along < 0.0 ? mix(0.025, 1.0, smoothstep(0.98, 1.025, distanceToAxis)) : 1.0;
  }
  void main() {
    float illumination = 0.48 + abs(lightDirection.y) * 0.65;
    // Sample after shadow calculation (Spacekit Windows driver workaround).
    float shade = illumination * shadow();
    vec4 pixel = color();
    if (pixel.a < 0.025) discard;
    vec3 lit = pow(pixel.rgb, vec3(2.2)) * shade * vec3(1.25, 1.18, 1.04);
    gl_FragColor = vec4(pow(vec3(1.0) - exp(-lit * 1.22), vec3(1.0 / 2.2)), pixel.a);
  }
`;
