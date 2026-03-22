# Phase 2：页面层 Query / Use-Case Wrapper（只读）

## 目标

在 `RoutingControlClient` 之上再包一层更贴近页面层的 query/use-case wrapper，减少 UI 页面自己处理控制面结果包的样板代码。

## 当前新增

- `RoutingControlQueries`
- `createRoutingControlQueries(client)`

## 提供的方法

### `loadRuntimeView()`

返回：

```ts
{
  status: "success" | "invalid_argument" | "not_found" | "error";
  data?: RuntimeRoutingDTO;
  message?: string;
  code?: ...;
}
```

### `loadSessionsView()`

返回：

```ts
{
  status: "success" | "invalid_argument" | "not_found" | "error";
  data?: SessionSummaryDTO[];
  message?: string;
  code?: ...;
}
```

### `loadSessionDetailView(sessionKey)`

返回：

```ts
{
  status: "success" | "invalid_argument" | "not_found" | "error";
  data?: SessionDetailDTO;
  message?: string;
  code?: ...;
}
```

## 设计意图

页面层最常见的逻辑不是“如何调 API”，而是：

- 拿到成功数据
- 处理 not_found
- 处理 invalid_argument
- 处理未知错误/网络异常

因此这一层把控制面返回的 `{ ok, data/error }` 结果包，继续映射成更贴近 UI 页面渲染的 view state。

## 当前边界

本阶段仍然：

- 只读
- 不做缓存
- 不做重试
- 不和 React/Vue/Svelte hooks 绑定
- 不做全局状态管理

## 适合的使用位置

这一层适合被：

- 页面 loader
- 组件外层 controller
- 轻量状态管理封装
- 未来的 React Query / TanStack Query 包装

直接调用。

## 后续方向

如果继续推进，下一步最自然的是：

1. 给 openclaw-control-ui 直接接一个页面 demo / route loader
2. 或者补一个更贴近具体前端框架的 hook/query adapter
