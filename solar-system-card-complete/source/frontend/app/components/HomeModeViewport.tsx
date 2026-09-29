"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";
import type { ConversationLabViewProps } from "@/app/components/ConversationLabView";
import { FeatureHub } from "@/app/components/FeatureHub";
import { ExecutiveTool } from "@/lib/types";
import { StartupFeatureId } from "@/lib/startup_preload";

function ViewportLoadingShell({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full border border-[var(--site-border)] bg-[var(--site-panel)] px-5 py-3 text-sm text-[var(--site-text-soft)] shadow-[0_12px_36px_rgba(35,23,28,0.08)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--site-accent-strong)] border-t-transparent" />
        <span>{label}</span>
      </div>
    </div>
  );
}

const AssessmentToolsPanel = dynamic(
  () => import("@/app/components/AssessmentToolsPanel").then((module) => ({ default: module.AssessmentToolsPanel })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载测评中心..." /> }
);

const ConversationLabView = dynamic<ConversationLabViewProps>(
  () => import("@/app/components/ConversationLabView").then((module) => module.ConversationLabView),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载对话实验室..." /> }
);

const WordLookupWorkbench = dynamic(
  () => import("@/app/components/WordLookupWorkbench").then((module) => ({ default: module.WordLookupWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载简易查词..." /> }
);

const OcrWorkbench = dynamic(
  () => import("@/app/components/OcrWorkbench").then((module) => ({ default: module.OcrWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载 OCR 工作台..." /> }
);

const WinLinezWorkbench = dynamic(
  () => import("@/app/components/WinLinezWorkbench").then((module) => ({ default: module.WinLinezWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载 WINLINEZ..." /> }
);

const SolarSystemWorkbench = dynamic(
  () => import("@/app/components/SolarSystemWorkbench").then((module) => ({ default: module.SolarSystemWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载太阳系漫游..." /> }
);

const PikachuVolleyballWorkbench = dynamic(
  () =>
    import("@/app/components/PikachuVolleyballWorkbench").then((module) => ({
      default: module.PikachuVolleyballWorkbench,
    })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载皮卡丘排球..." /> }
);

const SuikaWorkbench = dynamic(
  () => import("@/app/components/SuikaWorkbench").then((module) => ({ default: module.SuikaWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载合成大西瓜..." /> }
);

const NsShaftWorkbench = dynamic(
  () => import("@/app/components/NsShaftWorkbench").then((module) => ({ default: module.NsShaftWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载是男人下100层..." /> }
);

const CodeBreakerWorkbench = dynamic(
  () => import("@/app/components/CodeBreakerWorkbench").then((module) => ({ default: module.CodeBreakerWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载猜码大师..." /> }
);

const SkillHubWorkbench = dynamic(
  () => import("@/app/components/SkillHubWorkbench").then((module) => ({ default: module.SkillHubWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载 Skill Hub..." /> }
);

const MiddleSchoolExamWorkbench = dynamic(
  () => import("@/app/components/MiddleSchoolExamWorkbench").then((module) => ({ default: module.MiddleSchoolExamWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载中学考试..." /> }
);

const WorldClockWorkbench = dynamic(
  () => import("@/app/components/WorldClockWorkbench").then((module) => ({ default: module.WorldClockWorkbench })),
  { ssr: false, loading: () => <ViewportLoadingShell label="正在加载世界时钟..." /> }
);

export type HomeViewportMode =
  | "home"
  | "conversation"
  | "ocr"
  | "dictionary"
  | "assessmentHub"
  | "solarSystem"
  | "winlinez"
  | "pikachuVolleyball"
  | "suika"
  | "nsShaft"
  | "codeBreaker"
  | "skillHub"
  | "middleSchoolExam"
  | "worldClock";

type HomeModeViewportProps = {
  appMode: HomeViewportMode;
  exitToHome: () => void;
  startAssessmentSession: (tool: ExecutiveTool) => void;
  onOpenSuperMap: () => void;
  onOpenDictionary: () => void;
  onOpenAssessments: () => void;
  onOpenConversationLab: () => void;
  onOpenOcr: () => void;
  onOpenSolarSystem: () => void;
  onOpenWinLinez: () => void;
  onOpenPikachuVolleyball: () => void;
  onOpenSuika: () => void;
  onOpenNsShaft: () => void;
  onOpenCodeBreaker: () => void;
  onOpenSkillHub: () => void;
  onOpenMiddleSchoolExam: () => void;
  onOpenWorldClock: () => void;
  onFeatureIntent?: (featureId: StartupFeatureId) => void;
  conversationLabProps: ConversationLabViewProps;
};

function AssessmentHub({
  exitToHome,
  startAssessmentSession,
}: Pick<HomeModeViewportProps, "exitToHome" | "startAssessmentSession">) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-10 pt-6 md:px-6 md:pt-8">
      <div className="relative overflow-hidden rounded-[36px] border border-[#2f2320] bg-[#1f1716] px-7 py-8 text-[#fff7f0] shadow-[0_24px_48px_rgba(22,12,12,0.18)] md:px-9 md:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(217,161,94,0.28),transparent_32%),radial-gradient(circle_at_78%_26%,rgba(116,184,172,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_42%,rgba(255,255,255,0.02)_100%)]" />
        <div className="relative">
          <button
            type="button"
            onClick={exitToHome}
            aria-label="关闭并返回首页"
            className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition hover:bg-white/16"
          >
            ×
          </button>
          <div className="text-[11px] font-semibold tracking-[0.24em] text-[#d8b796]">ASSESSMENTS</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white md:text-[56px]">性格测评</h1>
          <p className="mt-4 max-w-[36rem] text-[15px] leading-8 text-[#ddc9bb]">
            从认知偏好、协作方式到行为风格，集中查看三种不同方向的自我测评。
          </p>
        </div>
      </div>

      <div className="mt-6">
        <AssessmentToolsPanel onToolSelect={startAssessmentSession} />
      </div>
    </main>
  );
}

function HomeHub({
  onOpenSuperMap,
  onOpenDictionary,
  onOpenAssessments,
  onOpenConversationLab,
  onOpenOcr,
  onOpenSolarSystem,
  onOpenWinLinez,
  onOpenPikachuVolleyball,
  onOpenSuika,
  onOpenNsShaft,
  onOpenCodeBreaker,
  onOpenSkillHub,
  onOpenMiddleSchoolExam,
  onOpenWorldClock,
  onFeatureIntent,
}: Omit<HomeModeViewportProps, "appMode" | "exitToHome" | "startAssessmentSession" | "conversationLabProps">) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-12 pt-10 md:px-6 md:pt-10">
      <FeatureHub
        onOpenSuperMap={onOpenSuperMap}
        onOpenDictionary={onOpenDictionary}
        onOpenAssessments={onOpenAssessments}
        onOpenConversationLab={onOpenConversationLab}
        onOpenOcr={onOpenOcr}
        onOpenSolarSystem={onOpenSolarSystem}
        onOpenWinLinez={onOpenWinLinez}
        onOpenPikachuVolleyball={onOpenPikachuVolleyball}
        onOpenSuika={onOpenSuika}
        onOpenNsShaft={onOpenNsShaft}
        onOpenCodeBreaker={onOpenCodeBreaker}
        onOpenSkillHub={onOpenSkillHub}
        onOpenMiddleSchoolExam={onOpenMiddleSchoolExam}
        onOpenWorldClock={onOpenWorldClock}
        onFeatureIntent={onFeatureIntent}
      />

      <button
        onClick={onOpenConversationLab}
        className="site-hover-chip fixed bottom-5 left-1/2 z-[70] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--site-border)] bg-[var(--site-panel)] px-5 py-3 text-sm font-medium text-[var(--site-text)] shadow-[0_12px_40px_rgba(45,23,35,0.12)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--site-border-strong)] hover:bg-white"
      >
        <MessageCircle className="h-4 w-4" />
        打开对话实验室
      </button>
    </main>
  );
}

export function HomeModeViewport({
  appMode,
  exitToHome,
  startAssessmentSession,
  onOpenSuperMap,
  onOpenDictionary,
  onOpenAssessments,
  onOpenConversationLab,
  onOpenOcr,
  onOpenSolarSystem,
  onOpenWinLinez,
  onOpenPikachuVolleyball,
  onOpenSuika,
  onOpenNsShaft,
  onOpenCodeBreaker,
  onOpenSkillHub,
  onOpenMiddleSchoolExam,
  onOpenWorldClock,
  onFeatureIntent,
  conversationLabProps,
}: HomeModeViewportProps) {
  const [hasWorldClockScrollRunway, setHasWorldClockScrollRunway] = React.useState(false);

  React.useEffect(() => {
    if (appMode !== "nsShaft" && appMode !== "worldClock") {
      setHasWorldClockScrollRunway(false);
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const userAgent = window.navigator.userAgent;
    const isIPad =
      /\biPad\b/i.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isSafari =
      /\bSafari\b/i.test(userAgent) && !/\b(CriOS|FxiOS|EdgiOS|OPiOS)\b/i.test(userAgent);
    const allowWorldClockScroll = appMode === "worldClock" && isIPad && isSafari;

    setHasWorldClockScrollRunway(allowWorldClockScroll);
    document.body.style.overflow = allowWorldClockScroll ? "auto" : "hidden";
    document.documentElement.style.overflow = allowWorldClockScroll ? "auto" : "hidden";
    if (allowWorldClockScroll) window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [appMode]);

  switch (appMode) {
    case "worldClock":
      return (
        <div
          className={
            hasWorldClockScrollRunway
              ? "relative z-[75] h-[calc(100svh+96px)] w-full bg-[#0a0a0a]"
              : "fixed inset-0 z-[75] overflow-hidden"
          }
        >
          <div className={hasWorldClockScrollRunway ? "fixed inset-0 overflow-hidden" : "h-full"}>
            <WorldClockWorkbench onClose={exitToHome} />
          </div>
        </div>
      );
    case "dictionary":
      return (
        <main className="mx-auto flex w-full max-w-[1480px] flex-col px-4 pb-8 pt-6 md:px-6 md:pt-8">
          <WordLookupWorkbench onClose={exitToHome} />
        </main>
      );
    case "winlinez":
      return (
        <main className="mx-auto flex w-full max-w-[1480px] flex-col px-3 pb-6 pt-4 md:px-5 md:pt-6">
          <WinLinezWorkbench onClose={exitToHome} />
        </main>
      );
    case "solarSystem":
      return (
        <main className="mx-auto flex h-[100svh] min-h-[100svh] w-full max-w-[1780px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3 md:px-4 md:pb-4 md:pt-4">
          <div className="min-h-0 flex-1">
            <SolarSystemWorkbench onClose={exitToHome} />
          </div>
        </main>
      );
    case "pikachuVolleyball":
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-[1780px] flex-col px-3 pb-4 pt-3 md:px-4 md:pt-4">
          <PikachuVolleyballWorkbench onClose={exitToHome} />
        </main>
      );
    case "suika":
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-[1780px] flex-col px-3 pb-4 pt-3 md:px-4 md:pt-4">
          <SuikaWorkbench onClose={exitToHome} />
        </main>
      );
    case "nsShaft":
      return (
        <div className="fixed inset-0 z-[75] overflow-hidden bg-[linear-gradient(180deg,var(--site-bg)_0%,var(--site-bg-soft)_100%)]">
          <main className="mx-auto flex h-full w-full max-w-[1780px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 sm:pb-4 sm:pt-3 md:px-4 md:pt-4">
            <div className="min-h-0 flex-1">
              <NsShaftWorkbench onClose={exitToHome} />
            </div>
          </main>
        </div>
      );
    case "codeBreaker":
      return (
        <main className="mx-auto flex h-[100svh] min-h-[100svh] w-full max-w-[1780px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3 md:px-4 md:pb-4 md:pt-4">
          <CodeBreakerWorkbench onClose={exitToHome} />
        </main>
      );
    case "skillHub":
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col px-3 pb-6 pt-4 md:px-5 md:pt-5">
          <SkillHubWorkbench onClose={exitToHome} />
        </main>
      );
    case "middleSchoolExam":
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-[1780px] flex-col px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3 md:px-4 md:pb-4 md:pt-4">
          <MiddleSchoolExamWorkbench onClose={exitToHome} />
        </main>
      );
    case "assessmentHub":
      return <AssessmentHub exitToHome={exitToHome} startAssessmentSession={startAssessmentSession} />;
    case "ocr":
      return (
        <main className="mx-auto flex w-full max-w-[1480px] flex-col px-4 pb-8 pt-6 md:px-6 md:pt-8">
          <OcrWorkbench onClose={exitToHome} />
        </main>
      );
    case "conversation":
      return <ConversationLabView {...conversationLabProps} />;
    case "home":
    default:
      return (
        <HomeHub
          onOpenSuperMap={onOpenSuperMap}
          onOpenDictionary={onOpenDictionary}
          onOpenAssessments={onOpenAssessments}
          onOpenConversationLab={onOpenConversationLab}
          onOpenOcr={onOpenOcr}
          onOpenSolarSystem={onOpenSolarSystem}
          onOpenWinLinez={onOpenWinLinez}
          onOpenPikachuVolleyball={onOpenPikachuVolleyball}
          onOpenSuika={onOpenSuika}
          onOpenNsShaft={onOpenNsShaft}
          onOpenCodeBreaker={onOpenCodeBreaker}
          onOpenSkillHub={onOpenSkillHub}
          onOpenMiddleSchoolExam={onOpenMiddleSchoolExam}
          onOpenWorldClock={onOpenWorldClock}
          onFeatureIntent={onFeatureIntent}
        />
      );
  }
}

