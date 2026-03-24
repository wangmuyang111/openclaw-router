# Phase 2：最小控制接口层

## 目标

在 `RoutingStateReadService` 之上，再包一层 **framework-agnostic** 的最小控制接口，供未来的 openclaw-control-ui、HTTP、IPC、RPC 或其他桥接层复用。

本阶段仍然保持 **只读**。

## 分层位置

- `RoutingSessionStore`：内部状态
- `RoutingStateReadService`：读模型服务
- `RoutingControlApi`：最小控制接口层
- 未来 adapter：HTTP / WS / IPC / UI bridge

## 为什么单独加这一层

因为控制 UI 不应该直接依赖 service 内部细节，也不应该自己处理参数校验和错误分支。

`RoutingControlApi` 的职责是：

- 暴露稳定动作名
- 输出统一的 serializable 结果包
- 处理最小参数校验
- 处理 not_found / invalid_argument 这种控制面常见错误

## 当前接口

### `getRuntime()`

返回：

```ts
{ ok: true, data: RuntimeRoutingDTO }
```

### `listSessions()`

返回：

```ts
{ ok: true, data: { items: SessionSummaryDTO[] } }
```

### `getSession({ sessionKey })`

返回之一：

```ts
{ ok: true, data: SessionDetailDTO }
```

```ts
{ ok: false, error: { code: "invalid_argument", message: string } }
```

```ts
{ ok: false, error: { code: "not_found", message: string } }
```

## 未来如何接出去

这一层可以很容易映射成：

- HTTP
  - `GET /routing/runtime`
  - `GET /routing/sessions`
  - `GET /routing/sessions/:sessionKey`
- IPC / bridge
  - `routing.getRuntime`
  - `routing.listSessions`
  - `routing.getSession`

## 当前边界

本阶段仍不做：

- 状态写入
- 强制切换模型
- 清理 / 冻结 session
- 多 Agent 操作命令

这些留给后续阶段，在读接口稳定之后再加。
