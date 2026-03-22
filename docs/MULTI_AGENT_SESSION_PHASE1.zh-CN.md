# Multi-Agent / Multi-Session Phase 1 底座设计

## 目标

Phase 1 不追求一次做完多 Agent 编排，而是先把软路由插件里“按会话存状态”的能力独立出来，形成可扩展的底座，方便后续继续做：

- 多会话隔离
- 多 Agent / 多 slot 扩展
- 控制 UI 读取当前会话路由状态
- 更清晰的可观测性与回归测试

## 本阶段范围

本阶段主要做三件事：

1. 抽出统一的 `routeSessionKey` 解析逻辑
2. 抽出统一的 `RoutingSessionStore` 会话状态容器
3. 让插件主流程通过这个状态容器读写 `RouteDecision` / `TaskSessionState`

## Route Session Key 规则

统一优先级：

1. `ctx.sessionKey`
2. `event.metadata.sessionKey` / `session_key`
3. `threadId` / `thread_id`
4. `conversationId` / `conversation_id`
5. `ctx.conversationId`
6. `chatId` / `chat_id`
7. fallback：`fallback:${provider}:${accountId}:${from}`

这样做的意义是：后续无论控制 UI、日志、还是多 Agent 状态，都围绕同一个 session key 运转。

## Session State 数据模型

当前 Phase 1 只保留两个槽位：

- `routeDecision`
  - 最近一次 message_received 产生的候选路由决策
  - 带 TTL，用于 before_agent_start 阶段消费
- `taskState`
  - 当前会话的任务模式主模型 / 临时模型状态

抽象结构如下：

```ts
SessionRoutingState = {
  routeDecision?: RouteDecision;
  taskState?: TaskSessionState;
}
```

后续如果扩展为多 Agent，可以在这个容器上继续挂：

- `agents[agentId]`
- `policyOverrides[agentId]`
- `observability`

而不需要再把状态散落回 `plugin/index.ts`。

## 为什么先抽状态层

因为现在插件已经有：

- sticky / task mode
- downgrade guard
- sessionKey 级别的缓存

但状态读写还散落在主文件里。继续叠加多 Agent / 多会话策略之前，先把状态层独立出来，后面的改造成本会低很多。

## Phase 1 完成后的收益

- 插件行为尽量不变，但结构更清晰
- 会话状态访问有统一入口
- 可以单独给 session key 与状态容器补测试
- Phase 2 可以更自然地接控制 UI / 观测能力
