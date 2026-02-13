# GitHub 发布命令清单

## 📦 1. 初始化本地仓库

```powershell
# 进入项目目录
cd C:\Users\muyang\Desktop\OpenClaw-SoftRouter-GitHub

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "feat: OpenClaw Soft Router v0.4.0 initial release

- Smart routing plugin with rule engine
- 9-category classification system
- Portable installation (no absolute paths)
- Windows PowerShell 5.1 compatible
- UTF-8 encoding support for Chinese keywords
"
```

## 🏷️ 2. 创建并推送标签

```powershell
# 创建 v0.4.0 标签
git tag -a v0.4.0 -m "Release v0.4.0: Smart Routing Plugin with Rule Engine

Features:
- 9-category intelligent routing (planning, coding, vision, etc.)
- Portable deployment (no hardcoded paths)
- UTF-8 support for Chinese keywords
- Windows PowerShell 5.1 compatibility
- Auto-fallback model chains

Breaking Changes:
- New classification-rules.json structure
- Updated model-priority.json schema
- Enhanced router-rules.json with bilingual keywords
"

# 查看标签信息
git tag -l -n1
```

## 🚀 3. 连接远程仓库并推送

```powershell
# 替换 YOUR_USERNAME 为你的 GitHub 用户名
$GITHUB_USER = "YOUR_USERNAME"
$REPO_NAME = "OpenClaw-SoftRouter"

# 添加远程仓库
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# 推送主分支
git branch -M main
git push -u origin main

# 推送标签
git push origin v0.4.0
```

## 🔍 4. 验证推送结果

```powershell
# 检查远程仓库
git remote -v

# 检查推送状态
git status

# 查看推送的标签
git ls-remote --tags origin
```

## 📝 5. 在 GitHub 上创建 Release

访问: `https://github.com/YOUR_USERNAME/OpenClaw-SoftRouter/releases/new`

- **Tag**: 选择 `v0.4.0`
- **Title**: `v0.4.0: Smart Routing Plugin with Rule Engine`
- **Description**: 使用 RELEASE_SUMMARY.md 的内容

## 🧪 6. 可选项：预发布验证

```powershell
# 在干净环境中测试安装
# （需要另一台机器或虚拟机）

# 1. 克载仓库
git clone https://github.com/YOUR_USERNAME/OpenClaw-SoftRouter.git
cd OpenClaw-SoftRouter

# 2. 运行健康检查
.\scripts\doctor.ps1

# 3. 安装插件
.\scripts\install.ps1

# 4. 测试模式切换
.\scripts\router.ps1 status
.\scripts\router.ps1 rules
.\scripts\router.ps1 fast
```

---
*注意：记得替换 YOUR_USERNAME 和仓库名*