# 扩展页面

扩展页面让一个**内核插件**在面板左侧占一项，点进去是一整页由它自己写的 HTML。
页面里放什么都行 —— 表格、图表、一个自己的小工具。

它与[面板插件](panel-plugin.md)是两件事，选哪个看你要的是哪一种：

| | 扩展页面 | 面板插件 |
|---|---|---|
| 谁来提供 | 内核插件自己（`plugins/<你的插件>/webadapter/`） | webui 的 `plugins/` 目录 |
| 长什么样 | 左侧一项 + 一整页 | 概览页上一格组件，或插件页上一个页签 |
| 写什么 | 普通 HTML/CSS/JS，装在 iframe 里 | 一段 ESM，跑在面板自己的 Vue 里 |
| 能用面板的样式吗 | 不能（在 iframe 内，自带样式） | 能，且应当用 |
| 能读面板数据吗 | 能，只读，走白名单 | 能，只读，走 `get()` |
| 每个提供者几个 | **只有一个** | 不限 |

一句话：**要一整页、且样式想自己完全说了算，用扩展页面；要融进面板现有版面，用面板插件。**

## 放在哪里

你的内核插件目录下开一个 `webadapter/`：

```
plugins/my-plugin/
├─ index.js              你的内核插件本体
└─ webadapter/
   ├─ index.js           node 侧入口，固定这个名字
   └─ index.html         页面本体，缺省找这个名字
```

`webadapter/` 整个目录作为静态资源发出，里面的 css、js、图片都可以直接相对引用。

内核插件的目录名会直接进 URL，故**只许字母、数字与 `. _ -`**；`我的插件/` 一类会被跳过并记一条警告。

`webadapter/index.js` 只在 webui 的 `setup()` 时加载一次 —— 改了它要重载 webui 插件；
只改 `index.html` 或 css 刷新页面即可。

## 最小的一个

只要一页静态内容的话，`index.js` 里什么都不用写：

```js
// webadapter/index.js
export default { title: "我的页面" }
```

```html
<!-- webadapter/index.html -->
<!doctype html>
<meta charset="utf-8" />
<h1>你好</h1>
```

左侧「扩展页面」下就多了「我的页面」一项。

描述符四项都可省：

| 字段 | 缺省 | 说明 |
|---|---|---|
| `title` | 插件目录名 | 导航与页头文案 |
| `sub` | 「由插件「…」提供」 | 页头副标题，一句话说明这页是干什么的 |
| `provider` | 插件目录名 | 提供者显示名 |
| `src` | `index.html` | 入口文件名，相对 `webadapter/` |

## 每个插件只有一个页面

这不是省事。左侧导航是使用者找东西的地方，一个插件能占任意多项时，装三五个插件就把导航挤满，
而**挤占的代价由其他插件承担，不由挤占者承担**。想放多块内容的插件在自己那一页里分区 ——
那一页整个都是你的，想切几个页签都行。

重复注册的那次会被忽略并记一条警告。

## 读面板的数据

页面装在 iframe 里，且**沙箱不含 `allow-same-origin`** —— 你的脚本读不到面板的令牌，
也拿不到 `window.parent` 的任何属性。取数只有一条通道：向父窗口 `postMessage`，
面板代你请求并把结果回过来。

```html
<script>
  const pending = new Map()
  let seq = 0

  window.addEventListener("message", event => {
    const reply = event.data
    if (reply?.kind !== "yunzai-ng.custom") return
    const resolve = pending.get(reply.id)
    if (resolve === undefined) return
    pending.delete(reply.id)
    resolve(reply)
  })

  /**
   * 取一个只读接口的数据
   * @param path 白名单内的面板接口路径，或本插件自建接口的路径
   * @param self 取自建接口时为 true，见「自建只读接口」
   */
  function fetchApi(path, self = false) {
    const id = ++seq
    return new Promise(resolve => {
      pending.set(id, resolve)
      parent.postMessage({ kind: "yunzai-ng.custom", id, path, self }, "*")
    })
  }

  const res = await fetchApi("overview")
  if (res.ok) document.body.textContent = `插件数：${res.data.plugins.length}`
  else document.body.textContent = res.error
</script>
```

