"use client";

import { useEffect, useState } from "react";

const IFRAME_TITLE = "太阳系漫游";
const READY_EVENT = "dream-lab:solar-system-ready";
const CLOSE_EVENT = "dream-lab:solar-system-close";
const PROGRESS_EVENT = "dream-lab:solar-system-progress";
const SOLAR_VERSION = "20260411k";

type SolarSystemWorkbenchProps = {
  onClose?: () => void;
};

type LoadPhase = "scene" | "textures" | "ready" | "loading";

export function SolarSystemWorkbench({ onClose }: SolarSystemWorkbenchProps) {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [fallbackReady, setFallbackReady] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("loading");

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === READY_EVENT) {
        setSceneReady(true);
        setLoadPercent(100);
        setLoadPhase("ready");
        return;
      }

      if (event.data?.type === PROGRESS_EVENT) {
        const next = Number(event.data?.percent);
        if (Number.isFinite(next)) {
          setLoadPercent((prev) => Math.max(prev, Math.max(0, Math.min(100, Math.round(next)))));
        }
        const phase = String(event.data?.phase || "");
        if (phase === "scene" || phase === "textures" || phase === "ready") {
          setLoadPhase(phase);
        } else {
          setLoadPhase("loading");
        }
        return;
      }

      if (event.data?.type === CLOSE_EVENT) {
        onClose?.();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose]);

  useEffect(() => {
    if (!frameLoaded || sceneReady) return;
    const timer = window.setTimeout(() => setFallbackReady(true), 6500);
    return () => window.clearTimeout(timer);
  }, [frameLoaded, sceneReady]);

  useEffect(() => {
    if (frameLoaded) setLoadPercent((prev) => Math.max(prev, 8));
  }, [frameLoaded]);

  const isReady = sceneReady || fallbackReady;
  const loadingLabel =
    loadPhase === "textures"
      ? "资源加载中"
      : loadPhase === "scene"
        ? "场景初始化中"
        : loadPhase === "ready"
          ? "即将就绪"
          : !frameLoaded
            ? "场景加载中"
            : "资源加载中";

  return (
    <section className="mx-auto flex h-full w-full max-w-[1720px] flex-col">
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[32px] border border-[var(--site-border)] bg-[#05060d] shadow-[0_28px_64px_rgba(20,14,24,0.18)]">
        {!isReady ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-[#3b3f54] bg-[#0f1220]/86 px-4 py-2 text-xs font-medium text-[#dbe8ff] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {`${loadingLabel} ${Math.min(100, Math.max(1, loadPercent))}%`}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 bg-[#04060d]">
          <iframe
            src={`/solar-system/index.html?v=${SOLAR_VERSION}${onClose ? "&closable=1" : ""}`}
            title={IFRAME_TITLE}
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => setFrameLoaded(true)}
          />
        </div>
      </div>
    </section>
  );
}
