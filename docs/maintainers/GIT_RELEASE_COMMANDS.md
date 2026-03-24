# GitHub 发布命令清单（当前 6 类同步版）

## 1. 提交前检查

```powershell
cd %USERPROFILE%\Desktop\OpenClaw-SoftRouter-GitHub

git status --short
.\scripts\doctor.ps1
```

## 2. 创建提交

> 提交信息请围绕“6 类同步、UI 稳定化、安装同步修复”来写，不要再沿用旧的 9 分类说法。

示例：

```powershell
git add .
git commit -m "feat: sync 6-kind router docs, UI, and install flow

- align repo docs with current keyword-library based 6-kind design
- sync PowerShell UI behavior and bilingual control text
- copy full soft-router tool directory during install
- stabilize keyword viewing/removal and route preview UX
"
```

## 3. 打标签（可选）

```powershell
git tag -a v0.4.1 -m "OpenClaw Soft Router: 6-kind sync and UI stabilization"
```

## 4. 推送到远程仓库

当前远程仓库已配置为：

```text
https://github.com/wangmuyang111/openclaw-router.git
```

如需首次设置远程，可使用：

```powershell
git remote remove origin 2>$null
git remote add origin "https://github.com/wangmuyang111/openclaw-router.git"
git branch -M main
git push -u origin main
```

如果打了标签：

```powershell
git push origin v0.4.1
```

## 5. Release 说明建议

Title:
- `v0.4.1: 6-kind sync and bilingual UI stabilization`

Description 建议包含：
- current simplified 6-kind routing
- keyword-library as the active runtime source
- bilingual PowerShell UI
- safer install defaults
- keyword list / delete UX improvements
- route test single-line submit

## 6. 发布前人工确认

确认以下叙述全部一致：
- 当前是 **6 类**，不是 9 类
- 当前主运行时来源是 `keyword-library.json`
- 当前 UI 支持双语
- 当前删除关键词是“按编号选择”
- 当前路由测试是“单行回车提交”
