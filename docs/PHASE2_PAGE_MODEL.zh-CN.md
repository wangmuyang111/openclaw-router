# Phase 2：最小 UI 页面模型 / Panel Props Mapper

## 目标

在 dashboard state 之上，再增加一层更贴近真实页面渲染的 page model / panel props mapper。

这一层继续保持：

- 不绑定具体组件库
- 不绑定 React/Vue/Svelte
- 只负责把页面需要的 props 形状整理出来

## 当前新增

- `mapRoutingDashboardToPageModel(state)`

## 输入

输入是：

- `RoutingDashboardState`

也就是上一层已经组合好的页面状态。

## 输出

输出是：

- `RoutingPageModel`

内部包括：

- `runtimePanel`
- `sessionsPanel`
- `detailPanel`
- `pageTitle`
- `selectedSessionKey`
- `lastLoadedAtLabel`

## 这一层解决什么问题

真实 UI 组件一般不会想直接吃底层 DTO，它更想拿：

- panel title
- 展示用 summary lines
- sessions list item labels
- detail field 列表
- empty state message
- error state message

因此这一层把 dashboard state 继续投影成更贴近组件 props 的结构。

## 当前设计

### Runtime Panel

输出：

- `title`
- `status`
- `summaryLines`
- `message`

### Sessions Panel

输出：

- `title`
- `status`
- `items[]`
- `emptyMessage`
- `message`

其中每个 item 带：

- `sessionKey`
- `isSelected`
- `primaryLabel`
- `temporaryLabel`
- `pendingLabel`
- `activityLabel`

### Detail Panel

输出：

- `title`
- `status`
- `sessionKey`
- `fields[]`
- `emptyMessage`
- `message`

## 当前边界

本阶段仍然不做：

- 真实组件
- CSS / 布局
- hooks
- 写操作按钮协议
- 国际化细分

## 后续方向

最自然的下一步是：

1. 接一个 mock page / demo renderer
2. 或者补一个具体框架薄层（例如 React props adapter）
