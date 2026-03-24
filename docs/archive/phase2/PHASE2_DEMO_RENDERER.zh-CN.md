# Phase 2：最小 Mock Page / Demo Renderer Contract

## 目标

验证 `RoutingPageModel` 是否真的顺手地接近“可渲染页面”。

这一步不做真实前端页面，也不绑定具体组件库，而是再加一层最轻的 demo renderer contract：

- 输入：`RoutingPageModel`
- 输出：一组可以被 mock page / demo UI / 文本预览直接消费的 block

## 当前新增

- `createRoutingDemoPageContract(model)`
- `renderRoutingDemoPageText(contract)`

## 意义

这一层的价值不是产品功能，而是验证：

- runtime panel 的 props 是否足够
- sessions list item 的 props 是否顺手
- detail panel 的 fields / empty state / message 是否足够

如果这一层能顺利渲染出一份可读的 mock page，就说明前面的 page model 设计基本靠谱。

## 当前 contract

输出结构：

```ts
{
  title: string;
  subtitle: string;
  blocks: Array<{
    kind: "runtime" | "sessions" | "detail";
    title: string;
    status: string;
    lines: string[];
  }>;
}
```

## 当前边界

本阶段仍然不做：

- 真正 UI 组件
- 样式系统
- hook 绑定
- 交互事件
- 写操作按钮

## 后续方向

如果下一步继续推进，最自然的是：

1. 把这个 contract 接到真实 `openclaw-control-ui` 的页面/组件
2. 或者做一个具体框架的 props adapter / hook 层
