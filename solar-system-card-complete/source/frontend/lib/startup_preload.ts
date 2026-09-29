const PRELOAD_VERSION = "v5";
const PRIORITY_PRELOAD_DONE_KEY = `dream-lab-priority-preload-${PRELOAD_VERSION}`;
const FEATURE_PRELOAD_DONE_KEY = `dream-lab-feature-preload-${PRELOAD_VERSION}`;
const ECHARTS_PREWARM_SCRIPT_ID = "dream-lab-echarts-prewarm";
const DAXIGUA_CACHE_VERSION = "20260502-random-fruit-v1";

export type StartupFeatureId =
  | "superMap"
  | "dictionary"
  | "assessments"
  | "conversationLab"
  | "ocr"
  | "skillHub"
  | "winlinez"
  | "solarSystem"
  | "pikachuVolleyball"
  | "suika"
  | "nsShaft"
  | "codeBreaker"
  | "middleSchoolExam";

const PRIORITY_PRELOAD_URLS = [
  "/api/dictionary/suggest?q=pro&direction=auto",
  "/api/dictionary/lookup?q=promise&direction=auto&includeExamples=0",
  "/api/dictionary/lookup?q=move%20toward&direction=auto&includeExamples=0",
  "/api/dictionary/lookup?q=%E6%89%BF%E8%AF%BA&direction=auto&includeExamples=0",
];

const FEATURE_PRELOAD_URLS: Record<StartupFeatureId, string[]> = {
  superMap: [
    "/geo/china.100000_full.json",
    "/geo/world.geo.json",
    "/geo/world-meta.snapshot.json",
  ],
  dictionary: [
    "/api/dictionary/suggest?q=pro&direction=auto",
    "/api/dictionary/lookup?q=promise&direction=auto&includeExamples=0",
    "/api/dictionary/lookup?q=move%20toward&direction=auto&includeExamples=0",
    "/api/dictionary/lookup?q=%E6%89%BF%E8%AF%BA&direction=auto&includeExamples=0",
  ],
  assessments: [],
  conversationLab: [],
  ocr: [],
  skillHub: [],
  winlinez: [
    "/winlinez/1111.bmp",
    "/winlinez/right-king-complete.png",
  ],
  solarSystem: [
    "/solar-system/index.html",
    "/solar-system/style.css",
    "/solar-system/Engine.js",
    "/solar-system/Galaxy.js",
    "/solar-system/Controls.js",
    "/solar-system/Controller_new.js",
    "/solar-system/UI_new.js",
    "/solar-system/styles/controls.range.css",
    "/solar-system/styles/controls.tilt.css",
    "/solar-system/styles/controls.tokens.css",
    "/solar-system/8k_stars_milky_way.jpg",
    "/solar-system/tex/earth.jpg",
    "/solar-system/tex/jupiter.jpg",
    "/solar-system/tex/mars.jpg",
    "/solar-system/tex/mercury.jpg",
    "/solar-system/tex/neptune.jpg",
    "/solar-system/tex/saturn.jpg",
    "/solar-system/tex/saturn_ring.png",
    "/solar-system/tex/sun.jpg",
    "/solar-system/tex/uranus.jpg",
    "/solar-system/tex/venus_surface.jpg",
  ],
  pikachuVolleyball: [
    "/pikachu-volley-full/zh/index.html",
    "/pikachu-volley-full/zh/manifest.json",
    "/pikachu-volley-full/runtime.bundle.js",
    "/pikachu-volley-full/main.bundle.js",
    "/pikachu-volley-full/27.bundle.js",
    "/pikachu-volley-full/dark_color_scheme.bundle.js",
    "/pikachu-volley-full/is_embedded_in_other_website.bundle.js",
    "/pikachu-volley-full/resources/style.css",
    "/pikachu-volley-full/resources/assets/images/sprite_sheet.png",
    "/pikachu-volley-full/resources/assets/images/sprite_sheet.json",
    "/pikachu-volley-full/resources/assets/images/controls.png",
    "/pikachu-volley-full/resources/assets/sounds/bgm.mp3",
    "/pikachu-volley-full/resources/assets/sounds/WAVE140_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE141_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE142_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE143_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE144_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE145_1.wav",
    "/pikachu-volley-full/resources/assets/sounds/WAVE146_1.wav",
  ],
  suika: [
    `/daxigua/index.html?v=${DAXIGUA_CACHE_VERSION}`,
    `/daxigua/main.js?v=${DAXIGUA_CACHE_VERSION}`,
    `/daxigua/src/extraSettings.js?v=${DAXIGUA_CACHE_VERSION}`,
    `/daxigua/src/project.js?v=${DAXIGUA_CACHE_VERSION}`,
    "/daxigua/src/settings.js",
    "/daxigua/cocos2d-js-min.js",
    "/daxigua/style-mobile.css",
  ],
  nsShaft: [
    "/ns-shaft/movingrightalong.wav",
  ],
  codeBreaker: [],
  middleSchoolExam: [
    "/exams/middle-school/math-profile.html",
    "/exams/middle-school/physics-profile.html",
    "/exams/middle-school/question-details-math.js",
    "/exams/middle-school/question-details-physics.js",
  ],
};

