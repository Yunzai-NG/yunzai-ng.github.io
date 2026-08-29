# 渲染与模板

渲染出图并非内核功能。内核仅维护一张渲染器注册表，按可用性选择其一；未探测到 Chromium 时
回落至下一个，**缺少渲染器不会导致启动失败**，仅调用 `ctx.render` 的命令会告知用户渲染不可用。

## 插件侧的调用

```ts
const img = await ctx.render("note", { uid, resin: 160 })
await e.reply(img)
// 或合并为一步
await e.renderReply("note", { uid, resin: 160 })
```

模板路径相对于**本插件的** `templates/` 目录，扩展名可省略（默认为 `.html`）。
返回值即为可直接发送的图片段，无须再包装 `seg.image()`。

`RenderOptions`：

| 选项 | 缺省 | 说明 |
|---|---|---|
| `selector` | `#container`，回落至 `body` | 截图元素 |
| `type` | `jpeg` | `jpeg` / `png` / `webp` |
| `quality` | 90 | 仅对 jpeg 与 webp 有效 |
| `omitBackground` | false | 透明背景，仅 png 与 webp 支持 |
| `viewport` | `{ scale: 配置项 render.scale }` | `width` 多数情况下仅影响媒体查询，元素宽度由 CSS 决定 |
| `timeout` | 取自配置项 | 单次渲染超时 |
| `multiPage` | 关闭 | `true` 表示使用默认页高，数字表示指定页高；分页时强制为 jpeg，返回图片段数组 |

## 模板中可用的内容

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="common/base.css">
</head>
<body>
  <div id="container">
    <img src="{{res}}img/bg.png">
    <div class="resin">{{resin}} / 160</div>
    {{include './common/footer.html'}}
  </div>
</body>
</html>
```

模板引擎为 **art-template**，语法与旧 Yunzai 模板一致。除插件自行传入的 `data` 之外，
内核补充以下变量，插件传入的同名字段始终优先：

| 变量 | 内容 |
|---|---|
| `res` | 本插件 `resources/` 的 `file://` URL，含尾部斜杠 |
| `_res_path` `pluResPath` `resPath` | 与 `res` 相同，用于使旧 miao 模板无须修改即可出图 |
| `_tpl_path` | 本插件 `templates/` 的 URL |
| `_plugin` | 发起渲染的插件名 |
| `sys.scale` | 当前缩放倍率；传入 `sys` 时与其**合并**而非覆盖 |

渲染器自动注入 `<base href="file:///<模板所在目录>/">`，因此 `href="common/base.css"`
一类的相对路径可直接使用。旧框架通过 `runtime.js` 中
`"../../../" + repeat("../", n) + "plugins/..."` 的路径拼接规避该问题，模板移动一层目录即导致
白屏 —— **此处不存在任何路径拼接运算**。

`#container` 为约定的截图锚点。缺少该元素时只能截取整页，边距难以控制。

### art-template 将注释一并编译

```html
<!-- 反例：以下一行将被作为真实语句执行 -->
<!-- 用法：{{include './common/head.html'}} -->
```

第二行将实际执行 include，而报错指向另一个文件，极难定位。因此约定
**HTML 注释中不得出现 <code v-pre>{{</code>**。`mhy-game-plugin/src/templates.test.ts` 将该约定与
"命令所需模板均存在"、"每张图均含 `#container`"、"include 与 link 指向的文件确实存在"
一并固化为单元测试 —— 这四项均只在实际出图时暴露，而此时已难以补救。

## renderer-puppeteer 的配置

位于面板 → 配置 → renderer-puppeteer，分为两组：

**浏览器**：`chromiumPath`（留空则自动探测）、`wsEndpoint`（填写后连接远端而不自行启动）、
`args`、`userDataDir`（多实例不可共用同一目录）、`launchTimeout`（低配 Android
设备上冷启动确实可能超过半分钟）、`restartAfter`（渲染指定次数后重启浏览器，默认 200；
Chromium 长时间运行时内存持续增长，定期重启是代价最低的处置方式，0 表示从不重启）。

无「无头模式」开关：下载的是 `chrome-headless-shell`，该构建只能无头运行。

**渲染**：`pages`（同时渲染的页面数，0 表示按内存与核数自动决定 —— **内核不限制并发，
该项是唯一的限流点**）、`gotoTimeout`、`waitUntil`（缺省为 `networkidle2`，与旧框架一致）、
`pageHeight`（长图分页的页高）、`templateCache`（编译缓存条数，默认 128）、
`keepHtml`（排查模板问题时开启，中间产物位于临时目录 `render/<插件名>/` 下，
同名模板相互覆盖，不会堆积）。

修改配置后**仅影响启动的字段会导致浏览器重启**（`chromiumPath`、`wsEndpoint`、
`args`、`userDataDir`）；修改超时一类的字段不应导致正在运行的浏览器重启。

### Chromium 探测

浏览器由插件目录下的 `pnpm run install:browser` 下载，装到主目录的 `cache/puppeteer` 下，
版本固定为 `package.json` 中 `yunzai.browserBuildId` 记录的构建号。

按「用户明确指定 → 环境变量（`YZNG_CHROMIUM_PATH`、`PUPPETEER_EXECUTABLE_PATH`、
`CHROME_PATH`、`CHROMIUM_PATH`）→ 已下载的固定构建 → 缓存中的其他构建」的顺序进行，
来源越明确者优先，不作猜测式回落。

**不探测系统上的 Edge 与 Chrome。** 系统浏览器的版本随机器漂移，而 `puppeteer-core` 只与
一个固定构建配套；用系统浏览器出图时，「某台机器上少一块背景、多一道边框」这类问题无从复现。

例外是 **Linux ARM64 与 Termux**：Chrome for Testing 不发布这两个平台的构建
（`@puppeteer/browsers` 会把 `linux_arm` 映射到 `linux64`，下到的是 x86 二进制，
Android 更是连平台都识别不出），故仅在这两处回落系统 chromium ——
`apt install chromium` / `pkg install chromium` 之后无须配置，插件会自动找到它。

### 模板编译缓存

键为模板绝对路径，**值中记录编译时的 mtime**，取用时进行比对 —— 模板修改后下一次渲染自动生效，
既不占用 watcher 亦不泄漏。旧框架的 `Renderer.html = {}` 只增不减，且为每个模板挂一个
`fs.watch`。缓存实例归属于插件，热重载后不会残留。

## 更换渲染器

实现三个方法即可，内核不感知 puppeteer 的存在：

```ts
ctx.registerRenderer({
  id: "my-renderer",
  async available() { return true },        // 返回 false 时内核回落至下一个
  async render(req) { return { images: [buf], cost: 12, renderer: "my-renderer" } },
  async dispose() { /* 释放自行开启的资源 */ }
})
```

`req` 中已包含 `templateRoot`、`resourceRoot` 与 `origin`（由内核按发起插件填充），
因此渲染器无须知晓插件的安装位置 —— 该设计即是旧框架路径拼接运算存在的原因。

## 低内存设备

Android 设备与小内存 VPS 上按以下三项调整：`render.scale` 保持为 1、`pages` 设为 1、
`restartAfter` 调小（如 50）。另见[配置](config.md#低内存设备)与[性能基线](perf.md)。
