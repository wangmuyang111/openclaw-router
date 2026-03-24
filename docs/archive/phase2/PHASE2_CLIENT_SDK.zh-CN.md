# Phase 2：最小前端 Client SDK（只读）

## 目标

给 `openclaw-control-ui` 提供一个最小只读 client SDK，屏蔽 UI 侧重复处理的细节：

- URL 拼接
- sessionKey 编码
- fetch 调用
- JSON 解包
- 统一结果返回

## 当前新增

- `RoutingControlClient`
- `createRoutingControlClient(...)`

## 调用方式

```ts
const client = createRoutingControlClient({
  baseUrl: "https://example.test",
  fetchImpl, // 可选；浏览器环境默认走 global fetch
});

await client.getRuntime();
await client.listSessions();
await client.getSession("session/alpha");
```

## 提供的方法

### `getRuntime()`

请求：

- `GET /routing/runtime`

返回：

- `GetRuntimeResponse`

### `listSessions()`

请求：

- `GET /routing/sessions`

返回：

- `ListSessionsResponse`

### `getSession(sessionKey)`

请求：

- `GET /routing/sessions/:sessionKey`

其中 `sessionKey` 会自动 `encodeURIComponent(...)`。

返回：

- `GetSessionResponse`

## 为什么这一步重要

因为到这一步之后，UI 层就不需要关心：

- route path 怎么拼
- fetch 请求怎么写
- 返回 JSON 怎么 parse
- sessionKey 怎么 encode

UI 只需要处理业务状态：

- loading
- success
- empty / not_found
- error

## 当前边界

本阶段仍然只做：

- 只读 client
- 直接返回控制面结果包

暂不做：

- 重试
- 超时
- 鉴权 header
- streaming
- 写操作 client

## 后续方向

最自然的下一步是：

1. 给 control UI 页面直接接这个 client
2. 或者再补一个更贴近前端状态管理的 query wrapper
