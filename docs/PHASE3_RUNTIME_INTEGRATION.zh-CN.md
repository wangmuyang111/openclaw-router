# Phase 3：核心必需层接回插件运行主流程

## 目标

把已经抽出来的核心状态层真正接回插件运行主流程，形成“多 agent / 多窗口状态”的可运行骨架。

## 本阶段聚焦

只做真正必要的几件事：

1. 统一 session/window key 参与真实运行流
2. `message_received -> before_agent_start` 之间通过统一 store 传递路由决策
3. task mode / primary model / temporary override 的 session 状态统一走 `RoutingSessionStore`
4. 清掉 `plugin/index.ts` 中残留的旧 Map 直连访问

## 当前主流程

### message_received
- 计算 `routeSessionKey`
- 生成 `RouteDecision`
- 写入 `routingSessionStore`
- 记录 `route_decision_cached`

### before_agent_start
- 读取 session key
- 从 `routingSessionStore` 读取 `RouteDecision`
- 命中后按 task mode / sticky / downgrade guard 决定最终 override
- 更新 `TaskSessionState`
- 清理已消费或失效的 route decision

## 当前关键收口

- 旧的 `routeDecisionBySession`
- 旧的 `taskSessionStateBySession`

都已经从主流程里移除，统一改为：

- `routingSessionStore.getRouteDecision(...)`
- `routingSessionStore.setRouteDecision(...)`
- `routingSessionStore.clearRouteDecision(...)`
- `routingSessionStore.getTaskState(...)`
- `routingSessionStore.setTaskState(...)`

## 当前仍然需要继续观察的点

`before_agent_start` 能拿到的上下文字段比 `message_received` 更弱，因此 session key 对齐目前采取“尽可能复用真实字段”的策略：

- `ctx.sessionKey`
- `ctx.sessionId`
- `ctx.threadId` / `ctx.thread_id`
- `ctx.conversationId`
- `ctx.chatId` / `ctx.chat_id`
- fallback `runtime-fallback:${provider}:${accountId}`

如果未来 OpenClaw hook 上下文字段增强，应优先继续强化这里的 session 对齐能力。

## 结论

到这一步，系统已经从“只有抽象状态层”变成“核心状态层真实参与插件运行路径”。

这才是支持多 agent / 多窗口状态的关键收口。
