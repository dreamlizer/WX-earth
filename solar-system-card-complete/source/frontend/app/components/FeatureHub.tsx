"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { GlowingCardEffect } from "@/app/components/GlowingCardEffect";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  Clock,
  FileText,
  Gamepad2,
  GraduationCap,
  Library,
  Map as MapIcon,
  MessageCircle,
  Orbit,
  Pencil,
  Pin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { StartupFeatureId } from "@/lib/startup_preload";

const STORAGE_KEY = "dream_lab_feature_order_v1";
const RECENT_STORAGE_KEY = "dream_lab_feature_recent_v1";
const MAX_PINNED_CARDS = 3;

type FeatureCategory = "explore" | "tool" | "conversation" | "assessment" | "resource" | "game";
type FeatureSortBucket = "game" | "tool" | "other";
type FeatureSortMode = "default" | "recent" | "category-game" | "category-tool" | "category-other";

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  explore: "探索",
  tool: "工具",
  conversation: "对话",
  assessment: "测评",
  resource: "资源",
  game: "游戏",
};

const CATEGORY_BUCKET_MAP: Record<FeatureCategory, FeatureSortBucket> = {
  game: "game",
  tool: "tool",
  explore: "other",
  conversation: "other",
  assessment: "other",
  resource: "other",
};

const SORT_MODE_LABELS: Record<FeatureSortMode, string> = {
  default: "默认排序",
  recent: "最近使用",
  "category-game": "分类排序-游戏",
  "category-tool": "分类排序-工具",
  "category-other": "分类排序-其他",
};

const normalizeFeatureOrder = (candidate: unknown, allIds: string[]): string[] | null => {
  if (!Array.isArray(candidate)) return null;
  const allIdSet = new Set(allIds);
  const deduped = candidate.filter((id): id is string => typeof id === "string" && allIdSet.has(id));
  const missing = allIds.filter((id) => !deduped.includes(id));
  const merged = [...deduped, ...missing];
  if (merged.length !== allIds.length) return null;
  return merged;
};

