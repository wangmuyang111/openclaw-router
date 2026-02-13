# OpenClaw Soft Router v0.4.0 - Release Summary

## 🚀 版本概览
- **版本**: v0.4.0 (2026-02-12)
- **类型**: Major feature release
- **状态**: Production-ready

## ✨ 核心功能
1. **智能模型路由**: 基于关键词规则引擎的 8+1 类别路由
2. **多模式支持**: FAST / RULES / LLM 三种运行模式
3. **跨提供商容错**: 失效时自动降级到备用模型链
4. **可移植部署**: 无绝对路径依赖，支持一键安装

## 🛠️ 主要改进
- **规则引擎重构**: 全新的 9 分类系统（planning/coding/vision/chat等）
- **路径优化**: 消除所有硬编码绝对路径，支持环境变量
- **中文支持**: UTF-8 编码修复，中文关键词正常显示
- **配置管理**: 动态配置加载，支持实时模式切换

## 📁 文件结构
```
├── plugin/                    # TypeScript 插件源码
│   ├── index.ts            # 主插件入口 (45KB)
│   ├── classification-engine.ts  # 分类引擎 (8.5KB)
│   ├── classification-loader.ts  # 分类加载器 (4KB)
│   └── openclaw.plugin.json    # 插件配置
├── tools/soft-router-suggest/  # 配置文件
│   ├── router-rules.json   # 路由规则
│   ├── model-priority.json # 模型优先级
│   ├── classification-rules.json  # 分类规则
│   ├── model-tags.json     # 模型标签
│   ├── router-config.ps1   # 路由配置脚本
│   └── validate-classification.ps1 # 验证脚本
├── scripts/                 # 运维脚本
│   ├── install.ps1         # 一键安装
│   ├── uninstall.ps1       # 一键卸载
│   ├── doctor.ps1          # 环境检查
│   └── router.ps1          # 模式切换
└── docs/                    # 文档
```

## 🧪 测试状态
- ✅ Windows PowerShell 5.1 兼容性
- ✅ OpenClaw Gateway 集成测试
- ✅ 中文关键词匹配准确性
- ✅ 模型切换与降级机制
- ✅ 安装/卸载流程自动化

## 📋 发布清单
- [x] 代码审查完成
- [x] 功能测试通过  
- [x] 安全扫描无敏感信息
- [x] 文档更新完成
- [x] 脚本语法检查通过
- [x] 迁移兼容性验证

## 🔗 关联项目
- OpenClaw 主仓库: https://github.com/openclaw/openclaw
- 插件文档: docs/TECHNICAL.md
- 使用手册: docs/USAGE_MANUAL.txt
- 迁移指南: docs/WINDOWS_MIGRATION_GUIDE.md

## 📦 安装方式
```powershell
# 克载
git clone https://github.com/<user>/soft-router-suggest.git
cd soft-router-suggest

# 安装（会备份 openclaw.json）
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install.ps1
```

## 🔄 升级路径
- **旧版用户**: 直接覆盖文件后重启 Gateway
- **全新安装**: 按上述安装方式执行

---
*Generated: 2026-02-12 12:14:00 GMT+8*