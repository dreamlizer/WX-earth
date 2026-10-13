// Shared labels and uniform settings; all looks keep the same camera and meshes.
export const SATURN_LOOKS = {
  original: { label: '原版', caption: '原版材质 · 用作比较', light: [-3.8, 2.6, 5], exposure: 1.22, sun: [1.48, 1.39, 1.22], ambient: .025, atmosphere: 0, ringGain: 1 },
  natural: { label: '观测', caption: '云涡纹理 · 冰环近景探索', light: [-3.8, 3.2, 6], exposure: 1.25, sun: [1.35, 1.31, 1.23], ambient: .012, atmosphere: .22, ringGain: .45 },
  cinema: { label: '电影', caption: '侧光 · 深阴影与暖色云带', light: [-6, 1.4, 2.8], exposure: 1.45, sun: [1.65, 1.43, 1.12], ambient: .006, atmosphere: .45, ringGain: .7 },
  eclipse: { label: '逆光', caption: '逆光 · 薄环发亮，厚环沉入暗面', light: [-3, -3.5, -5.5], exposure: 1.8, sun: [1.65, 1.48, 1.27], ambient: .003, atmosphere: .8, ringGain: 2.5 }
};
export const DEFAULT_SATURN_LOOK = 'natural';
