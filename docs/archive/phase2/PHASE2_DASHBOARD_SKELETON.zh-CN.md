# Phase 2：最小页面层 Dashboard / Panel State 骨架

## 目标

在 query/use-case wrapper 之上，再做一层更贴近页面布局的 dashboard state composer，把控制 UI 常见的三块 panel 状态一次性组合出来：

- runtime panel
- sessions list panel
- session detail panel

## 当前新增

- `RoutingControlDashboard`
- `createRoutingControlDashboard(queries)`

## 核心接口

### `loadDashboard(options?)`

返回：

```ts
{
  selectedSessionKey?: string;
  runtime: RuntimePanelState;
  sessions: SessionsPanelState;
  detail: SessionDetailPanelState;
  lastLoadedAtMs: number;
}
```

## 设计目的

页面层真正关心的不是“单个 API 的结果”，而是：

- 整个页面现在有哪些 panel
- 每个 panel 是 success / idle / error / not_found 的哪种状态
- 当前选中了哪个 session
- 是否需要自动选中第一条 session

因此这一层负责把多次 query 结果组合成一个 dashboard state。

## 当前行为

- 默认先加载 runtime + sessions
- 如果有 session 且未手动指定，会自动选择第一条 session
- 如果指定了 `selectedSessionKey`，则按指定值加载 detail panel
- 如果 `autoSelectFirstSession: false`，则 detail panel 保持 `idle`

## 当前边界

本阶段仍然：

- 不绑定 React/Vue/Svelte
- 不做局部刷新策略
- 不做缓存
- 不做并发取消
- 不做写操作

## 适合的接法

这一层可以直接被：

- 页面 loader
- dashboard controller
- side panel manager
- future hook adapter

复用。

## 后续方向

如果继续推进，下一步最自然的是：

1. 做一个真实页面 demo（哪怕先是伪组件 / mock panel）
2. 或补一个框架相关薄层（如 React hook wrapper）
