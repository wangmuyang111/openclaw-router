# Windows 环境下插件安装 / 修复 / 卸载全流程说明（Soft Router Suggest）

> 适用对象：在 **Windows + PowerShell 5.1** 环境下使用 OpenClaw Soft Router（soft-router-suggest 插件）的个人/运维同学。
>
> 本文只关注：**安装 / 修复 / 卸载** 全流程，以及每一步背后脚本实际做了什么。

---

## 0. 基本约定

- 目标插件：`soft-router-suggest`
- 操作系统：Windows 10/11
- PowerShell：5.1 及以上（系统自带即可）
- OpenClaw 已安装并至少跑过一次 `openclaw configure`
- 本仓库路径假设为：

  ```powershell
  %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
  ```

- OpenClaw 主目录（脚本自动推断）：

  ```powershell
  %USERPROFILE%\.openclaw
  ```

- OpenClaw 工作区（脚本自动推断）：

  ```powershell
  %USERPROFILE%\.openclaw\workspace
  ```

所有脚本都已按 Windows 迁移规范写好：

- 不依赖个人绝对路径
- 自动备份 `openclaw.json`
- 严格模式安全（StrictMode）

---

## 1. 首次安装（全新机器 / 全新用户）

### 1.1 一键安装命令

在 **PowerShell 5.1** 中执行：

```powershell
cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

.\scripts\install.ps1
```

### 1.2 `install.ps1` 具体做什么？

脚本内部主要分三步：

1. **准备路径**

   - 计算：
     - `OpenClawHome = %USERPROFILE%\.openclaw`
     - `Workspace   = %USERPROFILE%\.openclaw\workspace`
   - 创建（如不存在）：
     - `%Workspace%\.openclaw\extensions\soft-router-suggest`
     - `%Workspace%\tools\soft-router-suggest`

2. **复制插件与工具**

   - 插件文件（源：`plugin/`）：
     - `index.ts`
     - `openclaw.plugin.json`
     - `keyword-library.ts`
     - `weighted-routing-engine.ts`
     - 以及兼容旧版的 `classification-*.ts`（存在才复制）
   - 复制到：

     ```text
     %Workspace%\.openclaw\extensions\soft-router-suggest
     ```

   - 工具目录（源：`tools/soft-router-suggest` **整个目录**）：
     - 完整复制到：

       ```text
       %Workspace%\tools\soft-router-suggest
       ```

   - 如工作区缺少：

     ```text
     %Workspace%\tools\soft-router-suggest\keyword-overrides.user.json
     ```

     则用 `keyword-overrides.user.example.json` 自动生成一份默认用户覆盖文件。

3. **安全修改 `openclaw.json`**

   - 位置：

     ```text
     %USERPROFILE%\.openclaw\openclaw.json
     ```

   - 先做**带时间戳备份**：

     ```text
     openclaw.json.bak.soft-router-suggest.<yyyyMMdd-HHmmss>
     ```

   - 然后：
     - 确保存在：`plugins.entries["soft-router-suggest"]`
     - 设置：
       - `enabled = true`
       - `config.ruleEngineEnabled   = true`
       - `config.routerLlmEnabled   = false`
       - `config.switchingEnabled   = false`   # 默认**只建议不自动切换**
       - `config.switchingAllowChat = false`
       - `config.openclawCliPath    = "openclaw"`

   - 最后用 UTF-8（无 BOM）写回 `openclaw.json`。

### 1.3 安装完成后的验证步骤

1. **运行 doctor（只读检查）**：

   ```powershell
   .\scripts\doctor.ps1
   ```

   - 重点关注：
     - `plugin installed` 是否为 `OK`
     - `keyword library / ui menu / i18n` 是否为 `OK`
     - 下方是否有 `MISSING / BLOCKERS`（红色）

2. **检查运行模式**：

   ```powershell
   .\scripts\router.ps1 status
   ```

   典型安全默认状态：

   - `plugin.enabled: True`
   - `ruleEngineEnabled: True`
   - `routerLlmEnabled: False`
   - `switchingEnabled: False`

3. **启动控制 UI**：

   ```powershell
   cd .\tools\soft-router-suggest
   .\ui-menu.ps1
   ```

   - 确认：
     - 主菜单可正常显示
     - 语言切换（zh / en / both）正常
     - 关键词列表/删除、路由测试可用

---

## 2. 日常运行模式切换

安装完成后，日常只需使用 `router.ps1` 即可：

```powershell
cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub

# 查看当前模式
.\scripts\router.ps1 status

# FAST：关闭插件（回到默认模型链）
.\scripts\router.ps1 fast

# RULES：插件 + 规则引擎 + 自动切换（无 LLM sidecar）
.\scripts\router.ps1 rules

# LLM：插件 + 规则引擎 + Router LLM + 自动切换
.\scripts\router.ps1 llm

# Sidecar 管理（仅 LLM 需要）
.\scripts\router.ps1 sidecar-start
.\scripts\router.ps1 sidecar-stop
```

