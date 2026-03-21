# GitHub 提交分组清单（Soft Router Suggest / npm + TypeScript + Cross-platform 版）

> 用途：把当前这批“从 Windows 脚本仓库收口到可公开发布工程”的改动，按可审阅、可回滚的方式分组提交。
>
> 这份清单以**当前实际改动**为准，不再沿用早期仅面向 Windows 的旧分组。

---

## 组 1：建立 TypeScript / Node CLI 工程骨架

**建议提交信息：**

```text
feat: add TypeScript CLI skeleton for cross-platform lifecycle commands
```

**建议包含文件：**

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `src/cli/index.ts`
- `src/cli/shared.ts`
- `src/cli/doctor.ts`
- `src/cli/install.ts`
- `src/cli/repair.ts`
- `src/cli/uninstall.ts`
- `src/plugin/README.md`
- `docs/ARCHITECTURE_PLAN.md`

**本组重点：**

- 引入标准 npm + TypeScript 项目结构
- 把 `npm install` 变成安全、非破坏性的依赖安装行为
- 建立跨平台 Node CLI 主入口
- 明确后续平台 wrapper 只是薄封装，核心逻辑在 Node CLI

---

## 组 2：实现真实生命周期命令

**建议提交信息：**

```text
feat: implement doctor install repair and uninstall in Node CLI
```

**建议包含文件：**

- `src/cli/doctor.ts`
- `src/cli/install.ts`
- `src/cli/repair.ts`
- `src/cli/uninstall.ts`
- `src/cli/shared.ts`
- `package.json`

**本组重点：**

- `doctor`：只读检查 OpenClaw home/workspace/plugin/tools/sidecar
- `install`：支持 `--dry-run`，复制插件与工具，备份并修补 `openclaw.json`
- `repair`：保守实现为 `doctor + install`，不做卸载式修复
- `uninstall`：支持仅禁用插件，以及 `--remove-files` 删除工作区文件

---

## 组 3：Windows wrapper 收口到 Node CLI

**建议提交信息：**

```text
refactor: route Windows PowerShell lifecycle scripts through Node CLI wrappers
```

**建议包含文件：**

- `scripts/doctor.ps1`
- `scripts/install.ps1`
- `scripts/repair.ps1`
- `scripts/uninstall.ps1`
- `scripts/doctor.legacy.ps1`
- `scripts/install.legacy.ps1`
- `scripts/uninstall.legacy.ps1`

**本组重点：**

- Windows 入口继续保留 PowerShell 使用体验
- 真实逻辑优先走 Node CLI
- 旧 PowerShell 实现保留为 `.legacy.ps1`，便于回退
- `uninstall.ps1 -RemoveFiles` 与 Node CLI `--remove-files` 语义对齐

---

## 组 4：新增 Linux wrapper 与跨平台入口

**建议提交信息：**

```text
feat: add Linux shell wrappers for cross-platform lifecycle flows
```

**建议包含文件：**

- `scripts/_node_cli_wrapper.sh`
- `scripts/doctor.sh`
- `scripts/install.sh`
- `scripts/repair.sh`
- `scripts/uninstall.sh`

**本组重点：**

- 为 Linux 提供与 Windows 对等的生命周期入口
- 所有 shell 脚本保持薄封装
- 调用统一的 `dist/cli/index.js`

---

## 组 5：CI 升级为真实构建 + smoke test

**建议提交信息：**

```text
ci: add Windows and Ubuntu build and lifecycle smoke tests
```

**建议包含文件：**

- `.github/workflows/ci.yml`

**本组重点：**

- Windows + Ubuntu matrix
- Node 20
- `npm install` + `npm run build`
- fake `OPENCLAW_HOME` / `OPENCLAW_WORKSPACE`
- fake `openclaw --version` shim
- 真实生命周期 smoke test：
  - `doctor`
  - `install --dry-run`
  - `install`
  - `repair --dry-run`
  - `repair`
  - `uninstall`
  - `uninstall --remove-files`
- wrapper smoke test：
  - Linux `.sh`
  - Windows `.ps1`
- `doctor` 在 remove-files 之后的**预期失败断言**

---

## 组 6：文档同步到 npm + cross-platform 口径

**建议提交信息：**

```text
docs: align README and deployment docs with npm and cross-platform flow
```

**建议包含文件：**

- `README.md`
- `docs/WINDOWS_INSTALL_REPAIR_UNINSTALL.zh-CN.md`
- `docs/LINUX_DEPLOYMENT.md`
- `docs/NPM_INSTALL.md`
- `docs/ARCHITECTURE_PLAN.md`

**本组重点：**

- README 首屏从“Windows-only distribution”收口到“cross-platform project”
- 增加 Windows / Linux / Node CLI 三套入口说明
- 明确 `npm install` 安全、非破坏
- 明确 `repair` / `uninstall` / wrapper / CLI 的实际用法

---

## 组 7：发布辅助文档与仓库卫生

**建议提交信息：**

```text
chore: update release metadata checklist and repository hygiene
```

**建议包含文件：**

- `GIT_RELEASE_COMMANDS.md`
- `UPLOAD_CHECKLIST.md`
- `COMMIT_GROUPS.zh-CN.md`
- `.gitignore`
- `package.json`

**本组重点：**

- 修正仓库远程 metadata（repository / bugs / homepage）
- 更新发布命令模板到真实 GitHub remote
- 检查并补充 `.gitignore`
- 把提交计划改成当前实际工程化改动的分组方式

---

## 当前建议的提交顺序

1. **组 1：TypeScript / Node CLI 工程骨架**
2. **组 2：真实生命周期命令**
3. **组 3：Windows wrapper 收口**
4. **组 4：Linux wrapper**
5. **组 5：CI**
6. **组 6：文档同步**
7. **组 7：发布辅助文档与仓库卫生**

---

## 提交前最后核对

提交前建议至少再确认以下几点：

1. `npm install` 不会修改用户 OpenClaw 环境
2. `npm run build` 成功
3. `node ./dist/cli/index.js doctor` 可运行
4. Windows wrapper 与 Linux wrapper 至少完成基础 smoke test
5. 文档统一说明：
   - 当前是 **6 类**
   - 运行时主来源是 `keyword-library.json`
   - `repair` 是保守修复，不是先删后装
   - `uninstall --remove-files` 是破坏性操作，需要谨慎
6. 不提交：
   - `tmp_openclaw.json*`
   - 真实 `openclaw.json`
   - token / auth / 私人日志 / 会话数据