const normalizeRecentIds = (candidate: unknown, allIds: string[]): string[] => {
  if (!Array.isArray(candidate)) return [];
  const seen = new Set<string>();
  return candidate.filter((id): id is string => {
    if (typeof id !== "string") return false;
    if (!allIds.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

function loadRecentIdsFromStorage(allIds: string[]): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    return normalizeRecentIds(JSON.parse(raw), allIds);
  } catch {
    return [];
  }
}

type FeatureHubProps = {
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
};

type FeatureCardItem = {
  id: string;
  title: string;
  description: string;
  accent: string;
  icon: ReactNode;
  onClick: () => void;
  category: FeatureCategory;
  searchTokens: string[];
  compactTitle?: boolean;
  titleClassName?: string;
  preloadFeatureId?: StartupFeatureId;
};

type FeatureCardProps = FeatureCardItem & {
  isEditing: boolean;
  isDragging?: boolean;
  isPinned: boolean;
  titleOnly?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onIntent?: () => void;
  onPinToggle: () => void;
};

function FeatureCard({
  title,
  description,
  accent,
  icon,
  onClick,
  compactTitle = false,
  titleClassName,
  isEditing,
  isDragging = false,
  isPinned,
  titleOnly = false,
  dragHandleProps,
  onIntent,
  onPinToggle,
}: FeatureCardProps) {
  const intentTimerRef = useRef<number | null>(null);

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current === null) return;
    window.clearTimeout(intentTimerRef.current);
    intentTimerRef.current = null;
  }, []);

  const scheduleIntent = useCallback(() => {
    if (!onIntent || intentTimerRef.current !== null) return;
    intentTimerRef.current = window.setTimeout(() => {
      intentTimerRef.current = null;
      onIntent();
    }, 900);
  }, [onIntent]);

  const triggerIntentNow = useCallback(() => {
    clearIntentTimer();
    onIntent?.();
  }, [clearIntentTimer, onIntent]);

  useEffect(() => clearIntentTimer, [clearIntentTimer]);

  return (
    <article
      onClick={() => {
        if (!isEditing) onClick();
      }}
      onKeyDown={(event) => {
        if (isEditing) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => {
        if (!isEditing) scheduleIntent();
      }}
      onMouseLeave={clearIntentTimer}
      onBlur={clearIntentTimer}
      onPointerCancel={clearIntentTimer}
      onPointerDown={clearIntentTimer}
      onPointerUp={clearIntentTimer}
      onPointerLeave={clearIntentTimer}
      onTouchStart={() => {
        if (!isEditing) triggerIntentNow();
      }}
      onFocus={() => {
        if (!isEditing) scheduleIntent();
      }}
      role="button"
      tabIndex={isEditing ? -1 : 0}
      aria-label={isEditing ? `${title}（拖拽排序）` : title}
      className={`site-hover-card group relative flex ${titleOnly ? "h-[214px]" : "h-[274px]"} flex-col overflow-hidden rounded-[28px] border border-[var(--site-border)] bg-[var(--site-panel-strong)] text-left shadow-[0_12px_30px_rgba(35,23,28,0.05)] ${
        isEditing ? "cursor-grab touch-none select-none" : "hover:border-[var(--site-border-strong)]"
      } ${isDragging ? "z-20 shadow-[0_26px_52px_rgba(35,23,28,0.22)]" : ""}`}
      {...dragHandleProps}
    >
      <GlowingCardEffect
        accent={accent}
        borderWidth={2}
        disabled={isEditing || isDragging}
        glow={!isEditing && !isDragging}
        inactiveZone={0.02}
        proximity={92}
        spread={42}
      />
      <div
        className="absolute inset-x-0 top-0 h-[5px]"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 86%)` }}
      />
      <div
        className="pointer-events-none absolute -right-8 top-0 h-44 w-44 opacity-75 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.48) 24%, transparent 56%)" }}
      />

      <div className={`relative flex h-full flex-col p-6 ${isEditing && !isDragging ? "card-editing-wiggle-inner" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2">
            <h3
              className={`mt-1 font-semibold leading-[0.96] text-[var(--site-text)] whitespace-pre-line ${
                compactTitle ? "text-[30px] tracking-[-0.05em] md:text-[34px]" : "text-[36px] tracking-[-0.04em] md:text-[40px]"
              } ${titleClassName ?? ""}`}
            >
              {title}
            </h3>
          </div>

          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[var(--site-border)] text-[var(--site-text)] shadow-[0_10px_24px_rgba(35,23,28,0.07)]"
            style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, ${accent} 180%)` }}
          >
            {icon}
          </div>
        </div>

        {titleOnly ? null : (
          <div
            className="mt-5 min-h-[5.2em] max-w-[24ch] overflow-hidden text-[15px] leading-[1.72] text-[var(--site-text-soft)]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-7">
          <button
            type="button"
            aria-label={isPinned ? "取消置顶" : "置顶卡片"}
            onClick={(event) => {
              event.stopPropagation();
              onPinToggle();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            className={`site-hover-chip inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition ${
              isPinned
                ? "border-[var(--site-accent-strong)] bg-[rgba(184,95,131,0.18)] text-[var(--site-accent-strong)] shadow-[0_10px_20px_rgba(184,95,131,0.14)]"
                : "border-[var(--site-border)] bg-white/78 text-[var(--site-text-soft)] hover:text-[var(--site-text)]"
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            <span>置顶</span>
          </button>

          <div
            className={`site-hover-chip site-hover-chip-inverse flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold shadow-[0_12px_24px_rgba(35,23,28,0.14)] ${
              isEditing ? "bg-white/85 text-[var(--site-text)]" : "bg-[var(--site-text)] text-white group-hover:translate-x-0.5"
            }`}
          >
            <span>{isEditing ? "拖拽排序" : "进入模块"}</span>
            <ArrowRight className={`h-4 w-4 transition-transform duration-300 ${isEditing ? "" : "group-hover:translate-x-1"}`} />
          </div>
        </div>
      </div>
    </article>
  );
}

