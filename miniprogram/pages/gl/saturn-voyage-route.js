// Art-directed camera rail in Saturn's equatorial coordinates (planet radius = 1).
// A fixed low Sun lets the existing planet-shadow shaders darken the ring.
export const SATURN_VOYAGE_DURATION = 132;
export const SATURN_VOYAGE_SUN = [-.80, .10, .59];

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const stamps = [0, 36, 92, 116, SATURN_VOYAGE_DURATION];
const stages = ['靠近星环', '沿冰环航行', '进入土星阴影', '阴影中回望'];

export function sampleSaturnVoyage(seconds) {
  const time = Math.max(0, Math.min(SATURN_VOYAGE_DURATION, seconds));
  // Smooth arrival, then steady azimuth travel. Both speed and orientation
  // remain continuous across the illuminated/shadow stage boundary.
  const approach = smooth(time / 36);
  const travel = smooth((time - 30) / 96);
  const angle = mix(.08, 2.22, travel);
  const radius = mix(11.8, 2.22, approach);
  const height = mix(3.5, .046, approach);
  const ice = smooth((time - 16) / 20);
  const position = [Math.sin(angle) * radius, height, Math.cos(angle) * radius];
  // Look across the ring toward Saturn, with a little forward lead.
  const lead = .12 * approach;
  const focus = [Math.sin(angle + lead) * .38 * ice, -.10 * ice, Math.cos(angle + lead) * .38 * ice];
  let stage = 0;
  while (stage < 3 && time >= stamps[stage + 1]) stage++;
  return { position, focus, ice, fov: mix(38, 64, ice), stage: stages[stage], complete: time >= SATURN_VOYAGE_DURATION };
}

export function saturnVoyageTime(seconds) {
  const time = Math.floor(Math.max(0, Math.min(SATURN_VOYAGE_DURATION, seconds)));
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}
