# Phase 3：瘦身审查（先 B 后 A）

## 结论先说

当前最值钱的主线仍然是 **runtime 真实命中能力**。

所以这次瘦身审查的原则不是“大删特删”，而是：

- 先把 **直接影响 runtime 命中链** 的层固定下来
- 再把 **只服务控制面/UI 接入** 的层明确降级成可选层
- 停止继续在可选层上扩散复杂度

## 一、保留（核心运行层）

这些文件直接决定 `message_received -> before_agent_start` 是否能稳定命中，应继续保留并优先演进：

1. `plugin/index.ts`
2. `src/route-session-key.ts`
3. `src/routing-session-key.runtime.ts`
4. `src/routing-session-store.ts`
5. `src/routing-state-projector.ts`
6. `src/routing-state-read-service.ts`
7. `src/routing-state-dto.ts`
8. `src/routing-control-api-contract.ts`
9. `src/routing-control-api.ts`

### 这些层为什么保留

- `plugin/index.ts`：真实 hook 接入点，不能动摇
- `route-session-key.ts`：message side 的 session/window identity 入口
- `routing-session-key.runtime.ts`：runtime side 的 identity 入口
- `routing-session-store.ts`：route decision / task state 的统一状态容器
- `routing-state-projector.ts` / `routing-state-read-service.ts`：把 store 安全投影成只读状态，避免 UI 或控制面直接掏内部结构
- `routing-state-dto.ts` / `routing-control-api-contract.ts` / `routing-control-api.ts`：最薄控制接口，方便后续调试和观察，不必回到直接读 store 的耦合方式

## 二、冻结（可选控制面层）

这些层目前 **不是 runtime 多窗口命中的硬前提**，但保留成本不高，可作为未来控制页/调试页接入骨架：

1. `src/routing-control-adapter.ts`
2. `src/routing-control-fetch-adapter.ts`
3. `src/routing-control-client.ts`
4. `src/routing-control-queries.ts`
5. `src/routing-control-dashboard.ts`
6. `src/routing-control-page-model.ts`
7. `src/routing-control-demo-renderer.ts`

### 冻结定义

冻结不等于删除，而是：

- 允许保留
- 允许修 bug
- 不再继续为它们扩建新的抽象层
- 不再把它们当作 Phase 3 的主目标

## 三、候删（等真实 UI 接入结论出来再决定）

当前还没有“必须马上删”的代码，但下面这批属于 **第一顺位候删**：

- `routing-control-dashboard.ts`
- `routing-control-page-model.ts`
- `routing-control-demo-renderer.ts`
- 以及它们对应的测试与阶段文档

### 原因

它们主要解决的是：

- 页面展示组织
- demo 文本渲染
- dashboard 组合状态

而不是：

- runtime identity 对齐
- route decision 命中
- task mode 会话状态稳定性

如果后续确认没有真正的控制页要复用这一套，最先删这组最合理。

## 四、暂不建议删的可选层

虽然也属于可选控制面，但以下几层现在还不建议删：

- `routing-control-api.ts`
- `routing-control-api-contract.ts`
- `routing-state-read-service.ts`
- `routing-state-projector.ts`

### 原因

这几层虽然不是 runtime hook 本身，但它们仍然有两个价值：

1. **给 observability / 调试查看留一个干净出口**
2. **防止后续调用方重新直接耦合 `RoutingSessionStore` 内部结构**

所以它们更像“薄边界层”，不是典型 UI 装饰层。

## 五、接下来的工程策略

### 立即执行

- 停止继续扩写 dashboard / page-model / demo-renderer
- 新工作优先投到 runtime 命中链
- 所有新日志/观测都围绕真实命中路径补强

### 下一阶段优先级

1. 继续增强 `before_agent_start` 的 identity 命中能力
2. 用日志验证当前命中到底是：
   - `sessionKey`
   - `sessionId`
   - `threadId`
   - `conversationId`
   - `messageHash`
   - 还是 fallback
3. 观察哪些 fallback 还在高频发生，再决定是否继续补字段或补桥接键

## 六、这次审查后的明确口径

一句话版本：

> **保留核心状态链，冻结控制面便利层，候删页面组织层。**

也就是说：

- 不再继续做 UI 抽象层扩建
- 也不为了“看起来干净”马上大删
- 先把真正影响命中的 runtime 链打稳
