# Phase 2：Fetch-Style Adapter

## 目标

给 `RoutingControlAdapter` 再接一层真正可跑的 **fetch-style adapter**，让控制 UI 或其他调用方可以按标准 Web Fetch API 的心智直接联调：

```ts
Request -> Response
```

## 当前新增

- `createRoutingControlFetchHandler(adapter)`

返回一个函数：

```ts
(request: Request) => Promise<Response>
```

它会：

1. 从 `request.url` 里解析 pathname / query
2. 从 `request.method` 提取方法
3. 调用内部 `RoutingControlAdapter`
4. 输出标准 `Response`
5. 默认返回 `application/json; charset=utf-8`
6. 默认加 `cache-control: no-store`

## 为什么这一步重要

因为到这一步之后，控制 UI 就已经可以按最常见的方式接：

- 浏览器端 fetch
- Service Worker / edge-style handler
- Next Route Handler / Remix loader 风格桥接
- Node 环境下的 WHATWG Request/Response 包装

## 当前边界

本阶段仍然：

- 只读
- 只支持当前 adapter 已支持的 GET 路由
- 不处理鉴权
- 不处理 streaming
- 不处理 CORS

## 当前推荐调用路径

```ts
RoutingSessionStore
  -> RoutingStateProjector
  -> RoutingStateReadService
  -> RoutingControlApi
  -> RoutingControlAdapter
  -> createRoutingControlFetchHandler(...)
```

## 后续方向

下一步如果继续推进，最自然的是：

1. 给 openclaw-control-ui 写一个轻量 client
2. 或者把这个 fetch-style handler 挂到真实 server/route runtime 上
