export type FeatureDomainAppMode =
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
  | "middleSchoolExam";

export type FeatureDomainTarget =
  | {
      kind: "appMode";
      subdomain: string;
      cardId: string;
      label: string;
      mode: FeatureDomainAppMode;
      aliases?: string[];
    }
  | {
      kind: "modal";
      subdomain: string;
      cardId: string;
      label: string;
      modal: "superMap";
      aliases?: string[];
    };

export const DEFAULT_PRIMARY_DOMAIN = "executiveinsider.top";

export const FEATURE_DOMAIN_TARGETS: FeatureDomainTarget[] = [
  {
    kind: "modal",
    subdomain: "map",
    cardId: "super-map",
    label: "超级地图",
    modal: "superMap",
  },
  {
    kind: "appMode",
    subdomain: "exam",
    cardId: "middle-school-exam",
    label: "中学考试",
    mode: "middleSchoolExam",
  },
  {
    kind: "appMode",
    subdomain: "pikachu",
    cardId: "pikachu-volleyball",
    label: "皮卡丘排球",
    mode: "pikachuVolleyball",
    aliases: ["volleyball"],
  },
  {
    kind: "appMode",
    subdomain: "code",
    cardId: "code-breaker",
    label: "猜码大师",
    mode: "codeBreaker",
    aliases: ["codebreaker"],
  },
  {
    kind: "appMode",
    subdomain: "solar",
    cardId: "solar-system",
    label: "太阳系漫游",
    mode: "solarSystem",
  },
  {
    kind: "appMode",
    subdomain: "shaft",
    cardId: "ns-shaft",
    label: "是男人下100层",
    mode: "nsShaft",
    aliases: ["ns"],
  },
  {
    kind: "appMode",
    subdomain: "dict",
    cardId: "word-lookup",
    label: "简易查词",
    mode: "dictionary",
    aliases: ["dictionary"],
  },
  {
    kind: "appMode",
    subdomain: "assessment",
    cardId: "personality-assessments",
    label: "性格测评",
    mode: "assessmentHub",
    aliases: ["assess"],
  },
  {
    kind: "appMode",
    subdomain: "suika",
    cardId: "suika",
    label: "合成大西瓜",
    mode: "suika",
  },
  {
    kind: "appMode",
    subdomain: "winlinez",
    cardId: "winlinez",
    label: "WINLINEZ",
    mode: "winlinez",
    aliases: ["lines"],
  },
  {
    kind: "appMode",
    subdomain: "ocr",
    cardId: "ocr-studio",
    label: "OCR 工作台",
    mode: "ocr",
  },
  {
    kind: "appMode",
    subdomain: "skill",
    cardId: "skill-hub",
    label: "Skill 仓库",
    mode: "skillHub",
    aliases: ["skills"],
  },
  {
    kind: "appMode",
    subdomain: "chat",
    cardId: "conversation-lab",
    label: "对话实验室",
    mode: "conversation",
    aliases: ["conversation"],
  },
];

function normalizeHostname(value: string) {
  let hostname = value.trim().toLowerCase();
  if (!hostname) return "";

  try {
    if (hostname.includes("://")) {
      hostname = new URL(hostname).hostname;
    }
  } catch {
    return "";
  }

  if (hostname.startsWith("[") && hostname.includes("]")) {
    return hostname.slice(1, hostname.indexOf("]"));
  }

  return hostname.replace(/:\d+$/, "");
}

export function getPrimaryDomain() {
  return normalizeHostname(process.env.NEXT_PUBLIC_PRIMARY_DOMAIN || DEFAULT_PRIMARY_DOMAIN);
}

export function getSubdomainForHost(hostname: string, primaryDomain = getPrimaryDomain()) {
  const host = normalizeHostname(hostname);
  const domain = normalizeHostname(primaryDomain);
  if (!host || !domain || host === domain || host === `www.${domain}`) return null;
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;
  const subdomain = host.slice(0, -suffix.length);
  return subdomain || null;
}

export function resolveFeatureDomain(hostname: string, primaryDomain = getPrimaryDomain()) {
  const subdomain = getSubdomainForHost(hostname, primaryDomain);
  if (!subdomain) return null;
  return (
    FEATURE_DOMAIN_TARGETS.find(
      (target) => target.subdomain === subdomain || target.aliases?.includes(subdomain)
    ) || null
  );
}

export function getFeatureDomainHomeUrl(location: Location, primaryDomain = getPrimaryDomain()) {
  const target = resolveFeatureDomain(location.hostname, primaryDomain);
  if (!target) return null;
  return `${location.protocol}//${primaryDomain}/`;
}
