# Sticky Routing 验收标准与回归样例集

> 适用范围：`soft-router-suggest` 中围绕长任务主线保持（sticky routing）、显式切换检测、保留当前任务短语抑制、软切换确认机制的验收与回归检查。

---

## 1. 目标

Sticky 机制的目标不是“尽可能聪明地猜一切”，而是：

1. **长任务跟进时稳定保持主线**
2. **遇到明确切换意图时能够可靠切换**
3. **遇到模糊短句时默认保守，不乱切**
4. **规则、词库、日志三者可解释、可复测**

一句话说：

> **该稳的时候稳，该切的时候切，模糊时宁可慢半拍，也不要误切。**

---

## 2. 验收标准

### A. 主线保持（Keep Sticky）

当用户明显表达“继续当前任务 / 不要切换”时，应继续沿用当前 sticky 主线：

- 命中 `keepCurrentTask` 后，普通 `pauseCurrentTask` / `switchAnotherTask` 不应轻易触发切换
- 短句跟进如 `继续` / `还是这个` / `按这个继续` 不应把任务打飞
- 如果当前会话已有 sticky 主线，低信息量跟进应优先保持该主线

**验收要求：**
- keep 类样例误切率应为 **0**
- keep + pause/switch 混合句中，只要 keep 语义明显成立，就应优先保留当前主线

---

### B. 显式切换（Hard Switch）

当用户明确要求切到别的任务，或重新来过时，应果断切换：

- `pauseCurrentTask + switchAnotherTask` 组合应能触发显式切换
- `restartFromScratch` 相关短语保持最高优先级
- 明确“去做别的 / 开新任务 / 换个任务”的表达不应被低强度 keep 词误压制

**验收要求：**
- 明确 switch / restart 样例识别率应接近 **100%**
- `restart_from_scratch` 不应被普通 keep 词覆盖

---

### C. 模糊短句保守策略（Conservative on Ambiguity）

对于不完整、短促、语义不充分的口语短句，应优先保守：

- `换一下`
- `先看下`
- `做这个？`
- `先这样`

这类短句在没有充分证据时，不应贸然切主线。

**验收要求：**
- ambiguous 类样例应优先落到“保持当前 / 等待更多信息”
- 不允许因为单个弱词就硬切任务

---

### D. 软切换确认机制（Soft Switch Confirmation）

当新意图有一定证据，但还不足以一次性硬切时，应通过连续确认实现软切换：

- 第一次出现中等强度新意图：记为 candidate
- 连续第二次仍指向同一新 kind：再确认切换
- 若中间回到原任务，则 candidate 应失效或重置

**验收要求：**
- 单次中等证据不应直接切走主线
- 连续两次同向新证据应能完成 soft switch

---

### E. 日志可解释性（Observability）

sticky 机制必须能被日志解释，而不是“黑箱误判”：

至少应能在日志中看出：

- 为什么保持 sticky
- 为什么触发显式切换
- 哪些 `keepHits / pauseHits / switchHits` 参与了判定
- 是否发生了 `sticky_explicit_switch_suppressed`
- 是否发生了 `sticky_soft_switch_candidate` / `sticky_soft_switch_confirmed`

**验收要求：**
- 回归样例中至少抽查 10 条，日志能解释最终判定

---

## 3. 验收通过判定

建议按下面标准判断“sticky 机制可以收口”：

- Keep 类：**100% 不误切**
- Restart 类：**100% 正确强切**
- Switch 类：**>= 90% 正确切换**
- Ambiguous 类：**>= 85% 保守处理**
- Soft switch 连续确认场景：**核心路径通过**
- 日志：**关键判定可追踪**

如果上述标准达成，则视为：

> **sticky routing 已达到“可验收、可维护、可继续演进”的状态，可以先收住。**

---

## 4. 回归样例集

说明：
- `预期结果` 取值建议：
  - `keep_current`
  - `pause_current`
  - `switch_task`
  - `restart_from_scratch`
  - `ambiguous_keep`
- `清 sticky?`：
  - `否` = 保留当前主线
  - `是` = 清掉旧 sticky / 进入新主线
  - `候选` = 仅记录 candidate，暂不立即切换

---

## 5. Keep Current 样例

| 编号 | 输入句子 | 预期结果 | 清 sticky? | 备注 |
|---|---|---|---|---|
| K01 | 继续 | keep_current | 否 | 典型低信息跟进 |
| K02 | 继续这个 | keep_current | 否 | 明确保留当前 |
| K03 | 继续刚才那个 | keep_current | 否 | 回到上一主线 |
| K04 | 接着做 | keep_current | 否 | 口语继续 |
| K05 | 接着这个任务 | keep_current | 否 | 明确保留 |
| K06 | 还是这个 | keep_current | 否 | 不切换 |
| K07 | 就这个 | keep_current | 否 | 保持当前 |
| K08 | 就按这个来 | keep_current | 否 | 明确按当前方案 |
| K09 | 按这个继续 | keep_current | 否 | 明确保留 |
| K10 | 先别换，继续这个 | keep_current | 否 | keep 压制 switch |
| K11 | 不要换，按这个来 | keep_current | 否 | 典型不切 |
| K12 | 别切，继续刚才的 | keep_current | 否 | 明确禁止切换 |

---

## 6. Pause Current 样例

> 这一类表示“当前任务先放下”，但不一定明确指定新任务。若系统当前只有 sticky 主线而无明确新目标，应谨慎处理。

