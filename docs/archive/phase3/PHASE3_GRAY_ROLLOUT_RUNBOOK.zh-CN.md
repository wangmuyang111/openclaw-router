# Phase 3：灰度上线 Runbook

## 目标

这份 runbook 解决的不是“功能有没有实现”，而是：

- 现在能不能开始灰度
- 灰度期间该看哪些信号
- 看到什么数据可以继续放量
- 看到什么数据应该停止默认开启

---

## 一、当前默认风险姿态

当前实现已经是**保守默认值**：

- `switchingEnabled = false`（默认不开自动切模型）
- `taskModeAllowAutoDowngrade = false`
- runtime route match 已按 `trusted / untrusted` 分层
- `messageHash` 命中与 runtime fallback identity 不会直接触发 override

这意味着：

> 当前仓库已经适合“先灰度观察”，但还不适合在没有真实日志验证前直接默认开启自动切模型。

---

## 二、灰度前准备

### 1. 本地测试必须先通过

至少确认：

```bash
npm test
npm run test:sticky
```

### 2. 日志汇总脚本可用

```bash
npm run summarize:runtime-log
```

### 3. 使用保守配置开始灰度

建议灰度期配置口径：

- 保持 `taskModeAllowAutoDowngrade=false`
- 不要放宽 `untrusted` 命中策略
- 先在真实多窗口场景下采样，再考虑提高自动化程度

---

## 三、灰度执行步骤

### Phase G1：观察期

目标：

- 先确认 identity 命中分布是否健康
- 不急着追求高切换率

做法：

1. 在真实多窗口 / 多任务场景下使用一段时间
2. 累积 `soft-router-suggest.jsonl`
3. 执行：

```bash
npm run summarize:runtime-log
```

重点关注：

- `route_cache_hit`
- `route_cache_untrusted`
- `route_cache_miss`
- `runtimeIdentitySource`
- `matchSource`

### Phase G2：判定期

目标：

- 判断是否已经具备“默认开启”的条件

建议至少收集：

- 一个包含多窗口切换的真实使用样本
- 不少于 30 次 route cache lookup 事件

如果样本过小，先不要下上线结论。

---

## 四、建议判定阈值

以下阈值是**当前阶段建议值**，用于判断是否可以进入更积极的灰度或默认开启。

### 可以继续灰度 / 接近可上线

满足以下大部分条件：

- `trusted hit ratio >= 70%`
- `untrusted ratio <= 15%`
- `miss ratio <= 20%`
- `runtimeIdentitySource=fallback <= 5%`
- `matchSource=messageHash <= 10%`
- 没有明显“误绑窗口 / 切错模型”的真实反馈

### 暂时不建议默认开启

只要出现以下任一条，就应继续观察或继续补 identity：

- `route_cache_untrusted > route_cache_hit`
- `runtimeIdentitySource=fallback` 高频出现
- `matchSource=messageHash` 成为主要命中来源
- `conversationId` 命中很多，但强 identity 很少
- 用户能明显感知到错误切换或错误绑定

---

## 五、发现问题时怎么判断

### 情况 A：`untrusted` 偏高

优先怀疑：

- runtime side 仍拿不到足够强的 identity
- message side 与 runtime side 键空间没有真正对齐

处理方向：

- 先补 stronger identity
- 不要直接放宽 trust policy

### 情况 B：`fallback` 偏高

优先怀疑：

- `before_agent_start` 上下文字段仍然太弱
- 某些渠道/窗口缺少 thread/session/chat 级别信息

处理方向：

- 先确认哪些平台/窗口在 fallback
- 再决定是否补桥接键或额外字段

### 情况 C：`messageHash` 偏高

优先怀疑：

- 直接 session identity 命中仍不够
- 现在仍在靠弱兜底保住命中

处理方向：

- 这不是健康主路径
- 继续补强 identity，而不是让 `messageHash` 承担更多责任

---

## 六、推荐上线结论模板

### 结论 1：可继续灰度

> 当前 runtime 路由已具备基本稳定性，trusted hit 为主，未见明显误绑窗口；建议继续小范围灰度，暂不直接默认开启。

### 结论 2：可准备默认开启

> 当前样本下 trusted hit 占主导，fallback 与 messageHash 占比低，未见明显误切模型；可以进入默认开启前的最终收口。

### 结论 3：暂不适合默认开启

> 当前弱命中/兜底命中占比仍高，说明 runtime identity 还不够稳；建议继续补 identity 信号并扩大灰度样本后再判断。

---

## 七、当前阶段的真实结论

截至目前：

- 本地 build / test 已通过
- sticky 回归已稳定
- trusted/untrusted 分层已生效
- 默认风险姿态已偏保守

因此当前最正确的下一步不是继续堆代码，而是：

> **跑真实多窗口灰度，拿分布，再决定是否可以默认开启。**