应答形状是 `{ kind, id, ok, data }` 或 `{ kind, id, ok: false, error }`。
**`id` 原样回传**，因为一页里可能有多处同时取数，没有它就无从知道哪条应答对应哪次请求。

### 白名单

能读的路径是这些，相对 `/api`：

`overview`、`system`、`plugins`、`commands`、`tasks`、`middlewares`、`renderers`、
`adapters`、`accounts`、`server`

::: warning 配置不在白名单里，且不会加进来
内核的 `GET /api/config/:name` **刻意不脱敏**（面板必须能显示与轮换令牌、显示适配器的连接密钥），
返回体里带着面板令牌与各适配器的密钥。放开它等于任何插件页面都能拿到整台机器。
要读你自己的配置，走下面的自建接口 —— 那一侧你想给什么给什么。
:::

**只有 GET。** 写操作走你插件自己的 `ctx.route()`，那条路径上挂着配置校验、只读模式与操作日志。

## 自建只读接口

页面要的数据不在白名单里（比如你插件自己的统计），在 `init()` 里开一条：

```js
// webadapter/index.js
export function init(ctx) {
  ctx.registerPage({ title: "我的页面", sub: "本插件的运行统计" })

  ctx.registerApi("stats", () => ({ calls: 42 }))
}
```

页面里**不能直接 fetch 它** —— 那条路由要令牌，而 iframe 内没有令牌。仍走同一条桥，
请求里多带一个 `self: true`：

```js
const res = await fetchApi("stats", true)   // fetchApi 见上一节
if (res.ok) document.body.textContent = `调用次数：${res.data.calls}`
```

`self: true` 时 `path` 不过白名单，改判两件事：路径合法（字符集与 `registerApi` 那道校验一致，
带 `..`、空格的一律拒），以及**前缀由面板按当前页填**。你在请求里写别的插件名没有用 ——
桥不看页面自报的归属，故一个插件的页面读不到另一家的接口。`"stats"` 与 `"/stats"` 同指一处，
与 `registerApi` 两种写法都能注册相对应。

只有 `self === true` 走这条路，`self: "1"`、`self: 1` 一律当面板请求处理（于是撞白名单被拒）——
布尔之外的真值不认，免得一个手滑把白名单绕开。

`init(ctx)` 收到的上下文只有五项：

| 项 | 是什么 |
|---|---|
| `pluginName` | 插件目录名，同时是页面标识与接口前缀 |
| `pluginDir` | `webadapter/` 的绝对路径 |
| `configDir` | 内核配置目录，读你自己的配置文件用 |
| `registerPage(page)` | 注册页面，只有第一次生效 |
| `registerApi(path, handler)` | 注册一条 GET 接口，落在 `/plugin/webui/custom/<插件名>/api/` 之下 |

接口路径要过与面板插件同一道校验：带 `..`、空格、问号的路径会被拒并记一条警告。
那道校验防的是**路由穿越** —— 一个插件的接口落到另一个插件的前缀下，悄悄接管它的数据。

## 坏了怎么查

一个插件的 `webadapter/` 出问题只废掉它自己，面板照常打开。看内核日志里 `webui` 的警告：

| 日志里说 | 通常是 |
|---|---|
| 插件目录名含 URL 不安全的字符 | 目录名有中文或空格，改名 |
| 入口 … 不是合法的相对文件路径 | `src` 写了绝对路径或带 `..` |
| 每个插件只能注册一个页面 | `registerPage` 调了两次，或既调了它又有默认导出 |
| 接口路径 … 不合法 | `registerApi` 的路径没过校验 |
| 加载失败：… | `index.js` 有语法错或 `init` 抛错，按后面的原文查 |

页面能打开但取数总失败，先看浏览器控制台：桥拒绝时回的 `error` 会说清是「不在白名单」
还是接口本身报错。
