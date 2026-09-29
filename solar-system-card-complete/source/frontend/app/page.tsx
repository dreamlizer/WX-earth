"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { generateUUID } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { useHistory } from "@/hooks/useHistory";
import { useConversationWorkspaceActions, useConversationWorkspaceState } from "@/hooks/useConversationWorkspace";
import { usePageBootstrap } from "@/hooks/usePageBootstrap";
import { useConversationMergeOnLogin, useConversationUrlSync, useScrollToMessage } from "@/hooks/useConversationEffects";
import { useAssessmentEntry } from "@/hooks/useAssessmentEntry";
import { useHomePresentation } from "@/hooks/useHomePresentation";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { recommendedQuestions } from "@/lib/recommended_questions";
import { FloatingSurfaceControls } from "@/app/components/FloatingSurfaceControls";
import { StartupWarmFrame } from "@/app/components/StartupWarmFrame";
import { HomeModeViewport, type HomeViewportMode } from "@/app/components/HomeModeViewport";
import {
  WARM_FRAME_REQUEST_EVENT,
  getIdleWarmFrameFeature,
  startStartupHeavyPreload,
  type StartupFeatureId,
  warmFeatureOnIntent,
} from "@/lib/startup_preload";
import { getFeatureDomainHomeUrl, resolveFeatureDomain } from "@/lib/feature_domains";

const AuthModal = dynamic(() => import("@/app/components/AuthModal").then((module) => ({ default: module.AuthModal })), {
  ssr: false,
});

const MBTIAssessment = dynamic(
  () => import("@/app/components/MBTIAssessment").then((module) => ({ default: module.MBTIAssessment })),
  { ssr: false }
);

const FourDAssessment = dynamic(
  () => import("@/app/components/FourDAssessment").then((module) => ({ default: module.FourDAssessment })),
  { ssr: false }
);

const PDPAssessment = dynamic(
  () => import("@/app/components/PDPAssessment").then((module) => ({ default: module.PDPAssessment })),
  { ssr: false }
);

const SuperMapModal = dynamic(
  () => import("@/app/components/SuperMapModal").then((module) => ({ default: module.SuperMapModal })),
  { ssr: false }
);

const DEFAULT_SLOGAN: [string, string] = ["真正的清晰来自于减法，", "而不是堆砌。"];

const TOOLBOX_SLOGANS: [string, string][] = [
  ["工具不只是器物，", "也是思维的延伸。"],
  ["把复杂的问题拆小，", "比一味叠加更有用。"],
  ["先看清问题的结构，", "再决定用哪一个工具。"],
];

const ASSESSMENT_SLOGANS: [string, string][] = [
  ["向内探索的深度，", "会决定你向外行动的边界。"],
  ["真正的洞察力，", "往往从看见自己的习惯开始。"],
  ["所谓性格优势，", "常常就是你在压力下最自然的出牌方式。"],
  ["在读懂别人之前，", "先试着读懂自己。"],
  ["没有完美的性格，", "只有更适合当下处境的使用方式。"],
];

function splitSloganContent(content: string): [string, string] {
  const commaIndex = content.indexOf("，");
  return commaIndex !== -1 ? [content.substring(0, commaIndex + 1), content.substring(commaIndex + 1)] : [content, ""];
}

