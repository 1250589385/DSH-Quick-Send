# DSH 一键快捷输入（DSH Quick Send）

> 在消息输入框旁边放一排**可自定义的快捷指令按钮**，点一下就把预设文字直接发进当前对话 —— 省掉重复打字的时间。

标准 DSH bundle 插件：`dsh plugin` 一键安装，纯 JavaScript 无构建步骤，无需任何会话令牌。

---

## 它解决什么问题

和模型对话时，总有些话要反复打：

- 「继续」
- 「请总结当前进展」
- 「按方案 A 改，别动其它文件」
- 一大段固定的审查要求 / 代码规范

每次都手打一遍很费时间。这个插件把这些固定说法变成按钮，**点一下就发送**。

---

## 特性

### 一个按钮组，不遮挡任何内容

| 组成 | 位置 | 说明 |
|---|---|---|
| 🔘 **快捷按钮** | 输入框**下方**那一行，默认在上下文进度**右侧** | 每个按钮一条指令，点一下即发送 |
| ⚙ **齿轮** | 紧挨快捷按钮，同一组内 | 点开是配置面板 |

整组走**正常流式布局**（不是浮层），所以**不会盖住对话正文**。

### 右键拖动换位置

**右键**按钮组即可进入移动模式（出现提示条 + 高亮边框）：

- 按住左右拖动，松开后**吸附到上下文进度的左侧或右侧**；
- 按 `Esc` 取消，不改变位置；
- 选择会记住（`localStorage` 键 `dsh-quick-send.placement.v1`），刷新后保持。

### 每条快捷指令都能单独定制

| 可调项 | 范围 / 选项 |
|---|---|
| **按钮名称** | 任意文字，显示在按钮上 |
| **发送文字** | 任意多行文本，即点击后真正发出去的内容 |
| **大小** | 字号 10 – 22px |
| **透明度** | 20% – 100%，可让不常用的按钮低调一些 |
| **模块化形状** | 方形 / 圆角 / 胶囊 / 圆形 |
| **顺序** | 上移 / 下移，可增删任意条数 |

编辑器里每条指令右侧的 **▶** 可以**直接试发**，不用切回输入框。

### 面板不会撑坏页面

配置面板渲染在框架级浮层 `shell.overlay` —— 它在所有列之上、**所有滚动容器之外**，因此：

- 不会被对话滚动区**裁剪**；
- **不会把页面撑高溢出**（之前的版本在输入框下方展开大表单就会溢出）；
- 输入框在屏幕下方，**默认向上展开**，空间不足时自动调整；
- 浮层本身点击穿透，只有面板自己接收指针事件。

### 不干扰你的草稿

发送走的是与官方输入框**同一条**客户端 API：

```js
ctx.sessions.binding(sessionId).session.prompt([{ type: 'text', text }], 'queue')
```

以 **queue** 模式投递文本，**不会写入草稿框** —— 所以你正在编辑的内容原封不动。

### 中英双语 · 主题跟随

内置英文与简体中文文案，跟随宿主语言切换；样式只使用宿主主题令牌（`--dsw-alias-*`、`--dsw-radius-*`），自动适配明暗主题。

### 配置持久化

快捷指令保存在浏览器 `localStorage`（键 `dsh-quick-send.shortcuts.v1`），
**无需 Host 桥接**，重启后依然在。默认自带两条示例（「继续」「总结」）。

---

## 安装

> **命令里的 `<你的profile>` 换成你自己的 profile 名。** 不确定就查一下：
> - 命令行：`dsh plugin --profile` 会提示必填；环境变量 `$env:DSH_PROFILE` 直接给出当前值
> - 桌面端常见的是 `desktop`，Web 端常见的是 `web`

### 方式一：从 npm 安装（推荐）

```bash
dsh plugin --profile <你的profile> add dsh-quick-send
```

装完**重启 DSH**（或重载 Web 页面）即可看到按钮。

### 方式二：从 GitHub 仓库安装

```bash
dsh plugin --profile <你的profile> add github:1250589385/dsh-quick-send
```

⚠️ 两种方式是**同一个包名**，请勿混用；已经用 `github:` 装过想换 npm 名的，先执行
`dsh plugin --profile <你的profile> remove dsh-quick-send`。

### 方式三：本地目录安装（开发用）

把本仓库放到任意本地目录，然后填**这个目录的真实路径**：

```bash
# Windows（注意用你自己的实际路径，反斜杠或正斜杠都可以）
dsh plugin --profile desktop add D:\你的路径\DSH-Quick-Send

# macOS / Linux
dsh plugin --profile web add /home/you/DSH-Quick-Send
```

