# Phase 3：Runtime 命中链可观测性

## 目标

补齐 `message_received -> before_agent_start` 之间 route decision 命中链的可观测性，便于确认多窗口 / 多会话状态到底是通过哪一路命中的。

## 当前增强

`RoutingSessionStore` 现在支持返回命中来源：

- `sessionKey`
- `conversationId`
- `messageHash`
- `miss`

对应接口：

```ts
findRouteDecisionMatch({ sessionKey, conversationId, messageHash })
```

## 插件侧日志增强

在 `before_agent_start` 阶段，日志现在会显式记录：

- `matchSource`
- `matchedSessionKey`
- `runtimeSessionKey`
- `attemptedConversationId`
- `attemptedMessageHash`

### 关键事件

- `route_cache_hit`
- `route_cache_miss`
- `route_cache_expired`
- `route_override_applied`
- 其他 skip / downgrade guard 事件

## 目的

这样以后排查“为什么这个窗口没命中路由状态”时，就能快速看出：

- 是直接 sessionKey 命中
- 还是 conversationId 补命中
- 还是 messageHash 兜底命中
- 还是彻底 miss

## 关于可选 UI 层

目前 repo 中的 client / queries / dashboard / page-model / demo-renderer 等都视为 **可选 UI 便利层**。

在当前阶段：
- 不再继续扩散它们
- 但也不做无意义大删
- 核心精力集中在 runtime state path 和命中稳定性