const FEATURE_PRELOAD_MANIFEST_URLS: Partial<Record<StartupFeatureId, string[]>> = {
  suika: [`/daxigua/preload-manifest.json?v=${DAXIGUA_CACHE_VERSION}`],
};

const FEATURE_IFRAME_URLS: Partial<Record<StartupFeatureId, string>> = {
  solarSystem: "/solar-system/index.html?v=20260411k",
};

const CROSS_ORIGIN_ECHARTS_URL = "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js";
export const WARM_FRAME_REQUEST_EVENT = "dream-lab:warm-frame-requested";

const inflightFeaturePreloads = new Map<StartupFeatureId, Promise<void>>();
let idleWarmFrameFeature: StartupFeatureId | null = null;

const FEATURE_MODULE_WARMERS: Partial<Record<StartupFeatureId, () => Promise<unknown>>> = {
  dictionary: () => import("@/app/components/WordLookupWorkbench"),
  assessments: () =>
    Promise.all([
      import("@/app/components/AssessmentToolsPanel"),
      import("@/app/components/MBTIAssessment"),
      import("@/app/components/FourDAssessment"),
      import("@/app/components/PDPAssessment"),
    ]),
  conversationLab: () => import("@/app/components/ConversationLabView"),
  ocr: () => import("@/app/components/OcrWorkbench"),
  skillHub: () => import("@/app/components/SkillHubWorkbench"),
  winlinez: () => import("@/app/components/WinLinezWorkbench"),
  solarSystem: () => import("@/app/components/SolarSystemWorkbench"),
  pikachuVolleyball: () => import("@/app/components/PikachuVolleyballWorkbench"),
  suika: () => import("@/app/components/SuikaWorkbench"),
  nsShaft: () => import("@/app/components/NsShaftWorkbench"),
  codeBreaker: () => import("@/app/components/CodeBreakerWorkbench"),
  middleSchoolExam: () => import("@/app/components/MiddleSchoolExamWorkbench"),
};

function idle(task: () => void) {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(task, { timeout: 1800 });
  } else {
    window.setTimeout(task, 500);
  }
}

function shouldSkipHeavyPreload() {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return false;
  return !!connection.saveData;
}

function waitForPageSettled(delayMs: number) {
  return new Promise<void>((resolve) => {
    const finish = () => window.setTimeout(resolve, delayMs);
    if (document.readyState === "complete") {
      finish();
      return;
    }
    window.addEventListener("load", finish, { once: true });
  });
}

function readFeaturePreloadState() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(FEATURE_PRELOAD_DONE_KEY) || "{}") as Partial<Record<StartupFeatureId, 1>>;
  } catch {
    return {};
  }
}

function markFeaturePreloaded(featureId: StartupFeatureId) {
  if (typeof window === "undefined") return;
  const next = readFeaturePreloadState();
  next[featureId] = 1;
  window.localStorage.setItem(FEATURE_PRELOAD_DONE_KEY, JSON.stringify(next));
}

function hasFeatureBeenPreloaded(featureId: StartupFeatureId) {
  return readFeaturePreloadState()[featureId] === 1;
}

async function prefetchUrls(urls: string[], init?: RequestInit, concurrency = 3) {
  if (urls.length === 0) return true;
  const queue = [...urls];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  let allFetched = true;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (!url) return;
        try {
          const response = await fetch(url, { method: "GET", cache: "force-cache", credentials: "same-origin", ...init });
          if (!response.ok) allFetched = false;
        } catch {
          allFetched = false;
          // Best-effort preloading should never block the UI.
        }
      }
    })
  );

  return allFetched;
}

