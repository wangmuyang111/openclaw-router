# Phase 2：最小 Adapter 层

## 目标

把 `RoutingControlApi` 再往外接一层最小 adapter，形成一套真正可被 transport 复用的“请求 -> 路由 -> 响应”骨架。

这一层仍然不绑定 Express / Koa / Next / Hono / Electron / IPC 框架。

## 当前新增

- `RoutingControlAdapter`

它接收一个最小请求对象：

```ts
{
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
}
```

返回一个最小响应对象：

```ts
{
  status: number;
  body: { ok: true, data: ... } | { ok: false, error: ... }
}
```

## 当前支持的路由

- `GET /routing/runtime`
- `GET /routing/sessions`
- `GET /routing/sessions/:sessionKey`

其中 `:sessionKey` 支持 URL decode（例如 `%2F`）。

## 为什么需要这一层

因为 `RoutingControlApi` 还只是“动作集合”；
而 adapter 层才是把外部 transport 的概念（method/path/status）引入进来的地方。

这样后面无论接：

- HTTP server
- OpenClaw control bridge
- IPC / Electron bridge
- 测试桩

都可以直接复用同一个 adapter。

## 当前边界

本阶段仍然只支持：

- GET
- 只读接口
- 最小错误码映射

暂不做：

- POST / PATCH / DELETE
- 写操作
- 鉴权
- 事件流
- 真实 server 启动器

## 后续方向

如果下一步继续推进，最自然的是两条路：

1. 增加一个真实 transport 绑定（例如 fetch/Request adapter 或 Node HTTP adapter）
2. 增加控制写接口（但这要等状态写模型设计清楚后再做）
