# OpenClaw Soft Router - Release Summary

## 🚀 版本概览
- **版本**: 当前提交前同步版
- **类型**: Keyword-library + bilingual UI stabilized release prep
- **状态**: Ready for commit preparation

## ✨ 当前核心能力
1. **六分类关键词路由**: 基于 `keyword-library.json` 的 6 类路由
2. **多模式支持**: FAST / RULES / LLM 三种运行模式
3. **安全默认安装**: 默认关闭自动切换，避免干扰日常使用
4. **双语控制 UI**: `zh / en / both` 三种显示模式
5. **本地路由测试**: 不调用 LLM 的 route preview / route test
6. **用户可维护关键词覆盖**: strong / weak / negative 三层结构
7. **面向普通用户的快速入口**: 已新增 `docs/QUICK_START.zh-CN.md`，突出最短命令与机制解释

## 🛠️ 近期关键改进
- 路由体系简化为 6 类：
  - `strategy`
  - `coding`
  - `vision`
  - `support`
  - `general`
  - `chat`
- 修复 local-proxy `modelOverride` 归一化问题，避免：
  - `502 unknown provider for model local-proxy/gpt-5.2`
- PowerShell UI 双语化与语言持久化
- 新增类别后可直接继续配置：关键词 / 模型 / 优先级
- 关键词查看改为显示“实际生效关键词”
- 删除关键词改为“按编号选择”
- 路由测试改为“单行输入，回车直接提交”
- 安装脚本改为同步整套当前 `tools/soft-router-suggest/` 目录，避免 repo 与运行时 UI 脱节

## 📁 当前关键文件结构
```text
plugin/
  index.ts
  openclaw.plugin.json
  keyword-library.ts
  weighted-routing-engine.ts

tools/soft-router-suggest/
  keyword-library.json
  keyword-library.schema.json
  model-priority.json
  keyword-overrides.user.example.json
  keyword-overrides.user.schema.json
  ui-menu.ps1
  manage-overrides.ps1
  add-kind.ps1
  set-kind-models.ps1
  route-preview.ps1
  ui.settings.json
  i18n/
  README_SETTINGS.md
  KIND_GUIDE.zh-CN.md

scripts/
  install.ps1
  uninstall.ps1
  doctor.ps1
  router.ps1
```

## 🧪 当前验证重点
- ✅ Windows PowerShell 5.1 脚本解析通过
- ✅ keyword-library 6 类结构可用
- ✅ local-proxy model override normalization 已验证
- ✅ UI 文案与交互已大体统一到当前实现
- ✅ 安装 / doctor 已向当前工具链同步

## 📚 配套文档
- `README.md`
- `docs/QUICK_START.zh-CN.md`（先看这个：最短命令 + 关键词加权机制人话版）
- `docs/USAGE_MANUAL.txt`（完整命令手册）
- `tools/soft-router-suggest/README_SETTINGS.md`（自定义说明）
- `docs/TECHNICAL.md`
- `tools/soft-router-suggest/KIND_GUIDE.zh-CN.md`

## 🔄 当前发布定位
这是一次“提交前全面同步整理”版本，重点不是加新大功能，而是：

- 统一当前 6 类设计
- 统一 UI 与文档
- 统一安装/运行时同步逻辑
- 让普通用户先看到最短命令，而不是冗长命令手册
- 让普通用户先理解关键词加权机制，再安全自定义词库
- 为后续 commit / release 做干净准备
