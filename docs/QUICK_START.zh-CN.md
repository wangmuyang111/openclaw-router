# Soft Router 快速上手（先看这个）

> 如果你第一次接触这个项目，先看这篇。  
> 目标只有两个：
>
> 1. 用**最短命令**先跑起来  
> 2. 用**人话**理解“关键词加权机制”，这样你后面才知道怎么自定义

---

## 1. 先记住：你应该看哪份文档？

### 只想快速上手
看这篇：
- `docs/QUICK_START.zh-CN.md`

### 想看完整命令手册
看这里：
- `docs/USAGE_MANUAL.txt`

### 想自定义关键词 / 模型 / UI 设置
看这里：
- `tools/soft-router-suggest/README_SETTINGS.md`

### 想看安装 / 修复 / 卸载全流程
看这里：
- Windows：`docs/WINDOWS_INSTALL_REPAIR_UNINSTALL.zh-CN.md`
- Linux：`docs/LINUX_DEPLOYMENT.md`

一句话区分：
- **这篇** = 快速上手
- **USAGE_MANUAL** = 完整命令手册
- **README_SETTINGS** = 自定义说明

---

## 2. 最短上手命令

### Windows（推荐最短路径）

```powershell
npm install
npm run build
npm run windows:install
npm run windows:doctor
```

安装完成后，查看状态：

```powershell
.\scripts\router.ps1 status
```

打开控制 UI：

```powershell
cd .\tools\soft-router-suggest
.\ui-menu.ps1
```

---

### Linux（推荐最短路径）

```bash
npm install
npm run build
chmod +x scripts/*.sh
./scripts/install.sh
./scripts/doctor.sh
```

---

### 如果你只想先做“安全试跑”

```bash
npm install
npm run build
node ./dist/cli/index.js install --dry-run
node ./dist/cli/index.js doctor
```

---

## 3. 模式切换，只记这 3 个就够了

查看当前模式：

```powershell
.\scripts\router.ps1 status
```

启用规则路由（最常用）：

```powershell
.\scripts\router.ps1 rules
```

回到最安全、最快的默认链路：

```powershell
.\scripts\router.ps1 fast
```

说明：
- `fast` = 关闭插件，走默认模型链
- `rules` = 开启规则引擎
- `llm` = 规则引擎 + Router LLM sidecar

### 全局命令（安装 / 修复后自动同步）

安装或 repair 后，会自动刷新全局命令；卸载时会自动删除。

```powershell
openclaw-router status
openclaw-router fast
openclaw-router rules
openclaw-router llm
openclaw-router doctor
openclaw-router install
openclaw-router repair
openclaw-router uninstall

openclaw-soft-router status
```

说明：
- 当前仓库不会直接改 OpenClaw 主程序，把命令硬塞进 `openclaw <子命令>`。
- 这里采用的是**伴生全局命令**方案，效果接近原生命令，而且 install / repair / uninstall 会自动同步。

---

## 4. 关键词加权机制（人话版）

你可以把它理解成：

> **每个类别都在“抢分”，最后谁分高，就更可能被判给谁。**

比如 6 个类别：
- `strategy`
- `coding`
- `vision`
- `support`
- `general`
- `chat`

系统看到一条输入后，会给每个类别打分。

### 三类关键词的直觉含义

#### `strong`
这是**强信号词**。  
看到它，某个类别会加很多分。

例如：
- `coding.strong` 里放：`TypeError`、`stack trace`、`bug`
- 那么用户一说这些词，`coding` 分数就会明显升高

#### `weak`
这是**辅助信号词**。  
会加分，但没有 `strong` 那么重。

适合放：
- 有关联，但不够“一锤定音”的词
- 容易出现在很多场景里的提示词

#### `negative`
这是**排除词 / 反向词**。  
看到它，某个类别会被扣分，甚至被压下去。

适合放：
- 容易让这个类别误判的词
- 明显更像其它类别核心特征的词

---

## 5. 你可以把它想成这个简单公式

不是源码里的精确公式，但理解上可以这么记：

```text
最终分数 ≈ strong 加大分 + weak 加小分 - negative 扣分 + 元数据加分
```

其中“元数据加分”包括这类信号：
- 有图片 → `vision` 往往会额外加分
- 有代码块 → `coding` 往往会额外加分

最后：
- 谁分更高
- 谁达到了最低阈值
- 谁满足必要条件

谁就更可能成为最终类别。

---

## 6. 怎么自定义，最不容易改坏？

### strong 里放什么？
放**看到就几乎能确定类别**的词。

适合：
- 很强的技术错误名
- 很明确的任务意图词
- 很明确的视觉/截图类词

### weak 里放什么？
放**有帮助，但不该单独决定类别**的词。

适合：
- 常见描述词
- 上下文提示词
- 相关但不够独特的词

### negative 里放什么？
放**容易把这个类别搞混**的词。

适合：
- 其它类别的强核心词
- 明显不属于本类的词

---

## 7. 一个非常实用的经验

### 不要把太泛的词塞进 `strong`
比如：
- “help”
- “question”
- “plan”

这类词太泛，容易把很多输入都拉歪。

更稳的做法是：
- 真正“拍板”的词 → 放 `strong`
- 普通提示词 → 放 `weak`
- 容易串类的词 → 放 `negative`

---

## 8. 改完以后，怎么快速验证？

### 先看环境有没有问题

```powershell
.\scripts\doctor.ps1
```

### 再看当前模式

```powershell
.\scripts\router.ps1 status
```

### 做一条本地路由测试（不调用 LLM）

```powershell
cd .\tools\soft-router-suggest
.\route-preview.ps1 -Text "请帮我修复这个 TypeError"
```

如果你看到：
- 命中的词
- 分数
- 最终类别

那就能很直观地判断：
- 哪些词太强了
- 哪些词太弱了
- 哪些 negative 需要补

---

## 9. 给普通用户的最短建议

如果你不想研究太深，记下面 4 条就够了：

1. **先用默认配置跑起来**，不要一上来大改词库  
2. **strong 放强特征词，weak 放辅助词，negative 放排除词**  
3. **每次只改少量关键词**  
4. **每次改完都跑一次 route preview / route test**

---

## 10. 下一步看什么？

- 想看完整命令：`docs/USAGE_MANUAL.txt`
- 想看自定义说明：`tools/soft-router-suggest/README_SETTINGS.md`
- 想看 Windows 全流程：`docs/WINDOWS_INSTALL_REPAIR_UNINSTALL.zh-CN.md`
- 想看 Linux 部署：`docs/LINUX_DEPLOYMENT.md`
