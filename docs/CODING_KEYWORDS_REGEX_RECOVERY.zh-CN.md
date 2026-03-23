# Coding 关键词：Regex + 单词边界恢复方案（0-FP 版本）

> 目标：在不放宽回归标准（FP=0、TP miss=0）的前提下，尽可能恢复原本被 hardening 判定为高误命中风险的 coding 关键词集合的“有效覆盖”。
>
> 结论：不直接把这些集合重新接回 `contains`（会 FP）；改用 **regex + 单词边界/上下文约束** 的“窄规则”补回关键场景，并通过 FP/TP 回归后部署到生产网关。

## 背景：为什么会被 blocked
hardening 报告中，这些集合被阻断的典型原因不是“没覆盖”，而是会造成误路由：

- **HDL 的 `reg`**：`contains` 会误匹配 `risk register` 里的 `reg`
- **Ruby/Rails**：`Rails` 在地铁站/地名等语境会出现（不是编程）
- **Rust**：语言名在“锈蚀”语境也会出现（不是编程）
- **bun**：食物语境误命中
- **file_ext**：仅靠后缀/文件名的宽匹配容易把普通 URL（如 `docs.rs`）误判为 coding
- **common sets**（package_manager/test_framework/web_backend/build_and_ci 等）：contains 方式会把大量非编程对话误判为 coding（“CI/流水线/管道”等太常见）

## 本次策略：不复活 contains set，改为“窄 regex”
我们保持 `kinds.coding.signals.positive` 里已通过 hardening 的 46 个集合不变；对高风险集合改为补充 `kinds.coding.signals.regex`。

### 规则设计原则
1. **单词边界**：对容易 substring 误命中的 token，必须用 `\\b`（如 `reg`）
2. **上下文约束**：对“词本身歧义大”的 token，必须增加上下文（如 `rails <subcmd>`、`bun <subcmd>`）
3. **避免过宽**：不再使用“泛文件后缀/路径”的大正则（已证实会对 `docs.rs` 产生 FP）
4. **中文注意事项（重要）**：JS 的 `\\b` 使用 `\\w` 语义（ASCII），在 **中文 token 后面并不算词边界**。
   - 因此 `Python 脚本`、`Rust 语言` 这类中文短语不能写成 `...程序)\\b` 的形式；需要拆分 CN/EN 版本，CN 版本不在末尾强行使用 `\\b`。

## 已落地到生产的新增 regex（示例）
> 这些规则在本仓库回归中达到：FP=0、TP miss=0。

- Go（命令上下文）：
  - `\\bgo\\s+(?:test|build|run|get|install|mod\\s+(?:tidy|download|vendor))\\b`
- Rails（子命令上下文）：
  - `\\brails\\s+(?:new|g|generate|server|s|console|c|routes|db:[a-z_]+)\\b`
  - `\\bbundle\\s+exec\\s+rails\\b`
- bun / deno（命令上下文）：
  - `\\bbunx\\b`
  - `\\bbun\\s+(?:install|add|run|test|x)\\b`
  - `\\bdeno\\s+(?:run|test|fmt|lint)\\b`
- HDL `reg`（避免 register）：
  - `\\breg\\b\\s*(?:\\[[^\\]]+\\]\\s*)?[A-Za-z_][A-Za-z0-9_]*\\b`
- Python/Rust（拆分 CN/EN，避免 `\\b` 在中文后失效）：
  - Python CN：`\\bPython\\b\\s*(?:\\(|\\[)?\\s*(?:脚本|代码|项目|程序)`
  - Python EN：`\\bPython\\b\\s*(?:\\(|\\[)?\\s*(?:script|code|project|program)\\b`
  - Rust CN：`\\bRust\\b\\s*(?:\\(|\\[)?\\s*(?:代码|项目|程序|语言)`
  - Rust EN：`\\bRust\\b\\s*(?:\\(|\\[)?\\s*(?:code|project|program|language|crate|cargo|rustc)\\b`

## 明确不做的事情
- 不把 `coding.lang.full` 整组语言名用 `contains` 或 `\\bLanguage\\b` 直接接回（语义歧义无法仅靠边界解决，例如 rust 金属/地名/人名等）
- 不引入“宽文件名/宽后缀”的大 regex（已出现 `docs.rs` FP）

## 生产部署步骤（简述）
1. 修改 `tools/soft-router-suggest/keyword-library.json`
2. 跑回归：
   - `node scripts/regression-coding-fp.run.mjs`
   - `node scripts/regression-coding-e2e.run.mjs`
3. 通过后安装到 OpenClaw workspace：
   - `node dist/cli/index.js install`
4. 重启网关：
   - `openclaw gateway restart`

---

维护备注：如果后续要恢复更多 blocked set，优先选择：
- 能写出“强上下文”或“强边界”的那种；
- 不要直接启用歧义词的裸匹配。
