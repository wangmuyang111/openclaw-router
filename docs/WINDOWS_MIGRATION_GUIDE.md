# Windows 环境迁移复盘与规避指南（OpenClaw Soft Router）

版本：2026-02-12

## 目标

迁移到任意 Windows 机器时，保证：

- 可迁移：不依赖 `C:\Users\<name>` / `D:\openclaw` 绝对路径
- 可公开：不包含 token / 邮箱 / 本机日志 / 私有配置
- 可安装：`scripts/install.ps1` 一键安装（自动备份）
- 可运维：`router.ps1 / doctor.ps1 / uninstall.ps1` 在 PowerShell 5.1 稳定

---

## 已踩坑（必须规避）

### 1) 注释块写法错误

- 错误：`< - text ->`
- 正确：`<# ... #>`

### 2) 变量名撞只读变量

PowerShell 大小写不敏感，`$home` 等价 `$HOME`。

- 禁用命名：`$home` / `$profile`
- 推荐：`$openclawHome` / `$repoRoot` / `$workspace`

### 3) StrictMode 下“访问不存在属性”会直接炸

不要写：`if (-not $obj.foo) { ... }`

要写：

- `PSCustomObject`：`$null -ne $obj.PSObject.Properties['foo']`
- `Hashtable`：`$obj.Contains('foo')`

### 4) 动态属性访问风险

不要直接：`$cfg.plugins.entries.$id`

要用：`$cfg.plugins.entries.PSObject.Properties[$id]`

### 5) `param(...)` 必须在脚本顶部

顺序固定：

1. `#requires`
2. 注释块
3. `param(...)`
4. `Set-StrictMode`
5. functions
6. main

### 6) 不要靠“点赋值”给未知属性

`$obj.foo = 1` 在某些对象形态下会失败。

统一：

- 先检查属性是否存在
- 不存在则 `Add-Member`
- 存在则更新 `.Value`

### 7) UTF-8 编码读写必须显式

已知故障：中文 JSON 被误读导致乱码、`ConvertFrom-Json` 报错。

规范：

- 读取：`Get-Content -Raw -Encoding UTF8`
- 写入：`[System.IO.File]::WriteAllText(..., (New-Object System.Text.UTF8Encoding($false)))`

---

## 发布前检查清单

1. `scripts/doctor.ps1` 通过
2. `scripts/install.ps1` 在干净机可执行
3. `scripts/router.ps1 status/rules/fast/llm` 可执行
4. `scripts/uninstall.ps1` 可回滚
5. 仓库中无：
   - 绝对路径
   - 邮箱
   - token / auth 配置
   - `openclaw.json` / logs / sessions
6. GitHub CI 通过（JSON 校验、脚本语法、敏感信息扫描）

---

## 本仓当前已落实

- 脚本统一 StrictMode 安全写法
- install/uninstall/doctor 已支持分类规则文件（classification-rules）
- 工具链文件已更新到可发布版本
- CI 敏感信息检查已改为通用规则（不依赖个人邮箱名单）