function SortableFeatureCard({
  card,
  isEditing,
  isPinned,
  titleOnly,
  onIntent,
  onPinToggle,
}: {
  card: FeatureCardItem;
  isEditing: boolean;
  isPinned: boolean;
  titleOnly?: boolean;
  onIntent?: () => void;
  onPinToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        zIndex: isDragging ? 40 : 1,
        opacity: isDragging ? 0 : 1,
      }}
    >
      <FeatureCard
        {...card}
        isEditing={isEditing}
        isDragging={isDragging}
        isPinned={isPinned}
        titleOnly={titleOnly}
        dragHandleProps={isEditing ? { ...attributes, ...listeners } : undefined}
        onIntent={onIntent}
        onPinToggle={onPinToggle}
      />
    </div>
  );
}

export function FeatureHub({
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
}: FeatureHubProps) {
  const { user } = useAuth();
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const syncedUserIdRef = useRef<number | null>(null);
  const syncedOrderSignatureRef = useRef<string | null>(null);

  const cards: FeatureCardItem[] = useMemo(
    () => [
      {
        id: "world-clock",
        title: "世界时钟",
        description: "大字显示此刻时间，也能快速扫一眼东京、巴黎、伦敦和美洲时区。",
        accent: "rgba(212, 61, 53, 0.28)",
        icon: <Clock className="h-5 w-5" />,
        onClick: onOpenWorldClock,
        compactTitle: true,
        category: "tool",
        searchTokens: [
          "时间",
          "时钟",
          "世界时间",
          "全球时间",
          "常亮",
          "clock",
          "time",
          "world clock",
          "timezone",
          "ipad",
        ],
      },
      {
        id: "skill-hub",
        title: "Skill 仓库",
        description: "按来源汇总实用技能，先看简介和拆解，再决定是否下载与吸收。",
        accent: "rgba(122, 179, 155, 0.28)",
        icon: <Library className="h-5 w-5" />,
        onClick: onOpenSkillHub,
        compactTitle: true,
        preloadFeatureId: "skillHub",
        category: "resource",
        searchTokens: [
          "skill",
          "skills",
          "技能",
          "资源",
          "仓库",
          "下载",
          "工具库",
          "提示词",
          "prompt",
          "workflow",
          "插件",
          "plugin",
          "资料",
        ],
      },
      {
        id: "middle-school-exam",
        title: "中学考试",
        description: "把中考真题、城区模拟题和试卷画像集中到一个入口，先从数学和物理开始。",
        accent: "rgba(188, 141, 39, 0.28)",
        icon: <GraduationCap className="h-5 w-5" />,
        onClick: onOpenMiddleSchoolExam,
        compactTitle: true,
        preloadFeatureId: "middleSchoolExam",
        category: "resource",
        searchTokens: [
          "中学",
          "考试",
          "中考",
          "模拟考试",
          "试卷",
          "真题",
          "画像",
          "数学",
          "物理",
          "北京中考",
          "exam",
          "middle school",
          "test",
          "math",
          "physics",
        ],
      },
      {
        id: "super-map",
        title: "超级地图",
        description: "按地区快速点选业务版图，做汇报时一眼看清覆盖范围。",
        accent: "rgba(111, 139, 224, 0.28)",
        icon: <MapIcon className="h-5 w-5" />,
        onClick: onOpenSuperMap,
        preloadFeatureId: "superMap",
        category: "explore",
        searchTokens: [
          "地图",
          "区域",
          "地理",
          "map",
          "maps",
          "geo",
          "geography",
          "china",
          "world",
          "province",
          "country",
          "国家",
          "省份",
          "世界",
        ],
      },
      {
        id: "word-lookup",
        title: "简易查词",
        description: "查单词、词组和短句，阅读写作时能快速确认用法。",
        accent: "rgba(108, 142, 196, 0.28)",
        icon: <BookOpen className="h-5 w-5" />,
        onClick: onOpenDictionary,
        compactTitle: true,
        preloadFeatureId: "dictionary",
        category: "tool",
        searchTokens: [
          "词典",
          "字典",
          "查词",
          "单词",
          "英文",
          "英语",
          "英文单词",
          "翻译",
          "释义",
          "dictionary",
          "lookup",
          "english",
          "word",
          "words",
          "vocabulary",
          "translation",
          "translate",
          "japanese",
          "japan",
          "日文",
          "日语",
        ],
      },
      {
        id: "personality-assessments",
        title: "性格测评",
        description: "MBTI、DISC、PDP 集中查看，快速了解风格差异与协作偏好。",
        accent: "rgba(236, 176, 118, 0.28)",
        icon: <BrainCircuit className="h-5 w-5" />,
        onClick: onOpenAssessments,
        compactTitle: true,
        preloadFeatureId: "assessments",
        category: "assessment",
        searchTokens: [
          "测评",
          "性格",
          "人格",
          "测试",
          "MBTI",
          "DISC",
          "PDP",
          "assessment",
          "personality",
          "test",
          "profile",
        ],
      },
      {
        id: "ocr-studio",
        title: "OCR 工作台",
        description: "图片文字一键提取，可继续整理、润色并导出结果。",
        accent: "rgba(177, 152, 221, 0.28)",
        icon: <FileText className="h-5 w-5" />,
        onClick: onOpenOcr,
        compactTitle: true,
        preloadFeatureId: "ocr",
        category: "tool",
        searchTokens: [
          "ocr",
          "识别",
          "图片",
          "文字",
          "提取",
          "扫描",
          "scan",
          "scanner",
          "text",
          "image",
          "pdf",
          "截图",
        ],
      },
      {
        id: "solar-system",
        title: "太阳系漫游",
        description: "沉浸式浏览行星轨道与运行状态，适合展示和科普探索。",
        accent: "rgba(117, 155, 237, 0.28)",
        icon: <Orbit className="h-5 w-5" />,
        onClick: onOpenSolarSystem,
        compactTitle: true,
        preloadFeatureId: "solarSystem",
        category: "explore",
        searchTokens: [
          "太阳系",
          "行星",
          "轨道",
          "宇宙",
          "solar",
          "system",
          "planet",
          "planets",
          "space",
          "nasa",
          "astronomy",
          "天文",
          "太空",
        ],
      },
      {
        id: "conversation-lab",
        title: "对话实验室",
        description: "适合连续追问和长期任务，上下文与历史记录都能接着用。",
        accent: "rgba(157, 183, 162, 0.28)",
        icon: <MessageCircle className="h-5 w-5" />,
        onClick: onOpenConversationLab,
        compactTitle: true,
        preloadFeatureId: "conversationLab",
        category: "conversation",
        searchTokens: [
          "聊天",
          "对话",
          "实验室",
          "chat",
          "conversation",
          "assistant",
          "ai",
          "机器人",
          "问答",
          "长对话",
        ],
      },
      {
        id: "winlinez",
        title: "WINLINEZ",
        description: "经典连线消除玩法，支持分数、成就和历史记录查看。",
        accent: "rgba(228, 84, 69, 0.24)",
        icon: <Gamepad2 className="h-5 w-5" />,
        onClick: onOpenWinLinez,
        compactTitle: true,
        preloadFeatureId: "winlinez",
        category: "game",
        searchTokens: [
          "连线",
          "消除",
          "winlinez",
          "游戏",
          "game",
          "arcade",
          "retro",
          "怀旧",
          "球球",
          "lines",
        ],
      },
      {
        id: "code-breaker",
        title: "猜码大师",
        description: "电脑藏好暗码，你用颜色组合一步步推理，靠黑白反馈破译答案。",
        accent: "rgba(227, 191, 114, 0.3)",
        icon: <Gamepad2 className="h-5 w-5" />,
        onClick: onOpenCodeBreaker,
        compactTitle: true,
        preloadFeatureId: "codeBreaker",
        category: "game",
        searchTokens: [
          "猜码",
          "破译",
          "暗码",
          "推理",
          "mastermind",
          "code breaker",
          "codebreaker",
          "logic",
          "puzzle",
          "game",
          "游戏",
          "脑力",
          "颜色",
        ],
      },
      {
        id: "pikachu-volleyball",
        title: "皮卡丘排球",
        description: "经典双人排球复刻，保留原版手感、菜单和声音效果。",
        accent: "rgba(249, 200, 78, 0.3)",
        icon: <Gamepad2 className="h-5 w-5" />,
        onClick: onOpenPikachuVolleyball,
        compactTitle: true,
        preloadFeatureId: "pikachuVolleyball",
        category: "game",
        searchTokens: [
          "皮卡丘",
          "排球",
          "pikachu",
          "volleyball",
          "pokemon",
          "beach volleyball",
          "game",
          "游戏",
          "日本",
          "日系",
          "怀旧",
          "双人",
          "arcade",
        ],
      },
      {
        id: "suika",
        title: "合成大西瓜",
        description: "水果下落后相同可合成，节奏轻快，适合随手来一局。",
        accent: "rgba(243, 141, 84, 0.3)",
        icon: <Gamepad2 className="h-5 w-5" />,
        onClick: onOpenSuika,
        compactTitle: true,
        preloadFeatureId: "suika",
        category: "game",
        searchTokens: [
          "西瓜",
          "合成",
          "水果",
          "suika",
          "watermelon",
          "merge",
          "fruit",
          "game",
          "游戏",
          "日本",
          "日系",
          "休闲",
        ],
      },
      {
        id: "ns-shaft",
        title: "是男人下100层",
        description: "控制小人一路往下跳，躲开尖刺和危险地板，看看你能撑到第几层。",
        accent: "rgba(111, 201, 236, 0.28)",
        icon: <Gamepad2 className="h-5 w-5" />,
        onClick: onOpenNsShaft,
        compactTitle: true,
        titleClassName: "whitespace-nowrap text-[29px] tracking-[-0.09em] md:text-[33px]",
        preloadFeatureId: "nsShaft",
        category: "game",
        searchTokens: [
          "男人",
          "100层",
          "ns shaft",
          "nsshaft",
          "下100层",
          "跳跃",
          "game",
          "游戏",
          "日本",
          "日系",
          "怀旧",
          "arcade",
          "tower",
          "platform",
        ],
      },
    ],
    [
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
    ]
  );

  const allIds = useMemo(() => cards.map((card) => card.id), [cards]);

  const defaultOrder = useMemo(
    () => [
      "world-clock",
      "super-map",
      "middle-school-exam",
      "pikachu-volleyball",
      "code-breaker",
      "solar-system",
      "ns-shaft",
      "word-lookup",
      "personality-assessments",
      "suika",
      "winlinez",
      "ocr-studio",
      "skill-hub",
      "conversation-lab",
    ],
    []
  );

  const [cardOrder, setCardOrder] = useState<string[]>(defaultOrder);
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIdsFromStorage(allIds));
  const [isEditing, setIsEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localOrderReady, setLocalOrderReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<FeatureSortMode>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const persistKnownOrder = useCallback(
    (nextOrder: string[], shouldSyncRemote: boolean) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder));
      }
      if (user?.id) {
        syncedUserIdRef.current = user.id;
        syncedOrderSignatureRef.current = JSON.stringify(nextOrder);
        if (shouldSyncRemote) {
          apiClient.auth.saveFeatureOrder(nextOrder).catch(() => {
            // Keep local layout even when remote sync fails.
          });
        }
      }
    },
    [user?.id]
  );

  useLayoutEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalizeFeatureOrder(parsed, allIds);
        if (normalized) setCardOrder(normalized);
      } catch {
        // Keep default order when local cache is invalid.
      }
    }
    setRecentIds((prev) => normalizeRecentIds(prev, allIds).length > 0 ? normalizeRecentIds(prev, allIds) : loadRecentIdsFromStorage(allIds));
    setLocalOrderReady(true);
  }, [allIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentIds));
  }, [recentIds]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [sortMenuOpen]);

  useEffect(() => {
    if (isEditing || !user?.id || !localOrderReady) return;
    const localSignature = JSON.stringify(cardOrder);
    if (syncedUserIdRef.current === user.id && syncedOrderSignatureRef.current === localSignature) {
      return;
    }
    let cancelled = false;

    const syncFeatureOrder = async () => {
      try {
        const payload = await apiClient.auth.getFeatureOrder();
        const cloudOrder = normalizeFeatureOrder(payload?.order, allIds);
        if (cloudOrder) {
          if (!cancelled) {
            setCardOrder(cloudOrder);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudOrder));
            syncedUserIdRef.current = user.id;
            syncedOrderSignatureRef.current = JSON.stringify(cloudOrder);
          }
          return;
        }

        const localRaw = window.localStorage.getItem(STORAGE_KEY);
        if (!localRaw) return;
        const localOrder = normalizeFeatureOrder(JSON.parse(localRaw), allIds);
        if (!localOrder) return;
        await apiClient.auth.saveFeatureOrder(localOrder);
        syncedUserIdRef.current = user.id;
        syncedOrderSignatureRef.current = JSON.stringify(localOrder);
      } catch {
        // Keep local experience even when cloud sync fails.
      }
    };

    void syncFeatureOrder();

    return () => {
      cancelled = true;
    };
  }, [allIds, cardOrder, isEditing, localOrderReady, user?.id]);

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const manualIndexMap = useMemo(() => new Map(cardOrder.map((id, index) => [id, index])), [cardOrder]);
  const pinnedIds = useMemo(() => cardOrder.slice(0, Math.min(MAX_PINNED_CARDS, cardOrder.length)), [cardOrder]);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const orderedCards = useMemo(() => {
    const byOrder = cardOrder.map((id) => cardMap.get(id)).filter((card): card is FeatureCardItem => Boolean(card));
    const missing = cards.filter((card) => !cardOrder.includes(card.id));
    return [...byOrder, ...missing];
  }, [cardMap, cardOrder, cards]);

  const activeCard = activeId ? cardMap.get(activeId) || null : null;

  const handleCardLaunch = useCallback((cardId: string, open: () => void) => {
    setRecentIds((prev) => [cardId, ...prev.filter((id) => id !== cardId)].slice(0, allIds.length));
    open();
  }, [allIds.length]);

  const recentIndexMap = useMemo(
    () => new Map(recentIds.map((id, index) => [id, index])),
    [recentIds]
  );
  const isCategoryPrioritySort = sortMode.startsWith("category-");

  const query = searchQuery.trim().toLowerCase();

  const filteredCards = useMemo(() => {
    if (!query) return orderedCards;
    return orderedCards.filter((card) => {
      const searchable = [card.title, card.description, CATEGORY_LABELS[card.category], ...card.searchTokens].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [orderedCards, query]);

  const visiblePinnedCards = useMemo(
    () => filteredCards.filter((card) => pinnedSet.has(card.id)),
    [filteredCards, pinnedSet]
  );

  const visibleRegularCards = useMemo(() => {
    const regular = filteredCards.filter((card) => !pinnedSet.has(card.id));
    if (sortMode === "default") return regular;
    return [...regular].sort((a, b) => {
      if (sortMode === "recent") {
        const recentA = recentIndexMap.get(a.id) ?? Number.POSITIVE_INFINITY;
        const recentB = recentIndexMap.get(b.id) ?? Number.POSITIVE_INFINITY;
        if (recentA !== recentB) return recentA - recentB;
      }
      if (sortMode.startsWith("category-")) {
        const preferredBucket = sortMode.replace("category-", "") as FeatureSortBucket;
        const bucketOrder =
          preferredBucket === "game"
            ? ["game", "tool", "other"]
            : preferredBucket === "tool"
              ? ["tool", "game", "other"]
              : ["other", "tool", "game"];
        const bucketA = bucketOrder.indexOf(CATEGORY_BUCKET_MAP[a.category]);
        const bucketB = bucketOrder.indexOf(CATEGORY_BUCKET_MAP[b.category]);
        if (bucketA !== bucketB) return bucketA - bucketB;
      }
      return (manualIndexMap.get(a.id) ?? 0) - (manualIndexMap.get(b.id) ?? 0);
    });
  }, [filteredCards, manualIndexMap, pinnedSet, recentIndexMap, sortMode]);

  const sortableItems = useMemo(
    () => [...visiblePinnedCards, ...visibleRegularCards].map((card) => card.id),
    [visiblePinnedCards, visibleRegularCards]
  );

  const totalVisibleCount = visiblePinnedCards.length + visibleRegularCards.length;
  const hasPinnedDivider = visiblePinnedCards.length > 0 && visibleRegularCards.length > 0;

  const handlePinToggle = useCallback(
    (cardId: string) => {
      const currentIndex = cardOrder.indexOf(cardId);
      if (currentIndex < 0) return;

      const nextOrder =
        currentIndex < MAX_PINNED_CARDS
          ? arrayMove(cardOrder, currentIndex, 0)
          : arrayMove(cardOrder, currentIndex, 0);

      setCardOrder(nextOrder);
      persistKnownOrder(nextOrder, true);
    },
    [cardOrder, persistKnownOrder]
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!isEditing) return;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!isEditing || !over || active.id === over.id) return;

    const oldIndex = cardOrder.indexOf(String(active.id));
    const newIndex = cardOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(cardOrder, oldIndex, newIndex);
    setCardOrder(nextOrder);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      persistKnownOrder(cardOrder, true);
      setIsEditing(false);
      setActiveId(null);
      return;
    }

    setSearchQuery("");
    setSortMode("default");
    setSortMenuOpen(false);
    setIsEditing(true);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <div
        className="relative z-20 overflow-visible rounded-[32px] border border-[var(--site-border)] px-6 py-5 shadow-[0_16px_36px_rgba(35,23,28,0.05)] md:px-8 md:py-6"
        style={{ background: "var(--site-hero)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[38rem]">
            <div className="text-[11px] font-semibold tracking-[0.24em] text-[var(--site-accent-strong)]">DREAM LAB</div>
            <h1 className="mt-3 text-[36px] font-semibold tracking-[-0.07em] text-[var(--site-text)] md:text-[52px]">梦想实验站</h1>
          </div>

          <div className="w-full max-w-[22rem] lg:max-w-[560px] lg:self-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:items-end lg:justify-end">
              <label className="flex h-12 w-full items-center gap-3 rounded-full border border-[var(--site-border)] bg-white/78 px-4 text-[var(--site-text-soft)] shadow-[0_10px_24px_rgba(35,23,28,0.06)] backdrop-blur sm:h-11 sm:flex-1">
                <Search className="h-4 w-4 shrink-0 text-[var(--site-text-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  disabled={isEditing}
                  placeholder={isEditing ? "编辑模式下显示全部卡片" : "搜索模块、游戏、工具..."}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--site-text)] outline-none placeholder:text-[var(--site-text-soft)] disabled:cursor-not-allowed disabled:text-[var(--site-text-soft)]"
                />
              </label>

              <div className="flex items-center gap-2 sm:shrink-0">
                <div ref={sortMenuRef} className="relative z-[80]">
                  <button
                    type="button"
                    disabled={isEditing}
                    onClick={() => setSortMenuOpen((prev) => !prev)}
                    className="site-hover-chip inline-flex h-10 items-center gap-2 rounded-full border border-[var(--site-border)] bg-white/82 px-4 text-sm font-semibold text-[var(--site-text)] shadow-[0_10px_24px_rgba(35,23,28,0.06)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-11"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>{SORT_MODE_LABELS[sortMode]}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${sortMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {sortMenuOpen ? (
                    <div className="absolute right-0 top-full z-[120] mt-2 w-[220px] overflow-hidden rounded-[22px] border border-[var(--site-border)] bg-[rgba(255,252,251,0.98)] p-2 shadow-[0_22px_42px_rgba(35,23,28,0.12)] backdrop-blur">
                      {(Object.keys(SORT_MODE_LABELS) as FeatureSortMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setSortMode(mode);
                            setSortMenuOpen(false);
                          }}
                          className={`flex w-full flex-col items-start gap-1 rounded-[16px] px-4 py-3 text-left transition ${
                            sortMode === mode ? "bg-[var(--site-accent-soft)] text-[var(--site-accent-strong)]" : "text-[var(--site-text)] hover:bg-[rgba(184,95,131,0.08)]"
                          }`}
                        >
                          <span className="text-sm font-semibold">{SORT_MODE_LABELS[mode]}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleEditToggle}
                  className={`site-hover-chip inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition sm:h-11 ${
                    isEditing
                      ? "border-[var(--site-border-strong)] bg-[var(--site-text)] text-white shadow-[0_10px_20px_rgba(35,23,28,0.18)]"
                      : "border-[var(--site-border)] bg-white/82 text-[var(--site-text)] shadow-[0_10px_24px_rgba(35,23,28,0.06)]"
                  }`}
                  aria-label={isEditing ? "完成卡片排序" : "编辑卡片排序"}
                >
                  {isEditing ? (
                    <span>完成</span>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      <span>编辑</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity duration-150 md:grid-cols-2 lg:grid-cols-3 ${
              localOrderReady ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {visiblePinnedCards.map((card) => (
              <SortableFeatureCard
                key={card.id}
                card={{ ...card, onClick: () => handleCardLaunch(card.id, card.onClick) }}
                isEditing={isEditing}
                isPinned
                titleOnly={isCategoryPrioritySort}
                onPinToggle={() => handlePinToggle(card.id)}
                onIntent={card.preloadFeatureId ? () => onFeatureIntent?.(card.preloadFeatureId!) : undefined}
              />
            ))}

            {hasPinnedDivider ? (
              <div className="col-span-full my-1 flex items-center gap-4 px-1">
                <span className="shrink-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--site-accent-strong)]">其余功能</span>
                <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(160,95,124,0.2),rgba(160,95,124,0.08),transparent)]" />
              </div>
            ) : null}

            {visibleRegularCards.map((card) => (
              <SortableFeatureCard
                key={card.id}
                card={{ ...card, onClick: () => handleCardLaunch(card.id, card.onClick) }}
                isEditing={isEditing}
                isPinned={false}
                titleOnly={isCategoryPrioritySort}
                onPinToggle={() => handlePinToggle(card.id)}
                onIntent={card.preloadFeatureId ? () => onFeatureIntent?.(card.preloadFeatureId!) : undefined}
              />
            ))}

            {totalVisibleCount === 0 ? (
              <div className="col-span-full overflow-hidden rounded-[28px] border border-[var(--site-border)] bg-[var(--site-panel-strong)] px-7 py-10 text-center shadow-[0_12px_30px_rgba(35,23,28,0.05)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--site-border)] bg-white/80 text-[var(--site-accent-strong)]">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-[var(--site-text)]">没有找到对应功能</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--site-text-soft)]">
                  可以试试搜索模块名、玩法名，或者切回默认排序重新浏览。
                </p>
              </div>
            ) : null}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 260, easing: "cubic-bezier(0.2,0.8,0.2,1)" }}>
          {activeCard ? (
            <div className="w-full max-w-[380px] scale-[1.03]">
              <FeatureCard
                {...activeCard}
                isEditing={isEditing}
                isDragging
                isPinned={pinnedSet.has(activeCard.id)}
                titleOnly={isCategoryPrioritySort}
                onPinToggle={() => handlePinToggle(activeCard.id)}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
