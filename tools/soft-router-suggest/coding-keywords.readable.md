# Coding 关键词库（可读版）

> 来源：`tools/soft-router-suggest/keyword-library.json` + 我们的补丁库（`coding关键词库.txt` part2/3/4），已在 repo 内合并为 keywordSets（但不强制全部接入 signals）。
>
> 设计原则：
> - **强特征**：报错签名 / 错误码 / 包管理命令 / 典型文件名 / 生态工具（更少误命中）
> - **弱特征**：更通用的编程讨论词（更易误命中，权重应低）
> - **短 token**（如 `CI` / `pip` / `Go`）：必须用 **regex + 单词边界/上下文**，不要用 contains。

---

## 1) Strong（contains）——强命中词（建议 weight=3）
来自 set：`coding.strong`

- debug / debugging
- traceback / stack trace
- exception / crash / fatal error
- 报错
- TypeError / ReferenceError / SyntaxError
- ModuleNotFoundError
- ECONNREFUSED / ETIMEDOUT / EADDRINUSE
- build failed
- tsc
- lint / typecheck
- npm / pnpm / poetry / conda
- ```
- .ts / .js / .py
- error / bug
- AssertionError / ImportError

> 注：已从 contains 移除的歧义短词：`CI` `pip` `pipeline`（改走 regex / 更安全的短语）。

---

## 2) Weak（contains）——弱命中词（建议 weight=1）
来自 set：`coding.weak`（很长，属于“兜底加分”）

核心高频示例：
- 编程 / programming / 代码 / code
- 调试 / troubleshoot / 排障
- 日志 / log / stderr / stdout
- 复现 / repro / minimal repro
- timeout / permission denied / 401/403/404/429/5xx
- git / commit / branch / merge / rebase / PR/MR
- docker / k8s / kubernetes
- bash / powershell / cmd
- 常见文件与后缀：.tsx .jsx .go .rs .java .c .cpp .h .hpp .cs .kt .swift .rb .php .sh .ps1 .yaml .yml .json .toml .ini .sql …

---

## 3) Regex（强）——短 token / 错误码（建议 weight=3，计 strongHit）
来自：`kinds.coding.signals.regex` & `coding.regex.strong`

- `\\bpip\\b`
- `\\bCI\\b`
- `\\b(?:CI\\/CD|CI|build|deploy)\\s+pipeline\\b`
- `\\bTS\\d{4}\\b`
- `\\bCS\\d{4}\\b`
- `\\bORA-\\d{4,5}\\b`
- `\\bSQLSTATE\\b`

## 4) Regex（中）——典型错误行（建议 weight=2）
来自：`coding.regex.medium`

- `^npm\\s+ERR!`
- `^Traceback \\(most recent call last\\):`
- `\\berror\\[E\\d{4}\\]`

---

## 5) Feature / Scenario Sets（补丁库合并进 keywordSets，但默认不全接入）

这些是“更细粒度”的强信号词表，便于你之后按需接入 coding signals：

### 5.1 文件/工具链（跨语言高信号）
- `coding.feature.package_files`
- `coding.feature.build_and_toolchain`

### 5.2 按语言强特征（语法/生态）
- `coding.feature.python`, `coding.scenario.python`
- `coding.feature.js_ts_node`, `coding.scenario.js_ts_node`
- `coding.feature.java_jvm`, `coding.scenario.java_jvm`
- `coding.feature.c_cpp`, `coding.scenario.c_cpp`
- `coding.feature.csharp_dotnet`, `coding.scenario.csharp_dotnet`
- `coding.feature.go`, `coding.scenario.go`
- `coding.feature.rust`, `coding.scenario.rust`
- `coding.feature.php`, `coding.scenario.php`
- `coding.feature.ruby`, `coding.scenario.ruby`
- `coding.scenario.swift_ios`, `coding.scenario.kotlin_android`, `coding.scenario.dart_flutter`, …

### 5.3 Common 场景（抽公共部分）
- `coding.scenario.common.package_manager`
- `coding.scenario.common.test_framework`
- `coding.scenario.common.build_and_ci`
- `coding.scenario.common.web_backend`
- `coding.scenario.common.devops`
- `coding.scenario.common.db`
- `coding.scenario.common.ml_data`

---

## 6) 接入建议（推荐的“保险”配置）

最小保险接入：
- positive:
  - `coding.strong` weight=3
  - `coding.weak` weight=1
- regex:
  - 维持现有 regex（pip/CI/错误码/Traceback/npm ERR）

增强接入（仍偏安全）：
- positive:
  - `coding.feature.package_files` weight=2
  - `coding.feature.build_and_toolchain` weight=2

> 其余语言场景 sets 先别全挂；等我们补一套“真编程 TP 样本”后再逐批开启。
