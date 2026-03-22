# Phase 3：Runtime 灰度日志汇总

在当前阶段，最重要的上线前验证不是继续加抽象层，而是看**真实多窗口日志**。

为此，仓库新增了一个本地汇总脚本：

```bash
npm run summarize:runtime-log
```

默认读取：

```text
~/.openclaw/logs/soft-router-suggest.jsonl
```

也可以手动指定路径：

```bash
node ./scripts/summarize-runtime-routing-log.mjs /path/to/soft-router-suggest.jsonl
```

---

## 它会汇总什么

脚本会聚合这些关键事件：

- `route_decision_cached`
- `route_cache_hit`
- `route_cache_untrusted`
- `route_cache_miss`
- `route_cache_expired`

同时会统计：

- `messageIdentitySource`
- `runtimeIdentitySource`
- `matchSource`
- `trustLevel`
- `trustReason`
- hit / untrusted 上的 `kind`

---

## 怎么看结果

### 理想状态

- `route_cache_hit` 稳定高于 `route_cache_untrusted`
- `runtimeIdentitySource=fallback` 很少出现
- `matchSource=messageHash` 不是主路径
- `route_cache_miss` 不会在正常多窗口工作流里持续偏高

### 还不适合默认上线的信号

- `route_cache_untrusted` 比 `route_cache_hit` 还高
- `runtimeIdentitySource=fallback` 高频出现
- `matchSource=messageHash` 成为主要命中来源
- 大量 `conversationId` 命中但缺乏更强 identity

---

## 推荐灰度方式

1. 开启 runtime routing
2. 用真实的多窗口/多任务工作流跑一段时间
3. 执行：

```bash
npm run summarize:runtime-log
```

4. 根据汇总结果判断：
   - 是否可以默认开启
   - 还是还需要继续补 stronger identity

---

## 当前项目判断

到这一步，代码侧已经具备：

- message/runtime identity 观测
- trusted/untrusted 分层命中
- sticky 回归修正
- 核心测试通过

所以剩余的上线判断，核心已经从“本地代码是否能跑”切换为“真实流量下命中分布是否健康”。
