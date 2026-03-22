# Phase 3 上线前 Checklist

## 目标定义

上线标准不是“代码能跑”，而是：

- 多窗口 / 多 agent 场景下能稳定命中正确会话
- 弱 identity 信号不会误触发 model override
- 观测日志足够解释每一次 hit / miss / skip
- 核心测试信号干净，至少能隔离老问题与新问题

## Step 1：身份观测齐全

已具备：

- `messageIdentitySource`
- `runtimeIdentitySource`
- `matchSource`

验收：

- 能从日志解释 message side 用什么 key 缓存 decision
- 能从日志解释 runtime side 用什么 key 查 decision
- 能分辨命中是 direct / conversation / messageHash / miss

## Step 2：可信命中策略收紧

目标：

- 强信号允许 override
- 中信号谨慎允许 override
- 弱信号只记录，不 override

当前建议口径：

- `sessionKey` 命中 + 非 fallback runtime identity => **trusted**
- `conversationId` 命中 => **trusted but medium**
- `messageHash` 命中 => **untrusted**
- runtime fallback identity => **untrusted**

验收：

- 新增 `route_cache_untrusted` 日志
- 不可信命中只记录，不触发切模型

## Step 3：真实流量灰度验证

目标：

- 在真实多窗口使用中采集命中分布

至少观察：

- `route_decision_cached`
- `route_cache_hit`
- `route_cache_untrusted`
- `route_cache_miss`
- `route_cache_expired`

验收：

- fallback 占比可接受
- `messageHash` 不再承担主命中路径
- 没有明显误绑窗口现象

## Step 4：测试与回归信号整理

最低要求：

- identity 解析测试通过
- trust policy 测试通过
- session store 命中路径测试通过
- build 通过
- sticky regression 的失败项要么修复，要么隔离为既有问题

## Step 5：发布收口

上线前最后确认：

- 默认 runtime 配置是否保守
- 文档是否和当前实现一致
- 冻结层 / 候删层边界是否明确
- 用户能否通过日志快速诊断命中失败原因
- 是否已有明确的灰度 runbook 与上线判定阈值

## 当前判断

截至本次进度：

- Step 1：基本完成
- Step 2：已完成（已引入 trusted/untrusted 分层命中）
- Step 3：未完成（仍需真实多窗口灰度日志）
- Step 4：已完成（`npm test` 与 `npm run test:sticky` 均已通过）
- Step 5：进行中

当前明确阻塞：

- sticky 语义层已不再构成阻塞
- build/test 链已收口：测试前会先 clean，避免旧 `dist/src/...` 产物制造假红
- 灰度 runbook 与判定阈值已补齐
- 因此当前主要剩余阻塞聚焦为：
  - 真实多窗口灰度日志尚未完成
  - 基于真实样本的最终默认开启判断尚未完成