async function loadManifestUrls(manifestUrls: string[]) {
  const urls: string[] = [];
  for (const manifestUrl of manifestUrls) {
    try {
      const response = await fetch(manifestUrl, { method: "GET", cache: "force-cache", credentials: "same-origin" });
      if (!response.ok) continue;
      const manifest = (await response.json()) as { urls?: unknown };
      if (!Array.isArray(manifest.urls)) continue;
      manifest.urls.forEach((url) => {
        if (typeof url === "string" && url.startsWith("/")) urls.push(url);
      });
    } catch {
      // Manifest preloading is best-effort and should never block opening a feature.
    }
  }
  return urls;
}

function warmExternalScript(src: string, scriptId: string) {
  if (typeof document === "undefined") return;
  const current = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (current) return;

  const preloadLink = document.createElement("link");
  preloadLink.rel = "preload";
  preloadLink.as = "script";
  preloadLink.href = src;
  document.head.appendChild(preloadLink);

  const script = document.createElement("script");
  script.id = scriptId;
  script.src = src;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

export function warmFeatureOnIntent(featureId: StartupFeatureId) {
  if (typeof window === "undefined") return Promise.resolve();
  if (hasFeatureBeenPreloaded(featureId)) return Promise.resolve();
  if (shouldSkipHeavyPreload() && featureId !== "superMap") return Promise.resolve();
  const inflight = inflightFeaturePreloads.get(featureId);
  if (inflight) return inflight;

  const urls = FEATURE_PRELOAD_URLS[featureId];
  const manifestUrls = FEATURE_PRELOAD_MANIFEST_URLS[featureId] || [];
  const warmModule = FEATURE_MODULE_WARMERS[featureId];
  const task = (async () => {
    if (featureId === "superMap") {
      warmExternalScript(CROSS_ORIGIN_ECHARTS_URL, ECHARTS_PREWARM_SCRIPT_ID);
    }
    if (warmModule) {
      try {
        await warmModule();
      } catch {
        // Best-effort module warming should never block the UI.
      }
    }
    const manifestAssetUrls = await loadManifestUrls(manifestUrls);
    const allFetched = await prefetchUrls(
      [...urls, ...manifestAssetUrls],
      undefined,
      featureId === "suika" ? 1 : 2
    );
    if (allFetched) markFeaturePreloaded(featureId);
  })().finally(() => {
    inflightFeaturePreloads.delete(featureId);
  });

  inflightFeaturePreloads.set(featureId, task);
  return task;
}

export function getWarmFrameSrc(featureId: StartupFeatureId | null) {
  if (!featureId) return null;
  return FEATURE_IFRAME_URLS[featureId] || null;
}

export function getIdleWarmFrameFeature() {
  return idleWarmFrameFeature;
}

export function requestIdleWarmFrame(featureId: StartupFeatureId) {
  if (!FEATURE_IFRAME_URLS[featureId]) return;
  if (idleWarmFrameFeature) return;
  idleWarmFrameFeature = featureId;
  window.dispatchEvent(new CustomEvent(WARM_FRAME_REQUEST_EVENT, { detail: { featureId } }));
}

async function warmFeatureSequence(featureIds: StartupFeatureId[], delayMs = 650) {
  for (const featureId of featureIds) {
    await warmFeatureOnIntent(featureId);
    await waitForPageSettled(delayMs);
  }
}

export function startStartupHeavyPreload() {
  if (typeof window === "undefined") return;

  idle(() => {
    void (async () => {
      if (window.localStorage.getItem(PRIORITY_PRELOAD_DONE_KEY) !== "1") {
        await prefetchUrls(PRIORITY_PRELOAD_URLS, undefined, 2);
        window.localStorage.setItem(PRIORITY_PRELOAD_DONE_KEY, "1");
      }

      await waitForPageSettled(1400);

      warmFeatureOnIntent("superMap");
      await warmFeatureSequence(["dictionary", "conversationLab", "ocr", "skillHub", "middleSchoolExam", "assessments"], 450);

      if (shouldSkipHeavyPreload()) return;

      await warmFeatureOnIntent("suika");
      await waitForPageSettled(800);

      await warmFeatureOnIntent("winlinez");
      await waitForPageSettled(800);

      requestIdleWarmFrame("solarSystem");
      await warmFeatureOnIntent("solarSystem");
      await waitForPageSettled(800);

      await warmFeatureOnIntent("pikachuVolleyball");
      await waitForPageSettled(800);

      await warmFeatureOnIntent("nsShaft");
      await waitForPageSettled(500);

      await warmFeatureOnIntent("codeBreaker");
    })();
  });
}