> 详细含义可参考仓库根目录的 `README.md` 与 `docs/USAGE_MANUAL.txt`。

---

## 3. 修复流程总览

> 本节的 **“修复”** 指的是：
>
> - 文件丢失 / 版本不一致
> - UI 报错 / 打不开
> - `doctor.ps1` 报 MISSING/BLOCKERS
> - `router.ps1 status` 显示配置异常
>
> 目标是在 **不泄露隐私配置** 的前提下，恢复到干净可用的状态。

推荐统一思路：

1. **先运行 `doctor.ps1` 看问题是什么**（只读检查，不会改文件）
2. 再根据问题类型选择：
   - **已知 bug 修复 / 需要把 repo 最新 plugin 同步到本机**：优先 `openclaw-router repair`（或 `openclaw-router install`）
   - 只重装插件和工具：`install.ps1`
   - 重置工具库到基线版本：`RESET_TO_BASELINE.ps1`
   - 调整/重置运行模式：`router.ps1 fast/rules/llm`
   - 必要时，使用备份的 `openclaw.json.bak.*` 回滚

> 关键点：`openclaw-router doctor` 不会修复任何东西；真正“修复并同步文件”的是 `install/repair`。

下面按常见场景拆开说明。

---

## 4. 常见修复场景与操作步骤

### 场景 1：doctor 报插件或工具文件缺失

典型错误示例：

- `plugin installed: MISSING`
- `keyword library: MISSING`
- `ui menu: MISSING`
- `i18n zh: MISSING` 等

#### 处理步骤

1. 在仓库根目录运行：

   ```powershell
   cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
   .\scripts\install.ps1
   ```

   - 脚本会：
     - 重新复制插件文件到 `%Workspace%\.openclaw\extensions\soft-router-suggest`
     - 重新同步整个 `tools\soft-router-suggest` 到工作区
     - 重新写入安全默认配置到 `openclaw.json`（并保留带时间戳备份）

2. 重新运行 doctor：

   ```powershell
   .\scripts\doctor.ps1
   ```

   - 确认所有 **关键文件** 项为 `OK`

3. 按需重新设置模式（如之前希望启用自动切换）：

   ```powershell
   .\scripts\router.ps1 rules    # 或 llm / fast
   ```

---

### 场景 2：UI 菜单行为异常 / 关键词库被改坏

表现：

- `ui-menu.ps1` 报错
- 菜单显示错乱
- 关键词列表/删除行为不符合预期

#### 处理步骤

1. 确认你当前是否在 **工作区** 的工具目录：

   ```powershell
   cd %USERPROFILE%\.openclaw\workspace\tools\soft-router-suggest
   ```

2. 如发现 `keyword-library.json` / `keyword-overrides.user.json` 被手工改坏，建议：

   - 使用仓库中提供的基线重置脚本：

     ```powershell
     cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub\tools\soft-router-suggest
     .\RESET_TO_BASELINE.ps1         # 正常会有确认提示
     # 或强制跳过确认：
     # .\RESET_TO_BASELINE.ps1 -Force
     ```

     该脚本会把以下文件恢复到基线提交版本：

     - `keyword-library.json`
     - `keyword-overrides.user.json`
     - `model-catalog.cache.json`

3. 重置后，为确保工作区与仓库完全同步，建议再执行一次安装脚本：

   ```powershell
   cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
   .\scripts\install.ps1
   ```

4. 最后重新打开 UI：

   ```powershell
   cd %USERPROFILE%\.openclaw\workspace\tools\soft-router-suggest
   .\ui-menu.ps1
   ```

---

### 场景 3：`router.ps1 status` 显示配置异常 / 模式切不回来

表现：

- `ruleEngineEnabled` / `routerLlmEnabled` / `switchingEnabled` 状态和预期不符
- 之前试验过多种模式，感觉 `openclaw.json` 被折腾乱了

#### 处理步骤

1. 首先建议将当前配置做一次人工备份（可选）：

   ```powershell
   cd %USERPROFILE%\.openclaw
   Copy-Item openclaw.json openclaw.json.bak.manual.<yyyyMMdd-HHmmss>
   ```

2. 使用 `install.ps1` 重新写入安全默认配置（不会删除其他插件配置）：

   ```powershell
   cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
   .\scripts\install.ps1
   ```

3. 再用 `router.ps1` 指定你想要的工作模式：

   ```powershell
   # 只开启规则引擎 + 自动切换
   .\scripts\router.ps1 rules

   # 或完整开启 LLM sidecar
   .\scripts\router.ps1 sidecar-start
   .\scripts\router.ps1 llm
   ```

4. 如仍感觉配置异常，可以对比 `openclaw.json` 与 `openclaw.json.bak.*` 差异，必要时手工回滚其中一份备份（注意不要把 token 等敏感信息提交到 GitHub 仓库）。

