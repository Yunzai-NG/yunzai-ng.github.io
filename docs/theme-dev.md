---
title: 主题开发
---

# 主题开发

主题是一个包：一份清单、一份样式表、若干图片，可选一段脚本。装进面板商店的「主题」栏，使用者在外观页一点即换 —— 面板、面板插件的组件、扩展页面一起换。

画师不必会写代码：只换颜色与图片的主题，一份 JSON 加一份几十行的 CSS 就够了。照抄的起点是 [webui-example](/plugins/webui-example) 里的示例主题「薄荷」；想看一款主题能做到哪一步，读 webui 自带的「YUNZAI NG」（[源码](https://github.com/Yunzai-NG/webui-plugin/tree/main/themes/pumpkin)）—— 它把每个槽位、全部导航图标、字体与脚本都用上了。

::: tip 先想清楚「只写不同的地方」
面板自身的样子就是**经典**主题，它是兜底层。你的主题只写与经典不同的令牌与部件样式，没写的一律落回经典。一款只改了配色的主题完全成立。
:::

## 包长什么样

```
my-theme/
├─ package.json          # 声明 webuiTheme
├─ theme.css             # 令牌与部件样式
├─ preview.webp          # 外观页与商店里的预览图（16:9）
├─ fonts/…               # 可选：自带字体
├─ icons/…               # 可选：导航图标
└─ art/…                 # 边框、开关贴图、插图、背景
```

一个包可以**同时**带组件（`webuiPanel` + `index.js`）与主题（`webuiTheme`）。只带主题的包不需要 `index.js`。

## 清单：`package.json` 的 `webuiTheme`

```json
{
  "name": "theme-ayaka",
  "version": "1.0.0",
  "description": "神里绫华主题",
  "author": "你",
  "webuiTheme": {
    "id": "ayaka",
    "name": "神里绫华",
    "description": "白鹭霜华：浅蓝与银白，开关是她的表情包",
    "license": "同人二创，非商用；角色版权归原作者",
    "schemes": ["light", "dark"],
    "style": "theme.css",
    "script": "theme.js",
    "preview": "preview.webp",
    "icons": {
      "mode": "image",
      "nav": { "overview": "icons/overview.png", "plugins": "icons/plugins.png" }
    },
    "slots": {
      "switch.thumb.off": "art/switch-off.png",
      "switch.thumb.on": "art/switch-on.png",
      "frame.card": { "image": "art/frame.png", "slice": 48, "width": "24px" },
      "empty": "art/empty.webp",
      "brand.lockup": { "light": "art/logo.svg", "dark": "art/logo-dark.svg" },
      "backdrop": { "light": "art/bg-light.webp", "dark": "art/bg-dark.webp" }
    },
    "options": { "accentHue": false, "radius": true, "backdrop": true },
    "backdrop": "image"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 全局唯一。小写字母或数字开头，只含 `a-z 0-9 . _ -`，不超过 64 个字符。`classic` 与 `pumpkin` 被内置主题占着 |
| `name` | 是 | 外观页上显示的名字 |
| `description` | | 一句话说明 |
| `license` | | 授权说明。**同人主题请写清楚**：素材来自哪里、能不能商用。外观页与商店会显示它 |
| `schemes` | | 支持的明暗：`["light"]`、`["dark"]` 或两个都写。只写一个时，外观页的明暗开关会置灰。缺省按两套都支持算 |
| `style` | | 样式表，相对包目录，须是 `.css` |
| `script` | | 脚本，相对包目录，`.js` / `.mjs`，见[主题脚本](#主题脚本) |
| `preview` | | 预览图，16:9 最好看 |
| `icons` | | 换导航图标，见[图标](#图标) |
| `slots` | | 槽位：放图的固定位置，见[槽位](#槽位) |
| `options` | | 允许使用者在外观页改哪几项：`accentHue`（强调色）、`radius`（圆角）、`backdrop`（背景）。缺省三项都允许。配色定死的品牌主题把 `accentHue` 关掉 |
| `backdrop` | | 主题自己的默认背景：`gradient`、`dots`、`plain`、`image`（用 `backdrop` 槽位的图） |

写坏的单项会被丢掉并在 webui 日志里警告一句，不会让整款主题不见；`id` 或 `name` 写坏则整款跳过。

## 样式表

### 只改令牌就能换掉大半

面板与所有插件的颜色、圆角、字体都取[设计令牌](/design-tokens)。在样式表里重新声明它们即可：

```css
:root {
  --bg: #f4f8fc;
  --panel: #ffffff;
  --text: #1f2a3a;
  --accent: #4a8fd8;
  --accent-solid: #3b7fcc;
  --on-accent: #ffffff;
  --r-card: 18px;
}

:root[data-scheme="dark"] {
  --bg: #0e1522;
  --panel: #152033;
  --text: #e6edf7;
  --accent: #7fb6f0;
  --accent-solid: #5c9ee6;
  --on-accent: #0b1220;
}
```

明暗的判据是 `<html data-scheme>`（`light` / `dark`），**不要写 `prefers-color-scheme`**：使用者可能在深色系统上选了浅色。

### 不必管特异度

面板把你的整份样式表包进 `@layer theme`。三层的先后是固定的：

```
base（面板自身） → theme（你的主题） → panel（面板插件在自己地盘里的样式）
```

所以你写 `.card { … }` 就盖得过面板的默认样式，不用加 `!important`；而面板插件给自己组件写的样式又盖得过你 —— 你不会把别人的组件弄坏。打头的 `@charset` 与包内的 `@import` 照常可用。

### 只挂在公开的钩子上

能放心挂样式的地方只有三类，它们加了就不改名：

1. **令牌**：见[设计令牌](/design-tokens)。
2. **`data-part` 钩子**：见下表。写法是 `[data-part~="nav.item"]`（用 `~=`，一个元素可能同时是几个部件）。
3. **公开类名**：`.card`、`.stat`、`.stat-value`、`.tag`、`.sub`、`.hint`、`.mono`、`.switch`、`.spinner`、`button.primary`、`button.danger`，以及 `input`、`table` 等元素本身。

其余类名（`.side-brand`、`.nav-row` 之类）是面板的内部实现，随时会改，**别依赖它们**。

| `data-part` | 是什么 |
|---|---|
| `shell` | 整个外壳 |
| `sidebar` / `sidebar.brand` | 侧栏 / 侧栏顶上的品牌区 |
| `brand` / `brand.lockup` | 品牌标记 / 字标那张图的落点 |
| `nav` / `nav.item` / `nav.icon` | 导航 / 一个导航项（当前项带 `.on`）/ 导航图标 |
| `topbar` | 窄屏顶栏 |
| `main` | 内容区 |
| `page.header` / `page.meta` | 页头 / 页头下的元信息行 |
| `widget.frame` | 概览页的一格、插件页的页签容器、扩展页面的外框 —— **第三方组件的外框都由面板画在这里** |
| `tabbar` / `tab` / `tab.ink` | 页签条 / 一个页签 / 垫在选中页签底下、切换时滑过去的那块底色（选中的页签本身不填色） |
| `steps` | 步骤条 |
| `modal` / `toast` | 模态 / 提示条 |
| `logs` | 日志框 |
| `empty` / `empty.art` | 空状态 / 空状态的插图 |
| `loading` | 加载中的转圈 |
| `switch` / `switch.thumb` | 面板插件经 `api.ui.Switch` 画的开关 / 它的滑块 |
| `login.stage` / `login` / `login.art` | 登录与连接中的整个底板 / 那张卡片 / 卡片上方的插图 |
| `backtotop` | 回到顶部 |
| `decor` | 纯装饰的元素；低功耗模式下一律隐藏 |

### 地址只能指向包内

样式表里的 `url()` 只能指向你的包内文件，相对路径照常写（`url(art/frame.png)`、`url(../fonts/x.woff2)`）。外站地址、根路径（`/…`）与走出包外的 `../..` 一律被换成 `none`，并在 webui 日志里警告。`data:` 地址可以用。

理由：面板写明了不向公网发请求；外站 `url()` 还能被用来回传「页面上有哪些元素」。字体请随包带上（woff2 子集化之后通常只有几百 KB）。

## 槽位

槽位是「放图的固定位置」，写在清单的 `slots` 里，面板自动把图摆好，不用写一行 CSS。

| 槽位 | 摆在哪 | 值 |
|---|---|---|
| `brand.mark` | 侧栏、登录卡片上的那枚小标记 | 图片 |
| `brand.lockup` | 宽屏侧栏顶上：给了它，标记与「Yunzai NG」字样让位，只摆这张「图标 + 字」的整图 | 图片 |
| `frame.card` | 每张 `.card` 的边框，九宫格切片 | `{ image, slice, width?, outset?, repeat? }` |
| `frame.widget` | 概览页每一格的外框（含第三方组件） | 同上 |
| `switch.thumb.off` / `switch.thumb.on` | 开关的滑块，关与开各一张 —— 「表情包开关」就是这两张 | 图片 |
| `empty` | 空状态插图 | 图片 |
| `loading` | 加载中，替掉那个转圈 | 图片（gif / 动图 webp 也行） |
| `login.art` | 登录与连接中那张卡片上方的一条插图 | 图片 |
| `backdrop` | 整页背景图（背景档位为「背景图」时） | 图片 |

**每个图片槽位都可以分明暗给两张**：`{ "light": "a.png", "dark": "b.png" }`，只给一张时两种明暗都用它。

图片格式：png、webp、avif、gif、jpg、svg。

### 九宫格边框怎么切

`frame.card` 用的是 CSS 的 `border-image`：图被切成九块，四角原样不动，四边与中间随卡片大小拉伸。

```json
"frame.card": { "image": "art/frame.png", "slice": 48, "width": "24px", "outset": "0px", "repeat": "stretch" }
```

- `slice`：从图的四边各往里切多少像素作为角。画的时候让角上的花纹都落在这个范围里。
- `width`：边框在页面上显示多宽，缺省是 `slice` 的一半（即按 2 倍图画）。
- `outset`：往卡片外扩多少，让花纹压出卡片边缘。`frame.widget` 的外扩部分落在格缝里、不占格子：`outset` 等于 `width` 时，格子里的卡片一点不缩（格缝是 16px，外扩别超过它）。
- `repeat`：四边是拉伸（`stretch`）还是平铺（`round` / `repeat`）。四边有图案时用 `round`，否则图案会被拉散。

两点要注意：

- **SVG 必须写 `width` 与 `height`**，否则浏览器按 300×150 算切片，四角会变形。
- **`border-image` 画不出圆角**，圆角请画在图里。

### 开关的表情包滑块

两张正方形的图，关时显示 `switch.thumb.off`、开时显示 `switch.thumb.on`，切换时滑块从一端滑到另一端。面板会把滑块放大到约 26px，压在轨道两端。轨道本身的颜色仍取 `--accent-solid`（开）与 `--border-strong`（关），想换就在样式表里改令牌。

## 图标

```json
"icons": { "mode": "image", "nav": { "overview": "icons/overview.png", "logs": "icons/logs.png" } }
```

- `mode: "image"`：彩色图片，原色显示。选中态由面板用底色与左侧指示条表示。
- `mode: "stroke"`（缺省）：值是 24×24 网格上的 svg path 数据，按 `currentColor` 着色，选中态照旧变色。

可换图标的导航项：`overview` `accounts` `logs` `storage` `plugins` `custom` `market` `store` `config` `help` `appearance`。没给的那几枚用面板内置的，所以只画三枚也成立。

插件自报的扩展页图标属于那个插件，主题换不到。

## 主题脚本

只换颜色与图片用不着脚本。要做「开关切换时播一段动画」「随时间换背景」这类事，再写一段：

```js
// theme.js —— ES 模块，默认导出 setup(ctx)，可返回一个收尾函数
export default function setup(ctx) {
  const root = ctx.root
  const onChange = e => {
    if (e.target.matches?.(".switch input")) root.classList.toggle("ayaka-wink", e.target.checked)
  }
  document.addEventListener("change", onChange)

  ctx.onSchemeChange(scheme => {
    // 明暗变了
  })

  // 换主题、进安全模式时一定会被调用：挂的监听、计时器、加进页面的节点都在这里撤掉
  return () => document.removeEventListener("change", onChange)
}
```

| `ctx` 成员 | 说明 |
|---|---|
| `id` | 本主题 id |
| `root` | `<html>` |
| `scheme()` | 当前明暗 |
| `asset(name)` | 本主题某个槽位的图片地址 |
| `lowPower()` | 低功耗是否开着 —— **开着时别跑常驻动画** |
| `motion()` | 当前是否播放动效 |
| `onSchemeChange(fn)` | 明暗变化时回调 |

脚本跑在面板里，与面板插件**同等信任**，外观页会给带脚本的主题标「带脚本」。脚本抛错时面板会停用它、退回只有样式的样子，并在外观页上说明。

## 底线

- **对比度**：正文压底色至少 4.5:1，主色按钮上的字压主色同样。白字压亮橙、亮黄多半不过 —— 那时把 `--on-accent` 设成深色。
- **焦点环别去掉**：键盘用户靠它知道自己在哪。
- **装饰图标 `data-part="decor"` 或放进伪元素**：低功耗模式会隐藏它们。
- **体积**：整包超过 8 MB 时商店会提示。大背景图请压成 webp，字体子集化。
- **常驻动画尊重低功耗**：`:root[data-low-power="on"]` 与 `:root[data-motion="off"]` 下停掉它们，`prefers-reduced-motion` 同理。

## 本地调试

1. 把包目录放进（或链接进）webui 安装目录下的 `plugins/`：
   ```powershell
   cmd /c mklink /J "<home>\plugins\webui\plugins\my-theme" "D:\work\my-theme"
   ```
2. 刷新面板，外观页的主题栏里就有它。改了样式表直接刷新即可，不用重载 webui。
3. webui 日志里会说清清单哪一项写坏了、样式表里哪个地址被剔除了。

## 上架

主题与组件共用面板商店的索引 [`webui_index.json`](https://github.com/Yunzai-NG/plugin-index)，条目上加一个 `"kind": "theme"`（两样都带写 `"both"`），商店就把它摆进「主题」栏。其余字段与组件条目相同，见[插件市场 · 面板商店索引](/market)。
