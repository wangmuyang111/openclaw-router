# GitHub 项目上传前检查清单

## ✅ 当前应包含的关键文件

### 核心文档
- README.md
- LICENSE
- .gitignore
- CHANGELOG.md
- CONTRIBUTING.md
- RELEASE_SUMMARY.md
- docs/QUICK_START.zh-CN.md

### 技术文档
- docs/TECHNICAL.md
- docs/SECURITY.md
- docs/USAGE_MANUAL.txt

### 插件代码
- plugin/index.ts
- plugin/openclaw.plugin.json
- plugin/keyword-library.ts
- plugin/weighted-routing-engine.ts

### 生命周期脚本 / CLI
- scripts/install.ps1
- scripts/uninstall.ps1
- scripts/doctor.ps1
- scripts/repair.ps1
- scripts/router.ps1
- scripts/install.sh
- scripts/uninstall.sh
- scripts/doctor.sh
- scripts/repair.sh
- src/cli/index.ts
- src/cli/install.ts
- src/cli/uninstall.ts
- src/cli/doctor.ts
- src/cli/repair.ts
- tsconfig.json

### 当前工具目录
- tools/soft-router-suggest/keyword-library.json
- tools/soft-router-suggest/keyword-library.schema.json
- tools/soft-router-suggest/model-priority.json
- tools/soft-router-suggest/keyword-overrides.user.example.json
- tools/soft-router-suggest/keyword-overrides.user.schema.json
- tools/soft-router-suggest/ui-menu.ps1
- tools/soft-router-suggest/manage-overrides.ps1
- tools/soft-router-suggest/add-kind.ps1
- tools/soft-router-suggest/set-kind-models.ps1
- tools/soft-router-suggest/route-preview.ps1
- tools/soft-router-suggest/ui.settings.json
- tools/soft-router-suggest/i18n/
- tools/soft-router-suggest/README_SETTINGS.md
- tools/soft-router-suggest/KIND_GUIDE.zh-CN.md

### 可选组件
- router-sidecar/

---

## 📝 上传前必须做的事

### 1. 检查当前版本叙述是否一致
确认仓库各处不再停留在这些旧说法：
- `8+1 categories`
- `9-category system`
- `paste-only keyword UI`
- `END to finish` 路由测试
- 把 `router-rules.json` 当成当前主运行时来源

当前应统一为：
- **6 类**
- **keyword-library 为主**
- **关键词删除支持按编号选择**
- **路由测试为单行回车提交**

### 2. 检查敏感信息
```powershell
Get-ChildItem -Recurse -File | Select-String -Pattern "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|C:\Users\[^\]+|token\"\s*:\s*\""
```

### 3. 构建、安装与检查
```powershell
npm install
npm run build
.\scripts\doctor.ps1
.\scripts\install.ps1
.\scripts\repair.ps1
.\scripts\router.ps1 status
```

如需补 Linux 自测，至少再跑：

```bash
chmod +x scripts/*.sh
./scripts/doctor.sh
./scripts/install.sh --dry-run
./scripts/repair.sh --dry-run
```

### 4. 检查当前 git 状态
```powershell
git status --short
```

### 5. 只在确认文档/脚本/运行时一致后再提交
避免出现：
- 仓库代码是新 UI
- 安装脚本仍同步旧文件
- 文档还写旧分类
- README 没有突出快速上手入口
- 用户看不懂关键词加权机制，无法安全自定义

---

## 🎯 推荐仓库说明
Description:
`OpenClaw plugin for keyword-library based model routing with bilingual PowerShell control UI`

Topics:
- `openclaw`
- `plugin`
- `llm-routing`
- `model-router`
- `powershell`
- `typescript`
- `keyword-routing`

---

## 📦 建议首发前再确认
- 当前 6 类是否稳定
- local-proxy model override normalization 是否保留
- install / uninstall / doctor 是否同步当前工具目录
- README / TECHNICAL / USAGE / README_SETTINGS 是否一致
