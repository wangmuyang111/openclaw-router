import type { ExplicitTaskSwitchReason } from "./sticky-explicit-switch.js";

export type StickyRegressionCase = {
  id: string;
  input: string;
  expectedReason: ExplicitTaskSwitchReason | null;
  note?: string;
};

export const stickyRegressionCases: StickyRegressionCase[] = [
  // keep current: should suppress switch detection
  { id: "K01", input: "继续", expectedReason: null, note: "typical keep-current follow-up" },
  { id: "K02", input: "继续这个", expectedReason: null },
  { id: "K03", input: "继续刚才那个", expectedReason: null },
  { id: "K04", input: "接着做", expectedReason: null },
  { id: "K05", input: "还是这个", expectedReason: null },
  { id: "K06", input: "就按这个来", expectedReason: null },
  { id: "K07", input: "先别换，继续这个", expectedReason: null, note: "keep should suppress switch" },
  { id: "K08", input: "不要换，按这个来", expectedReason: null },
  { id: "K09", input: "别切，继续刚才的", expectedReason: null },
  { id: "K10", input: "不要管，我们继续", expectedReason: null, note: "pause-like lead but should be suppressed by keep" },

  // pause current
  { id: "P01", input: "先不管这个", expectedReason: "pause_current_task" },
  { id: "P02", input: "先别做这个", expectedReason: "pause_current_task" },
  { id: "P03", input: "先放下这个", expectedReason: "pause_current_task" },
  { id: "P04", input: "停一下这个", expectedReason: "pause_current_task" },
  { id: "P05", input: "先搁着", expectedReason: "pause_current_task" },
  { id: "P06", input: "这个先放着", expectedReason: "pause_current_task" },

  // switch task
  { id: "S01", input: "换个任务", expectedReason: "switch_to_another_task" },
  { id: "S02", input: "换一个任务做", expectedReason: "switch_to_another_task" },
  { id: "S03", input: "做别的", expectedReason: "switch_to_another_task" },
  { id: "S04", input: "先做别的", expectedReason: "switch_to_another_task" },
  { id: "S05", input: "看别的", expectedReason: "switch_to_another_task" },
  { id: "S06", input: "切到另一个任务", expectedReason: "switch_to_another_task" },
  { id: "S07", input: "开个新任务", expectedReason: "switch_to_another_task" },
  { id: "S08", input: "这个先放下，另一个任务", expectedReason: "contrastive_switch" },
  { id: "S09", input: "先不管这个，去做别的", expectedReason: "contrastive_switch" },
  { id: "S10", input: "别管这个，先看别的", expectedReason: "contrastive_switch" },

  // restart from scratch
  { id: "R01", input: "重来", expectedReason: "restart_from_scratch" },
  { id: "R02", input: "重新来", expectedReason: "restart_from_scratch" },
  { id: "R03", input: "重新开始", expectedReason: "restart_from_scratch" },
  { id: "R04", input: "从头来", expectedReason: "restart_from_scratch" },
  { id: "R05", input: "从头开始", expectedReason: "restart_from_scratch" },
  { id: "R06", input: "重新弄一遍", expectedReason: "restart_from_scratch" },

  // ambiguous / conservative
  { id: "A01", input: "换一下", expectedReason: null, note: "currently treated conservatively" },
  { id: "A02", input: "先看下", expectedReason: null },
  { id: "A03", input: "先这样", expectedReason: null },
  { id: "A04", input: "这个呢", expectedReason: null },
  { id: "A05", input: "做这个？", expectedReason: null },
  { id: "A06", input: "要不换一个", expectedReason: null, note: "weak switch phrasing should not hard switch yet" },
  { id: "A07", input: "另一个也行", expectedReason: null },
];