| 编号 | 输入句子 | 预期结果 | 清 sticky? | 备注 |
|---|---|---|---|---|
| P01 | 先不管这个 | pause_current | 是 | 暂停当前 |
| P02 | 先别做这个 | pause_current | 是 | 暂停 |
| P03 | 先放下这个 | pause_current | 是 | 放下当前 |
| P04 | 停一下这个 | pause_current | 是 | 暂停当前主线 |
| P05 | 先搁着 | pause_current | 是 | 短句暂停 |
| P06 | 这个先放着 | pause_current | 是 | 当前任务挂起 |
| P07 | 先别弄这个 | pause_current | 是 | 暂停而未指定新任务 |
| P08 | 暂停这个任务 | pause_current | 是 | 明确暂停 |

---

## 7. Switch Task 样例

| 编号 | 输入句子 | 预期结果 | 清 sticky? | 备注 |
|---|---|---|---|---|
| S01 | 换个任务 | switch_task | 是 | 显式切换 |
| S02 | 换一个任务做 | switch_task | 是 | 显式切换 |
| S03 | 做别的 | switch_task | 是 | 切去其他事 |
| S04 | 先做别的 | switch_task | 是 | 显式切换 |
| S05 | 看别的 | switch_task | 是 | 切话题 |
| S06 | 处理别的 | switch_task | 是 | 切任务 |
| S07 | 切到另一个任务 | switch_task | 是 | 直接切换 |
| S08 | 开个新任务 | switch_task | 是 | 新任务 |
| S09 | 先不管这个，去做别的 | switch_task | 是 | pause + switch |
| S10 | 这个先放下，另一个任务 | switch_task | 是 | 当前转向别的 |
| S11 | 不做这个了，换下一个 | switch_task | 是 | 明显切换 |
| S12 | 别管这个，先看别的 | switch_task | 是 | 对比式切换 |

---

## 8. Restart From Scratch 样例

| 编号 | 输入句子 | 预期结果 | 清 sticky? | 备注 |
|---|---|---|---|---|
| R01 | 重来 | restart_from_scratch | 是 | 最高优先级 |
| R02 | 重新来 | restart_from_scratch | 是 | 同义 |
| R03 | 重新开始 | restart_from_scratch | 是 | 明确重开 |
| R04 | 从头来 | restart_from_scratch | 是 | 重新起步 |
| R05 | 从头开始 | restart_from_scratch | 是 | 强切 |
| R06 | 重新弄一遍 | restart_from_scratch | 是 | 重做 |
| R07 | 这题重来 | restart_from_scratch | 是 | 当前任务重开 |
| R08 | 我们重新做 | restart_from_scratch | 是 | 明确回炉 |

---

## 9. Ambiguous / Conservative 样例

> 这类样例不要求“完美分类”，重点是 **不要误切**。

| 编号 | 输入句子 | 预期结果 | 清 sticky? | 备注 |
|---|---|---|---|---|
| A01 | 换一下 | ambiguous_keep | 否 | 证据不足 |
| A02 | 先看下 | ambiguous_keep | 否 | 未说明看什么 |
| A03 | 先这样 | ambiguous_keep | 否 | 结束/保持均可能 |
| A04 | 可以，继续 | keep_current | 否 | 偏 keep |
| A05 | 这个呢 | ambiguous_keep | 否 | 上下文依赖强 |
| A06 | 那另一个呢 | ambiguous_keep | 候选 | 可能引出新支线 |
| A07 | 做这个？ | ambiguous_keep | 否 | 问句，不应硬切 |
| A08 | 要不换一个 | ambiguous_keep | 候选 | 有切换倾向但不够硬 |
| A09 | 先别动 | keep_current | 否 | 更偏保留当前 |
| A10 | 继续这个吧 | keep_current | 否 | keep 明显 |
| A11 | 先看看别的 | ambiguous_keep | 候选 | 有切换倾向但可先 candidate |
| A12 | 另一个也行 | ambiguous_keep | 候选 | 倾向不稳定 |

---

## 10. Soft Switch 连续确认样例

### 场景 T1：一次候选，不立刻切

- 当前 sticky 主线：`code_task`
- 用户第 1 句：`先看看别的`
- 预期：
  - 不直接 hard switch
  - 记录 candidate
  - sticky 暂时保留

### 场景 T2：连续两次同向，确认切换

- 当前 sticky 主线：`code_task`
- 用户第 1 句：`先看看别的`
- 用户第 2 句：`换个任务，处理另一个`
- 预期：
  - 第一句：candidate
  - 第二句：confirmed switch
  - 清掉旧 sticky，转入新主线

### 场景 T3：候选后又回到原任务，不应切

- 当前 sticky 主线：`code_task`
- 用户第 1 句：`换一下`
- 用户第 2 句：`还是继续这个`
- 预期：
  - 第一句：最多 candidate
  - 第二句：candidate 失效
  - 保留原 sticky

---

## 11. 推荐测试执行方式

### 手工最小流程

对每条样例至少记录：

- 输入句子
- 当前 sticky 是否存在
- 原 sticky kind
- 最终判定结果
- 是否清 sticky
- 命中的 hits
- 关键日志事件

建议记录格式：

```json
{
  "input": "先别换，继续这个",
  "stickyKind": "code_task",
  "expected": "keep_current",
  "actual": "keep_current",
  "clearSticky": false,
  "keepHits": ["先别换", "继续这个"],
  "pauseHits": [],
  "switchHits": [],
  "events": ["sticky_keep_kind"]
}
```

---

## 12. 收口建议

当以下条件满足时，建议先把 sticky 机制收住，不再无边界扩词：

1. Keep / Switch / Restart 三大类核心样例稳定通过
2. Ambiguous 样例总体表现保守
3. Soft switch 核心路径成立
4. 日志足够解释结果
5. 连续两轮修改后回归结果基本稳定

此时可以把 sticky 机制视为：

> **已从“实验性逻辑”进入“可维护功能”。**

后续只按误判反馈做小修，而不是再做大规模机制重写。
