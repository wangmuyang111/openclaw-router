export type ExplicitTaskSwitchReason =
  | "pause_current_task"
  | "switch_to_another_task"
  | "restart_from_scratch"
  | "contrastive_switch";

export type ExplicitTaskSwitchMatch = {
  reason: ExplicitTaskSwitchReason;
  confidence: "medium" | "high";
  matched: string[];
  suppressedBy?: string[];
  note: string;
};

export const EXPLICIT_SWITCH_LEXICON = {
  pauseCurrentTask: [
    "别管",
    "不要管",
    "先不管",
    "先别管",
    "先别",
    "别弄",
    "别做",
    "先别做",
    "先别弄",
    "停一下",
    "暂停",
    "先放下",
    "先搁着",
    "先放着",
  ],
  switchAnotherTask: [
    "换个",
    "换一个",
    "换个任务",
    "换一个任务",
    "换一题",
    "换一下",
    "换别的",
    "换点别的",
    "另一个任务",
    "另一个",
    "另外一个",
    "另个",
    "新任务",
    "新的任务",
    "另题",
    "下一个任务",
    "做别的",
    "做点别的",
    "搞别的",
    "搞点别的",
    "看别的",
    "看点别的",
    "处理别的",
    "处理点别的",
    "去做别的",
    "先做别的",
    "先看别的",
    "先处理别的",
    "切到另一个任务",
    "切到别的任务",
    "切另一个任务",
    "改做别的",
    "改看别的",
    "另开一个任务",
    "开个新任务",
    "开一个新任务",
  ],
  restartFromScratch: [
    "重来",
    "重新来",
    "重新开始",
    "从头来",
    "从头开始",
    "重新弄",
    "重新做",
  ],
  keepCurrentTask: [
    "继续",
    "继续这个",
    "继续刚才",
    "继续当前",
    "继续这个任务",
    "继续这件事",
    "继续这条",
    "继续这一条",
    "继续原来那个",
    "接着做",
    "接着弄",
    "接着来",
    "接着刚才",
    "接着上一个",
    "接着这个",
    "接着这个任务",
    "沿着这个继续",
    "继续做",
    "继续弄",
    "还是这个",
    "还是刚才那个",
    "还做这个",
    "就这个",
    "就按这个",
    "就按这个来",
    "按这个继续",
    "按这个来",
    "先做这个",
    "先做这个任务",
    "只做这个",
    "只做这个任务",
    "就做这个",
    "先别切",
    "别切",
    "别切走",
    "别换",
    "先别换",
    "不要换",
    "不换",
    "不用换",
    "不用切",
    "别跳",
    "先别跳",
    "先别动",
    "别动别的",
    "别搞别的",
    "不要搞别的",
    "先别搞别的",
    "先别看别的",
    "先别做别的",
    "先别处理别的",
    "还按原任务",
    "先按原任务",
    "先按这个任务",
  ],
  contrastiveLead: ["不要", "别", "先别", "先不要"],
  contrastiveShift: ["改成", "换成", "去做", "做", "处理", "看", "先做", "先看"],
} as const;

export const EXPLICIT_SWITCH_AMBIGUOUS_SINGLETONS = new Set([
  "不要",
  "别",
  "另一个",
  "换个",
  "换一个",
  "做",
  "看",
]);

export function normalizeLooseText(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。！？；：、“”‘’\"'`()（）【】\[\]<>《》,.;:!?]/g, "");
}

export function collectMatchedPhrases(text: string, phrases: readonly string[]): string[] {
  const hits = new Set<string>();
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (text.includes(phrase) && !EXPLICIT_SWITCH_AMBIGUOUS_SINGLETONS.has(phrase)) {
      hits.add(phrase);
    }
  }
  return Array.from(hits);
}

function hasStandaloneLead(text: string): boolean {
  return ["先不要", "先别", "不要", "别"].some((phrase) => {
    const idx = text.indexOf(phrase);
    if (idx < 0) return false;

    const next = text.slice(idx + phrase.length, idx + phrase.length + 1);
    if (!next) return true;

    if (phrase === "别" && next === "的") return false;
    if (phrase === "不要" && next === "的") return false;
    return true;
  });
}

function hasStandaloneShift(text: string): boolean {
  const guardedPatterns = [
    /(?:^|先别|别|不要|先不要)(?:做|看|处理)(?:这个|这个任务|当前|当前任务)/,
    /(?:^|先别|别|不要|先不要)(?:做|看|处理)(?:它|这件事|这条)/,
  ];
  if (guardedPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return ["改成", "换成", "去做", "先做", "先看", "做", "看", "处理"].some((phrase) => {
    const idx = text.indexOf(phrase);
    if (idx < 0) return false;

    if ((phrase === "做" || phrase === "看" || phrase === "处理") && idx > 0) {
      const prev = text.slice(Math.max(0, idx - 2), idx);
      if (prev.endsWith("别") || prev.endsWith("不要")) return false;
    }

    return true;
  });
}

export function detectExplicitTaskSwitch(text: string): ExplicitTaskSwitchMatch | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const compact = normalizeLooseText(raw);
  if (!compact) return null;

  const restartHits = collectMatchedPhrases(compact, EXPLICIT_SWITCH_LEXICON.restartFromScratch);
  if (restartHits.length > 0) {
    return {
      reason: "restart_from_scratch",
      confidence: "high",
      matched: restartHits,
      note: "restart phrase matched",
    };
  }

  const keepHits = collectMatchedPhrases(compact, EXPLICIT_SWITCH_LEXICON.keepCurrentTask);
  const pauseHits = collectMatchedPhrases(compact, EXPLICIT_SWITCH_LEXICON.pauseCurrentTask);
  const switchHits = collectMatchedPhrases(compact, EXPLICIT_SWITCH_LEXICON.switchAnotherTask);

  const hasContrastiveLead = hasStandaloneLead(compact);
  const hasContrastiveShift = hasStandaloneShift(compact);

  const suppressByKeep = keepHits.length > 0;

  if (!suppressByKeep && (pauseHits.length > 0 || hasContrastiveLead) && switchHits.length > 0) {
    return {
      reason: "contrastive_switch",
      confidence: "high",
      matched: Array.from(new Set([...pauseHits, ...switchHits])),
      note: "contrastive stop-and-switch pattern matched",
    };
  }

  if (!suppressByKeep && pauseHits.length >= 1 && switchHits.length >= 1) {
    return {
      reason: "switch_to_another_task",
      confidence: "high",
      matched: Array.from(new Set([...pauseHits, ...switchHits])),
      note: "pause + another-task phrases matched together",
    };
  }

  if (!suppressByKeep && pauseHits.length >= 1 && compact.length <= 12) {
    return {
      reason: "pause_current_task",
      confidence: "medium",
      matched: pauseHits,
      suppressedBy: keepHits,
      note: "short pause-current-task phrase matched",
    };
  }

  if (!suppressByKeep && switchHits.length >= 1 && compact.length <= 12) {
    const strongSwitchHits = switchHits.filter(
      (phrase) => phrase.length >= 4 || phrase.includes("任务") || phrase.includes("别的"),
    );
    if (strongSwitchHits.length > 0) {
      return {
        reason: "switch_to_another_task",
        confidence: "medium",
        matched: strongSwitchHits,
        suppressedBy: keepHits,
        note: "short another-task phrase matched",
      };
    }
  }

  return null;
}