---

### 场景 4：迁移到新 Windows 机器后需要“修复”

此场景基本等价于“在新机器上重装插件”：

1. 在新机器上按 OpenClaw 官方指南安装并完成 `openclaw configure`。
2. 克隆本仓库到任意位置（推荐桌面或工作目录），如：

   ```powershell
   git clone https://github.com/<your-username>/OpenClaw-SoftRouter.git %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
   ```

3. 直接执行安装脚本：

   ```powershell
   cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   .\scripts\install.ps1
   .\scripts\doctor.ps1
   ```

4. 按需用 `router.ps1` 设置运行模式，并从工作区路径启动 UI 即可。

如需更细致的迁移注意事项，可以参考：

- `docs/WINDOWS_MIGRATION_GUIDE.md`

---

## 5. 卸载流程（禁用 vs 彻底清除）

卸载分为两层：

1. **禁用插件（不再参与路由）**
2. **删除插件与工具文件（工作区干净）**

### 5.1 仅禁用插件（推荐日常“停用”方式）

> 适用于：暂时不想用 soft-router-suggest，但保留以后随时再启用的可能。

两种方式都可以：

#### 方式 A：使用 `uninstall.ps1`（只禁用）

```powershell
cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
.\scripts\uninstall.ps1
```

效果：

- `openclaw.json` 中 `plugins.entries["soft-router-suggest"].enabled = false`
- 不删除任何插件/工具文件
- 会生成备份：`openclaw.json.bak.soft-router-suggest.uninstall.<timestamp>`

#### 方式 B：使用 `router.ps1 fast`

```powershell
cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
.\scripts\router.ps1 fast
```

效果：

- `plugin.enabled = false`
- **同时移除该插件下的 `config` 字段**（避免后续警告）

> 两者区别：
>
> - `uninstall.ps1`：保留 config，仅把 `enabled` 设为 false
> - `router.ps1 fast`：直接移除 config，彻底回到“无此插件配置”的状态

### 5.2 彻底卸载（含文件删除）

> 适用于：准备公开机器镜像 / 不再需要该插件 / 希望工作区无残留。

执行：

```powershell
cd %USERPROFILE%\\Desktop\\OpenClaw-SoftRouter-GitHub
.\scripts\uninstall.ps1 -RemoveFiles
```

效果：

1. 在 `openclaw.json` 中禁用插件（同上）
2. 删除以下路径（如存在）：

   ```text
   %Workspace%\.openclaw\extensions\soft-router-suggest
   %Workspace%\tools\soft-router-suggest
   ```

3. 保留一份带时间戳的 `openclaw.json` 备份，便于必要时回滚。

> 注意：卸载脚本不会删除你的 OpenClaw 其它配置、token、sessions 等；仅涉及 soft-router-suggest 插件本身。

---

## 6. 故障排查速查表

| 症状 | 建议命令顺序 | 说明 |
|------|--------------|------|
| doctor 报 `plugin installed: MISSING` | `install.ps1` → `doctor.ps1` | 插件目录缺失或未安装 |
| doctor 报 keyword / UI / i18n MISSING | `install.ps1` → `doctor.ps1` | 工具目录未同步或被删 |
| UI 菜单报错 / 显示错乱 | `RESET_TO_BASELINE.ps1` → `install.ps1` → `ui-menu.ps1` | 关键词库/配置被改坏 |
| 路由模式状态乱 | `install.ps1` → `router.ps1 status` → `router.ps1 rules/fast/llm` | 重新写入安全配置再设置模式 |
| 只想暂时关闭插件 | `router.ps1 fast` 或 `uninstall.ps1` | 前者移除 config，后者保留 config |
| 准备彻底清理插件 | `uninstall.ps1 -RemoveFiles` | 禁用插件 + 删除扩展/工具目录 |

---

## 7. 发布到 GitHub 前的额外注意事项

在真正把仓库推送到 GitHub 之前，请务必再确认：

1. 仓库内 **没有**：
   - 真实的 `openclaw.json`
   - token / apiKey / 邮箱 / 聊天记录
   - 本机路径等隐私信息
2. 当前安装/修复/卸载说明与脚本行为一致：
   - `scripts/install.ps1`、`scripts/uninstall.ps1`、`scripts/doctor.ps1` 已全部同步当前实现
   - 本文描述的命令在你自己的 Windows 环境中已完整跑通
3. 如有调整，请同步更新：
   - `README.md`
   - `docs/USAGE_MANUAL.txt`
   - `tools/soft-router-suggest/README_SETTINGS.md`
   - `UPLOAD_CHECKLIST.md`

这样可以保证：

- 别人在任何 Windows 机器上按本文即可完成 **安装 → 验证 → 修复 → 卸载** 全链路
- 仓库对外公开时不会泄露你的个人配置与凭据。


