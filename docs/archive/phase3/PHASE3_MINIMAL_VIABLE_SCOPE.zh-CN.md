# Phase 3：最小可行态（MVS）收口说明

## 目标

把当前方案收口到支持 OpenClaw 多 agent / 多窗口状态所需的最小可行态，避免继续在弱相关 UI 层上扩散复杂度。

## 必需保留层

这些层直接关系到真实运行状态命中，应保留：

1. `route-session-key.ts`
2. `routing-session-key.runtime.ts`
3. `routing-session-store.ts`
4. `routing-state-read-service.ts`
5. `routing-control-api.ts`
6. `plugin/index.ts` 中接回 runtime flow 的逻辑

## 当前命中链

### message_received
- resolve message-side session key
- classify
- cache route decision into `routingSessionStore`

### before_agent_start
- resolve runtime-side session key
- try `findRouteDecision({ sessionKey, conversationId, messageHash })`
- apply override / task mode / downgrade guard
- update task state / clear consumed decision

## 可选层（可留可砍）

这些层主要服务 control UI 快速接入，不是多 agent / 多窗口状态的硬前提：

- `routing-control-adapter.ts`
- `routing-control-fetch-adapter.ts`
- `routing-control-client.ts`
- `routing-control-queries.ts`
- `routing-control-dashboard.ts`
- `routing-control-page-model.ts`
- `routing-control-demo-renderer.ts`

## 当前策略

本阶段不强制删除这些可选层，但停止继续在其上扩散。后续如果要瘦身，可优先从这些层开始裁剪，而不影响核心 runtime state path。

当前策略是：
- 保留它们作为可选接入层
- 不再把它们当成主目标继续扩建
- 核心工作优先投入 runtime 命中链、状态隔离与运行时观测

## 当前关键增强

为了补稳多窗口/多会话真实命中链，`RoutingSessionStore` 现在不仅支持按 `sessionKey` 取 decision，还支持：

- 按 `conversationId` 辅助命中
- 按 `messageHash` 辅助命中

这是在现有 OpenClaw hook 上下文能力范围内，对命中稳定性最划算的一次增强。