export default function Page() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const isSuperAdmin = user?.email === "14589960@qq.com";

  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [appMode, setAppMode] = useState<HomeViewportMode>("home");
  const [isInitializing, setIsInitializing] = useState(true);
  const [assessmentPanelOpen, setAssessmentPanelOpen] = useState(false);
  const [activeAssessmentTool, setActiveAssessmentTool] = useState<string | null>(null);
  const [superMapOpen, setSuperMapOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalHint, setAuthModalHint] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [featureTransition, setFeatureTransition] = useState<string | null>(null);
  const [warmFrameFeature, setWarmFrameFeature] = useState<StartupFeatureId | null>(null);
  const [superMapReadyCount, setSuperMapReadyCount] = useState(0);

  const endRef = useRef<HTMLDivElement | null>(null);
  const assessmentLimit = 3;
  const assessmentWhitelist = new Set(
    (process.env.NEXT_PUBLIC_ASSESSMENT_WHITELIST || "14589960@qq.com")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

  const { history, historyLoading, fetchHistory } = useHistory();
  const workspaceState = useConversationWorkspaceState();
  const {
    sidebarOpen,
    setSidebarOpen,
    currentConversationId,
    setCurrentConversationId,
    toolsPanelOpen,
    setToolsPanelOpen,
    searchOpen,
    setSearchOpen,
    activeToolId,
    activeToolPlaceholder,
    targetMessageId,
    setTargetMessageId,
    toolTransition,
  } = workspaceState;

  const {
    messages,
    setMessages,
    input,
    setInput,
    attachments,
    handleFilesSelected,
    removeAttachment,
    sendMessage,
    modelMode,
    setModelMode,
    loadConversation,
    stopGeneration,
  } = useChat(
    currentConversationId,
    activeToolId,
    workspaceState.pendingToolTitle,
    () => fetchHistory(true),
    (reason) => {
      if (reason === "daily_limit") {
        setToastMessage("已超出今日对话限制（100 条）。");
      } else {
        setAuthModalHint("注册后可以保存更多内容，并继续使用对话实验室。");
        setShowAuthModal(true);
      }
    }
  );

  const homePresentation = useHomePresentation({
    userName: user?.name,
    activeToolId,
    toolsPanelOpen,
    assessmentPanelOpen,
    toolboxSlogans: TOOLBOX_SLOGANS,
    assessmentSlogans: ASSESSMENT_SLOGANS,
    defaultSlogan: DEFAULT_SLOGAN,
    splitSloganContent,
  });

  const {
    showMagicZone,
    setShowMagicZone,
    randomQuestions,
    setRandomQuestions,
    greeting,
    sloganLines,
    setSloganLines,
    initializeGreeting,
  } = homePresentation;

  const workspaceActions = useConversationWorkspaceActions({
    user,
    history,
    setMessages,
    loadConversation,
    setSloganLines,
    setAppMode,
    setAuthModalHint,
    setShowAuthModal,
    setAssessmentPanelOpen,
    setActiveAssessmentTool,
    setSearchOpen: workspaceState.setSearchOpen,
    setToolsPanelOpen: workspaceState.setToolsPanelOpen,
    setSidebarOpen: workspaceState.setSidebarOpen,
    currentConversationId,
    setCurrentConversationId,
    activeToolId,
    setActiveToolId: workspaceState.setActiveToolId,
    setActiveToolPlaceholder: workspaceState.setActiveToolPlaceholder,
    setPendingToolTitle: workspaceState.setPendingToolTitle,
    setTargetMessageId: workspaceState.setTargetMessageId,
    setToolTransition: workspaceState.setToolTransition,
    transitionTimerRef: workspaceState.transitionTimerRef,
    defaultSlogan: DEFAULT_SLOGAN,
  });

  const assessmentEntry = useAssessmentEntry({
    user,
    assessmentLimit,
    assessmentWhitelist,
    setAuthModalHint,
    setShowAuthModal,
    setToastMessage,
    setActiveAssessmentTool,
    setToolsPanelOpen,
    setAssessmentPanelOpen,
    startToolSession: workspaceActions.startToolSession,
  });

  const { startAssessmentSession, handleAssessmentClose } = assessmentEntry;

  usePageBootstrap({
    loadConversation,
    setCurrentConversationId,
    setAppMode,
    setSidebarOpen,
    setIsInitializing,
    setRandomQuestions,
    initializeGreeting,
    recommendedQuestions,
  });

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    startStartupHeavyPreload();
    setWarmFrameFeature(getIdleWarmFrameFeature());
  }, []);

  useEffect(() => {
    const handleWarmFrameRequest = (event: Event) => {
      const featureId = (event as CustomEvent<{ featureId?: StartupFeatureId }>).detail?.featureId || null;
      if (!featureId) return;
      setWarmFrameFeature((current) => current || featureId);
    };

    window.addEventListener(WARM_FRAME_REQUEST_EVENT, handleWarmFrameRequest);
    return () => window.removeEventListener(WARM_FRAME_REQUEST_EVENT, handleWarmFrameRequest);
  }, []);

  useEffect(() => {
    if (!superMapOpen || superMapReadyCount === 0) return;

    const timers = [
      window.setTimeout(() => {
        warmFeatureOnIntent("solarSystem");
        setWarmFrameFeature((current) => current || "solarSystem");
      }, 1800),
      window.setTimeout(() => {
        warmFeatureOnIntent("pikachuVolleyball");
      }, 5200),
      window.setTimeout(() => {
        warmFeatureOnIntent("suika");
      }, 8600),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [superMapOpen, superMapReadyCount]);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      if (
        event.message === "ResizeObserver loop limit exceeded" ||
        event.message === "ResizeObserver loop completed with undelivered notifications."
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  useConversationUrlSync({
    currentConversationId,
    history,
    historyLoading,
  });

  useConversationMergeOnLogin({
    user,
    currentConversationId,
    messages,
    fetchHistory,
  });

  useScrollToMessage({
    targetMessageId,
    setTargetMessageId,
    messages,
    endRef,
  });

  const resetFeatureModeState = useCallback(() => {
    setSearchOpen(false);
    setToolsPanelOpen(false);
    setAssessmentPanelOpen(false);
    setActiveAssessmentTool(null);
  }, [setSearchOpen, setToolsPanelOpen]);

  const runFeatureTransition = (label: string, action: () => void) => {
    setFeatureTransition(label);
    window.setTimeout(() => {
      action();
      window.setTimeout(() => setFeatureTransition(null), 220);
    }, 140);
  };

  const enterAppMode = (
    nextMode: Exclude<HomeViewportMode, "conversation">,
    label: string,
    options?: { skipTransition?: boolean }
  ) => {
    resetFeatureModeState();
    if (options?.skipTransition) {
      setAppMode(nextMode);
      return;
    }
    runFeatureTransition(label, () => {
      setAppMode(nextMode);
    });
  };

  const exitToHome = () => {
    const featureDomainHomeUrl = getFeatureDomainHomeUrl(window.location);
    if (featureDomainHomeUrl) {
      window.location.assign(featureDomainHomeUrl);
      return;
    }

    resetFeatureModeState();
    setAppMode("home");
    workspaceActions.clearConversationWorkspace();
    workspaceState.setCurrentConversationId(generateUUID());
    if (greeting) {
      setSloganLines(splitSloganContent(greeting.content));
    } else {
      setSloganLines(DEFAULT_SLOGAN);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("c")) return;

    const target = resolveFeatureDomain(window.location.hostname);
    if (!target) return;

    resetFeatureModeState();
    if (target.kind === "modal" && target.modal === "superMap") {
      setSuperMapOpen(true);
      return;
    }

    if (target.kind === "appMode") {
      setAppMode(target.mode);
    }
  }, [resetFeatureModeState]);

  const handleSuperMapClose = () => {
    const featureDomainHomeUrl = getFeatureDomainHomeUrl(window.location);
    if (featureDomainHomeUrl) {
      window.location.assign(featureDomainHomeUrl);
      return;
    }

    setSuperMapOpen(false);
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    if (input.trim() === "/magiczone") {
      event.preventDefault();
      const nextState = !showMagicZone;
      setShowMagicZone(nextState);
      localStorage.setItem("showMagicZone", String(nextState));
      setToastMessage(nextState ? "已开启魔法区" : "已隐藏魔法区");
      setInput("");
      return;
    }
    await sendMessage(event);
  };

  const handleOpenOcrWorkbench = () => {
    enterAppMode("ocr", "OCR 工作台");
  };

  const handleOpenDictionary = () => {
    enterAppMode("dictionary", "简易查词");
  };

  const handleOpenAssessmentsHub = () => {
    enterAppMode("assessmentHub", "性格测评");
  };

  const handleOpenSolarSystem = () => {
    enterAppMode("solarSystem", "太阳系漫游");
  };

  const handleOpenWinLinez = () => {
    enterAppMode("winlinez", "WINLINEZ");
  };

  const handleOpenPikachuVolleyball = () => {
    enterAppMode("pikachuVolleyball", "Pikachu Volleyball");
  };

  const handleOpenSkillHub = () => {
    enterAppMode("skillHub", "Skill 学习仓库", { skipTransition: true });
  };

  const handleOpenSuika = () => {
    enterAppMode("suika", "合成大西瓜");
  };

  const handleOpenNsShaft = () => {
    enterAppMode("nsShaft", "是男人下100层");
  };

  const handleOpenCodeBreaker = () => {
    enterAppMode("codeBreaker", "猜码大师");
  };

  const handleOpenMiddleSchoolExam = () => {
    enterAppMode("middleSchoolExam", "中学考试");
  };

  const handleOpenWorldClock = () => {
    enterAppMode("worldClock", "世界时钟", { skipTransition: true });
  };

  const handleFeatureIntent = (featureId: StartupFeatureId) => {
    warmFeatureOnIntent(featureId);
    if (featureId === "solarSystem") {
      setWarmFrameFeature((current) => current || featureId);
    }
  };

  const chatLoading = messages.some(
    (message) => message.role === "ai" && (message.status === "analyzing" || message.kind === "thinking")
  );

  const conversationLabProps = {
    sidebarOpen,
    setSidebarOpen,
    history,
    historyLoading,
    handleHistoryClick: workspaceActions.handleHistoryClick,
    handleNewChat: workspaceActions.handleNewChat,
    setToolsPanelOpen,
    setAssessmentPanelOpen,
    setActiveAssessmentTool,
    setSloganLines,
    setSuperMapOpen,
    startToolSession: workspaceActions.startToolSession,
    currentConversationId,
    setSearchOpen,
    toolsPanelOpen,
    assessmentPanelOpen,
    activeToolId,
    isSuperAdmin,
    showDebugInfo,
    setShowDebugInfo,
    exitToHome,
    searchOpen,
    handleSearchResultClick: workspaceActions.handleSearchResultClick,
    sloganLines,
    isInitializing,
    messages,
    greeting,
    input,
    setInput,
    handleSendMessage,
    handleFilesSelected,
    attachments,
    removeAttachment,
    chatLoading,
    stopGeneration,
    activeToolPlaceholder,
    modelMode,
    setModelMode,
    randomQuestions,
    endRef,
    t,
    showMagicZone,
    startAssessmentSession,
  };

  return (
    <div className="min-h-screen text-[var(--site-text)]">
      <FloatingSurfaceControls showUserMenu={appMode === "home"} />

      <HomeModeViewport
        appMode={appMode}
        exitToHome={exitToHome}
        startAssessmentSession={startAssessmentSession}
        onOpenSuperMap={() => {
          resetFeatureModeState();
          runFeatureTransition("超级地图", () => {
            setSuperMapOpen(true);
          });
        }}
        onOpenDictionary={handleOpenDictionary}
        onOpenAssessments={handleOpenAssessmentsHub}
        onOpenConversationLab={workspaceActions.handleOpenConversationLab}
        onOpenOcr={handleOpenOcrWorkbench}
        onOpenSolarSystem={handleOpenSolarSystem}
        onOpenWinLinez={handleOpenWinLinez}
        onOpenPikachuVolleyball={handleOpenPikachuVolleyball}
        onOpenSuika={handleOpenSuika}
        onOpenNsShaft={handleOpenNsShaft}
        onOpenCodeBreaker={handleOpenCodeBreaker}
        onOpenSkillHub={handleOpenSkillHub}
        onOpenMiddleSchoolExam={handleOpenMiddleSchoolExam}
        onOpenWorldClock={handleOpenWorldClock}
        onFeatureIntent={handleFeatureIntent}
        conversationLabProps={conversationLabProps}
      />

      <StartupWarmFrame featureId={warmFrameFeature} />

      {activeAssessmentTool === "mbti" ? <MBTIAssessment onClose={handleAssessmentClose} /> : null}
      {activeAssessmentTool === "4d-leadership" ? <FourDAssessment onClose={handleAssessmentClose} /> : null}
      {activeAssessmentTool === "pdp" ? <PDPAssessment onClose={handleAssessmentClose} /> : null}

      {superMapOpen ? (
        <SuperMapModal
          isOpen={superMapOpen}
          onClose={handleSuperMapClose}
          userId={user?.id}
          onReady={() => setSuperMapReadyCount((count) => count + 1)}
        />
      ) : null}

      {showAuthModal ? (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setAuthModalHint(undefined);
          }}
          floatingHint={authModalHint}
        />
      ) : null}

      {toastMessage ? (
        <div className="fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-full border border-[var(--site-border)] bg-[var(--site-text)] px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur">
          {toastMessage}
        </div>
      ) : null}

      {toolTransition ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-5 shadow-2xl duration-300 dark:bg-[#1E1E1E]">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#060E9F] border-t-transparent" />
            <div className="text-sm font-medium text-[#060E9F] dark:text-blue-400">正在进入</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{toolTransition.name}</div>
          </div>
        </div>
      ) : null}

      {featureTransition ? (
        <div className="fixed inset-0 z-[89] flex items-center justify-center bg-black/28 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-5 shadow-2xl">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#7f4d2a] border-t-transparent" />
            <div className="text-sm font-medium text-[#7f4d2a]">正在进入</div>
            <div className="text-xs text-gray-500">{featureTransition}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