### 方式四：在 DSH 网页界面的安装框里装

网页版 DSH 的「添加插件」对话框**只要包名**，不要整条命令：

| 输入框里填 | 结果 |
| --- | --- |
| `dsh-quick-send` | ✅ 正确 |
| `dsh plugin --profile desktop add dsh-quick-send` | ❌ 报 `not a package name the registry accepts` |

意思是：**只把命令最后面那一段（包名）填进去**。Git 地址和本地绝对路径也可以直接填在同一个框里。

---

## 使用

1. **配置**：点输入框**右上角的 ⚙** → 打开面板
2. **增删**：面板顶部「添加」新增一条，「✕」删除某条
3. **编辑**：改名称、改发送文字、调字号 / 透明度 / 形状
4. **排序**：用 ↑ ↓ 调整按钮在下方那一行的先后
5. **发送**：点**输入框下方**的按钮即发送；或在面板里点该条的 ▶ 试发

发送成功/失败都会在触发器旁显示一行提示（例如「已发送：继续」，
或会话已关闭、内容为空的失败原因）。

---

## 兼容性

| 项目 | 要求 |
|---|---|
| DSH | 带 `conversation.input.overlay` / `conversation.composer.dock` / `shell.overlay` 三个 slot 的版本（0.2.x 实测通过） |
| 平台 | DSH Web UI（`"platform": "web"`） |
| Node | 仅安装期需要，运行时无 Node 依赖 |
| 构建 | **无** —— 直接加载源码，不需要打包 |
| 依赖 | 无第三方运行时依赖 |

---

## 工作原理（给开发者）

插件分两半：

- **Host 半边**（`index.js`）：仅 `export function apply() {}`，不注册任何 Host 能力，
  只让 bundle 解析出一个 Loader 行。
- **Client 半边**（`client.js`）：纯 JS，通过 `window.__ModuleLoader__.load({...})`
  注册一个惰性工厂，内部用两个 slot 注入：

| Slot | 注册 id | 作用 |
|---|---|---|
| `conversation.composer.dock` | `quick-send-dock` | 快捷按钮 + 齿轮组成的整组，含移动模式与状态行 |
| `shell.overlay` | `quick-send-panel` | 框架级浮层中的配置面板 |

**为什么能排在上下文进度右侧**：宿主把 dock 渲染为
`[renderSlot("conversation.composer.dock")][ContextMeter]` 的居中 flex 行，
所以槽内容天然在 ContextMeter 左侧。本插件给按钮组加 `order: 1` 移到右侧，
再用 `margin-left: auto` 贴住行尾，使其与上下文进度相邻而不是漂在中间；
移动模式把 `order` 在 `0` / `1` 之间切换。

配置状态放在一个模块级 store（`useSyncExternalStore` 订阅），
由 `dock` 与 `panel` 共享，因此任一处修改在另一处立即生效。
面板位置通过齿轮的 `getBoundingClientRect()` 用 `requestAnimationFrame`
跟随（只在坐标真正变化时才 setState，空闲时零开销）。

**资源释放**：样式以 React `<style>` 元素渲染在组件树内，卸载即移除；
Escape / 外部点击监听器在 `useEffect` 中注册并返回清理函数，随面板卸载一并注销。

---

## 仓库结构

```
DSH-Quick-Send/
├── package.json          # 包清单：exports、files、dsh.bundle / dsh.client
├── cordis.patch.yml      # 插入 quick-send Host 行
├── index.js              # Host 半边（空 apply）
├── client.js             # 客户端半边：按钮组、齿轮、浮层编辑器、发送、拖动换位
├── locale/
│   ├── en.json           # 插件列表标题与描述（英文）
│   └── zh.json           # 插件列表标题与描述（中文）
├── icon.svg              # 插件列表图标（原创）
├── README.md             # 本文件
├── CHANGELOG.md          # 版本变更
├── PROVENANCE.md         # 素材来源与许可范围
├── LICENSE               # MIT
└── .gitignore
```

---

## 许可

代码与文案按 **MIT** 授权，见 [`LICENSE`](LICENSE)。
图标为原创作品，一并按 MIT 授权。详见 [`PROVENANCE.md`](PROVENANCE.md)。

---

## 致谢与反馈

欢迎提 issue / PR：<https://github.com/1250589385/dsh-quick-send/issues>

反馈问题时请注明 **插件版本、DSH 版本、系统与复现步骤**，并**勿粘贴密钥或未脱敏日志**。
