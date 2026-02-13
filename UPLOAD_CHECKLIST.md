# GitHub 项目上传前检查清单

## ✅ 已完成的文件

### 核心文件
- ✅ README.md - 项目介绍和快速开始
- ✅ LICENSE - MIT 许可证
- ✅ .gitignore - 忽略规则（日志、配置、备份）
- ✅ package.json - Node.js 项目元数据
- ✅ CHANGELOG.md - 版本更新历史
- ✅ CONTRIBUTING.md - 贡献指南

### 文档
- ✅ docs/TECHNICAL.md - 技术文档
- ✅ docs/SECURITY.md - 安全检查清单
- ✅ docs/USAGE_MANUAL.txt - 使用手册

### 插件代码
- ✅ plugin/index.ts - 主插件代码 (72KB)
- ✅ plugin/openclaw.plugin.json - 插件配置

### 脚本
- ✅ scripts/install.ps1 - 安装脚本
- ✅ scripts/doctor.ps1 - 健康检查
- ✅ scripts/router.ps1 - 路由管理
- ✅ scripts/uninstall.ps1 - 卸载脚本

### 配置文件
- ✅ tools/soft-router-suggest/model-priority.json - 模型优先级
- ✅ tools/soft-router-suggest/router-rules.json - 路由规则

### 可选组件
- ✅ router-sidecar/ - LLM 路由服务

### CI/CD
- ✅ .github/workflows/ci.yml - GitHub Actions 工作流

---

## 📝 上传前必须做的事

### 1. 初始化 Git 仓库

```powershell
cd <YOUR_LOCAL_PATH>\OpenClaw-SoftRouter-GitHub
git init
git add .
git commit -m "Initial commit: OpenClaw Soft Router v0.4.0"
```

### 2. 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名：`OpenClaw-SoftRouter` 或 `soft-router-suggest`
3. 描述：`OpenClaw plugin for intelligent model routing with rule engine`
4. 公开/私有：根据需要选择
5. **不要**勾选 "Add README" / "Add .gitignore" / "Choose a license"（已有）

### 3. 连接远程仓库并推送

```powershell
# 替换 YOUR_USERNAME 为你的 GitHub 用户名
git remote add origin https://github.com/YOUR_USERNAME/OpenClaw-SoftRouter.git
git branch -M main
git push -u origin main
```

### 4. 更新 package.json 中的 URL

编辑 `package.json`，将：
```json
"url": "git+https://github.com/YOUR_USERNAME/OpenClaw-SoftRouter.git"
```
替换为实际的仓库 URL。

### 5. 最后检查

运行安全检查：
```powershell
# 检查是否包含敏感信息（邮箱、绝对路径、token）
Get-ChildItem -Recurse -File | Select-String -Pattern "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|C:\\Users\\[^\\]+|token\\\"\\s*:\\s*\\\"" 

# 应该没有匹配项！
```

---

## 🎯 推荐的 GitHub 仓库设置

### Topics (标签)
添加以下标签以提高可发现性：
- `openclaw`
- `plugin`
- `llm-routing`
- `model-router`
- `ai`
- `powershell`
- `typescript`

### About
- Description: `OpenClaw plugin for intelligent model routing with rule engine and LLM sidecar`
- Website: 留空或填写文档链接
- Topics: 如上

### Settings
- ✅ Issues: 启用
- ✅ Wiki: 可选
- ✅ Projects: 可选
- ✅ Discussions: 启用（用于社区讨论）

---

## 📦 发布第一个版本

1. 创建 Release:
   - Tag: `v0.4.0`
   - Title: `OpenClaw Soft Router v0.4.0`
   - Description: 复制 CHANGELOG.md 的内容

2. 附加文件（可选）:
   - ZIP 压缩包（便于下载）

---

## 🚀 准备就绪！

所有必需文件已添加到项目中：
- LICENSE ✅
- package.json ✅
- CHANGELOG.md ✅
- CONTRIBUTING.md ✅
- .github/workflows/ci.yml ✅

现在可以安全地上传到 GitHub 了！
