# 面板插件

面板插件是**手写的 `.js`**，向面板添加组件、或在插件页上开出自己的一整块界面。
放进目录、刷新页面即生效，无须构建、无须重启内核。

它与[插件开发](plugin-api.md)所说的插件是两件事：那是跑在 Node 里的插件，
这是跑在浏览器里的一段 ESM。一个面板插件也可以有自己那半 node 侧（见
[包的 node 侧那一半](#包的-node-侧那一半)）—— 官方的
[hardware-plugin](https://github.com/Yunzai-NG/hardware-plugin) 即是如此：
node 那半探测硬件并开一个端点，浏览器那半把数字画出来。

## 放在哪里

**只有一处落点：webui 安装目录下的 `plugins/`**，即 `plugins/webui/plugins/`。
商店装到这里，手放也放这里。

```
plugins/webui/plugins/
├─ clock.js             单文件：一个 .js 即一个面板插件
└─ hardware/            插件包：一个目录
   ├─ index.js          入口固定是这个名字
   └─ package.json      自报信息写在这里
```

曾有三路（另两路是 `<home>/data/plugin/webui/plugin/*.js` 与各内核插件自带的
`panel/*.js`），2026-08-26 收敛为一路。理由是**一个东西只该有一个地方**：三处落点意味着
「我的组件为什么没出现」有三个要逐一排查的答案，而使用者得先知道有三处才排查得动。

::: warning 这个目录会被「更新 webui」清空
更新与卸载 webui 走的是整目录替换，`plugins/` 在 webui 安装目录之下，随之一并删除。
这是既定取舍，请自己留一份备份。
:::

只认 `.js` 与 `.mjs`。**`.ts` 不认** —— 浏览器不会编译它，放进去只会得到一个指向
TypeScript 语法的报错（这一种会记一条明确的警告）。文件名与目录名只许字母、数字与
`. _ -`：名字要拼进 URL，`硬件.js` 一类会被挡下并记一条警告。

**改动之后刷新页面即可，新增与删除文件也一样。** 清单端点每次被请求时重扫目录，
故不必重载 webui 插件。唯一的例外是包的 node 侧入口 —— 它只在 webui 的 `setup()` 时
加载一次，改了它要重载 webui 插件。

## 两种形态

| 形态 | 长什么样 | 自报信息写在哪 | 能有 node 侧吗 | 能有配置项吗 | 能上商店吗 |
|---|---|---|---|---|---|
| 单文件 | `<名>.js` | 该文件的 `export const meta` | 不能 | 不能 | 不能 |
| 插件包 | `<名>/index.js` + `<名>/package.json` | `package.json` 的常规字段 | 能 | 能 | 能 |

后三列是同一条判据的三个后果：**node 侧读得到什么。** 单文件的一切都写在那个 js 里，而
node 要读到它就得执行它 —— 于是它没有 node 侧入口（无处声明）、没有配置项（schema 读不到）、
也上不了商店（版本号读不到，无从判断该不该更新）。要这三样中的任何一样，就做成一个包。

**每个面板插件都要自报家门**（版本、说明、仓库、作者），缺了就不加载、只得到一格占位。
装了却什么都不显示远比一格红字难查。

两种形态的来源不同，是因为一个孤零零的 js 除了它自己没有别处可记版本与作者；而一个目录
本就带 `package.json`，再要求它在 js 里抄一遍只会两处不一致 —— 且不一致时谁说了算又是
一个新问题。

四项里 **`version`、`description`、`repository` 缺一不可，`author` 缺则从仓库地址推**
（`git+https://github.com/Yunzai-NG/x.git` → `Yunzai-NG`）。npm 里 `author` 本就是常缺的
可选字段，拿它当门槛等于罚了没写错什么的人。连 `repository` 都没有时才作废 ——
那时确实无从知道这东西是谁的。

## 一个最小的例子

单文件形态，两个导出：

```js
export const meta = {
  version: "1.0.0",
  description: "打个招呼",
  repository: "https://github.com/me/hello-panel",
  author: "我"
}

export default {
  id: "demo.hello",
  page: "overview",
  title: "打个招呼",
  defaultLayout: { w: 3, h: 1 },
  setup(api) {
    return () => api.h("div", { class: "card" }, "你好")
  }
}
```

组件定义的字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 全站唯一。**落盘的版面按它认位置**，改名等于换了一个组件，使用者摆好的位置会丢 |
| `page` | 是 | 挂到哪一页，取 `overview` / `accounts` / `logs` / `plugins` / `market` / `config` / `help` 之一；写错时组件在每一页都不出现，故校验不通过会画一格占位并写明可选值 |
| `title` | 是 | 编辑态的把手与「添加组件」里如何称呼它 |
| `defaultLayout` | 是 | `{ w, h, minW?, minH?, resizable? }`。`w` 是 12 列栅格里的列数，`h` 是行数（每行 80px，格间 16px），皆为不小于 1 的整数 |
| `defaultHidden` | 否 | 为真时默认不上板，只出现在编辑态的「已移除」一栏。测不到的东西（如无 N 卡时的显卡占用）宜用此项 |
| `setup` | 是 | 建立状态并**返回一个渲染函数**。注意返回的是函数，不是 vnode |

**`resizable` 与 `minW` / `minH` 是一件事的两半。** 不声明 `resizable` 的组件尺寸固定，
使用者看不到右下角那个把手；声明了 `resizable: true` 则 `minW` 与 `minH` **必须一并给出**，
缺则本组件不加载、只得到一格占位。一枚卡片能缩到多小取决于它里头装的是什么，只有写它的人
知道 —— 由面板替它猜，猜大了使用者缩不动，猜小了就是一团挤住的字。

`setup` 在组件挂载时执行一次，返回的函数在每次数据变化时执行。

**`h` 别定得太小。** 卡片除内容之外的壳子固定占 87px（标题 24px + 其下 8px + 底部小字
21px + 上下内边距各 16px），故 `h` 为 n 时内容能用的高度是 `80n + 16(n-1) - 87`。
默认布局不该需要滚动，装不下时把 `h` 加一档，别指望使用者去拖。

## 一个包给出多枚组件

**默认导出可以是数组。** 一个包一口气给出十来枚组件时不必拆成十个包 —— 官方的
hardware 自己就是这么写的：

```js
// hardware/index.js
import cpu from "./widgets/hardware-cpu.js"
import memory from "./widgets/hardware-memory.js"
import disk from "./widgets/hardware-disk.js"

export default [cpu, memory, disk]
```

**数组顺序即默认版面顺序**（没有落盘布局时按此顺序逐个补在第一个空位上）。
数组里有一枚写错时其余照常上板，被丢掉的那枚在控制台留一句「第 N 个组件：……」——
一枚写错不连坐其余。

**共享代码放包目录的子目录里。** 整个 `plugins/` 都是静态可取的，故包内的
`./widgets/`、`./lib/`、`./dist/` 都引得到，且它们不会被当成组件（只有包根的 `index.js`
是入口）：

```
plugins/webui/plugins/hardware/
├─ index.js             入口，汇总成一个数组
├─ package.json
├─ widgets/             九枚组件
│  └─ lib/store.js      共享代码
└─ dist/                node 侧那一半的产物
```

子目录里的模块用**相对路径** import（`./lib/store.js`），它是一个 URL，故可行；
裸包名不行，理由见下。

::: tip 单文件之间不能这样共享
`plugins/` 的顶层子目录一律被当作插件包，缺 `index.js` 时会被跳过并记一条警告。
故几个单文件想共用一份代码时，正确的做法是把它们并成一个包。
:::

十枚组件各自请求同一个端点就是每 5 秒十次 HTTP，且十张卡片上的数还可能不是同一时刻的。
把状态提到共享模块的模块级即可 —— 浏览器的模块注册表保证各组件拿到的是同一份。
但**节拍订阅仍要各组件自己来**：`api.onTick` 在组件卸载时自动退订，若只由第一枚订阅，
使用者把它从版面移除之后，其余的就再也不更新了。同一拍里的多次取数用一个最小间隔
收敛成一次请求。

## 贡献一个页签

一枚 3×3 的卡片装不下一整套界面。故包除了组件，还可以在**插件页**上开出自己的页签 ——
选中时整块内容区都是它的：

```js
// mypanel/index.js
export const tabs = [
  {
    id: "mypanel.detail",
    title: "详情",
    setup(api) {
      const info = api.ref(undefined)
      const pull = async () => {
        info.value = await api.own("hardware")
      }
      void pull()
      api.onTick(pull)
      return () => api.h("div", { class: "card" }, info.value?.os?.distro ?? "读取中")
    }
  }
]

export default [/* 组件照常 */]
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 全站唯一。同一标识不许后注册者覆盖，规则与组件一致 |
| `title` | 是 | 页签上的文案 |
| `setup` | 是 | 与组件同一形制：收同一份 `api`，**返回一个渲染函数** |

**与组件同一形制，刻意不另起一套。** 两者都是「给我一个 setup，我还你一个渲染函数」，
且都收同一份 `api`（故页签一样取得到自己那半 node 侧的数）。差别只在去处：组件按 `page`
落进某一页的栅格里，页签落在插件页那一排标签上 —— 故页签没有 `page` 与 `defaultLayout`。

`tabs` 给单个对象也认，`tabs: []` 与不写是同一个意思，**不导出 `tabs` 不是错**
（绝大多数包只出组件）。一个页签写错只在控制台出声，**不连坐这个包的组件**，也不画占位格：
占位格是栅格里的一格，而页签占的是整块内容区，没有「那一格」可以安放它。

**页签内容切走即卸载。** 使用者切到别的页签时你的页签会被卸载，切回来重新 `setup`；
`onTick` 的退订由面板代劳，你自己起的表要自己在渲染函数之外收拾干净。

## 给使用者一份配置

包可以声明一份配置表单，**声明写在 `package.json` 的 `webuiPanel.config` 里**：

```json
{
  "name": "redis-watch",
  "version": "1.0.0",
  "description": "看着那台 Redis",
  "repository": "https://github.com/you/redis-watch",
  "webuiPanel": {
    "server": "dist/index.js",
    "config": {
      "type": "object",
      "properties": {
        "redis": {
          "type": "object",
          "group": "Redis",
          "order": 10,
          "properties": {
            "host": { "type": "string", "title": "主机", "default": "127.0.0.1" },
            "port": { "type": "number", "title": "端口", "default": 6379 }
          }
        },
        "probes": {
          "type": "record",
          "title": "对外探测",
          "widget": "keyValue",
          "description": "名字 → 地址，默认为空即不发任何对外请求",
          "values": { "type": "string" },
          "default": {}
        }
      }
    }
  }
}
```

装上之后，插件页的这张卡片上多出一个「配置」按钮，表单由这份声明自动生成 —— 你不写任何
表单代码。字段的写法与内核插件配置同一套（`type` / `title` / `description` / `default` /
`widget` / `group` / `order` / `enum` / `showWhen` ……）。

::: warning 只能写在 package.json 里，单文件插件没有这个能力
配置的值要给**两侧**用：浏览器画表单，包的 node 侧那一半照它去连那台 Redis。两侧都要
「没设过的键取默认值」，而默认值取自声明 —— 若声明只写在 `index.js` 里，node 侧就得
`import()` 一个**浏览器模块**才拿得到它，即在 node 里跑你的浏览器代码。

于是规矩只有一条：**声明写在 package.json 里**。代价是一个孤零零的 `.js` 不能有配置项
（它没有 package.json），需要配置就做成一个包 —— 多一份 package.json 而已。

写错了地方不会静默：面板会在这张卡片的详情里写明该挪到哪，卡片上也带一枚「配置未生效」。
:::

### 值存在哪，两侧怎么读

值落在 **webui 的数据目录**下（`<主目录>/data/plugin/webui/panelconfig/<归属>/<包名>.json`），
**不在你的包目录里** —— 包目录会被「更新 webui」整目录替换，配置若放在那里，一次更新就没了。

浏览器那半经 `api.config` 读：

```js
setup(api) {
  return () => api.h("p", null, `连的是 ${api.config.value.redis?.host ?? "127.0.0.1"}`)
}
```

`api.config` 是**只读且响应式**的引用（`.value` 取值）：使用者在面板上改完，你的组件与页签
立刻显示新值，不必刷新页面。只读是刻意的 —— 值的落点在 node 侧，往这里写只会改动本页的
一份副本，下一次刷新即消失。

node 那半经 `ctx.config()` 读，见[包的 node 侧那一半](#包的-node-侧那一半)。

### 校验：只保证类型，不保证取值范围

写入时 webui 逐字段查**类型与枚举候选**：声明为 `number` 的字段一定是 number，
声明为 `enum` 的一定是候选项之一。不符的那一次整份拒掉（400），错误标到对应字段上，
**一个字节都不落盘**。

而 `min` / `max` / `pattern` **不校验** —— 它们是表单上的提示。理由是两条：那会是 webui
自己写的第二个校验器，而声明的语义由你定，两者不一致时错的是哪一边都说不清；且这份文件
可以手改，你的代码无论如何得容得下一个超出范围的值。

声明之外的键在保存时被丢掉（只提醒，不拒绝）—— 最常见的来源是你在新版里删掉了某个配置项，
而使用者的文件里还留着它。

手改坏了文件不会让这个包整份失去配置：读的时候按声明修好、日志里留一句，用的是修好的那份。

「恢复默认值」是**把那个文件删掉**，而不是写一份等于当前默认值的文件 —— 后者会在你日后改
默认值时钉在旧值上，而使用者以为自己「从未配置过这一项」。

只读模式（配置项 `server.readonly`）之下这两条端点一律 403，与 `/api` 之下的写请求同样对待。
内核的那道判定管不到 webui 自己的 scope，故 webui 自己读一遍那个开关 —— 使用者看到的是同一
句话，挡住他的是哪一侧属于实现细节。

## 上架到商店

面板商店那一页从一份索引取条目：`Yunzai-NG/plugin-index` 仓库的
**`webui_index.json`**。它与内核插件市场那份 `index.json` 是两份文件，字段不同、顶层键不同。

追加一条记录即可：

```json
{
  "name": "hardware",
  "title": "硬件信息",
  "description": "一句话说明。",
  "author": "你的名字",
  "version": "0.4.0",
  "homepage": "https://github.com/你/你的包",
  "minWebui": "0.1.0",
  "tags": ["监控", "系统"],
  "widgets": 10,
  "server": true,
  "deps": true,
  "install": {
    "type": "git",
    "url": "https://github.com/你/你的包",
    "branch": "main"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 安装目录名。须匹配 `/^[a-z\d][a-z\d._-]*$/i`，不以点开头，且不是 `node_modules` / `package.json` / `dist` |
| `install` | 是 | `type` 为 `git` 或 `tarball`，`url` 须是 http(s) |
| `minWebui` | 否 | 要求的最低**面板**版本。**不是 `minCore`** —— 见下 |
| `widgets` / `server` / `deps` | 否 | 三项**预告**，仅供列表展示；装完一律以你的 `package.json` 为准 |
| `tags` | 否 | 商店页按它给出一排可点的分类 |

::: warning 版本门是 `minWebui`，不是 `minCore`
面板插件用的是**面板**给的注入口（`api.config`、页签注册点、一个模块导出多枚组件），
这些随面板版本走，不随内核版本走。写成 `minCore` 不会被读取 —— 那道门等于不存在。
校验脚本会把这一条报成错误。
:::

::: warning 商店只装「包」，且一个仓库只装一个包
单文件上不了商店（版本号 node 侧读不到，见「两种形态」）。`install` 也**没有 `path` 字段**：
`.git` 在仓库根，而装进落点的是包本身，若装的是子目录就无从就地拉取更新。一个仓库要放多枚
组件时，让那个包**导出多枚**（见「一个包给出多枚组件」），而不是切成多个安装单位。
:::

提交前在 `plugin-index` 仓库里跑一次 `pnpm run validate`：它把两份索引一并校验，并把消费者的
「静默丢弃」升格为错误 —— 拼错一个字段的表现本来只是你的包不出现在商店里，没有任何报错。

### 装完之后要做什么，取决于你的包

| 你的包 | 使用者要做的 |
|---|---|
| 只有浏览器侧 | **刷新页面**即可 |
| 带 node 侧（`webuiPanel.server`） | 到插件页**重载 webui** —— node 侧入口只在 webui 的 `setup()` 里加载一次 |
| 带 node 侧且有依赖 | 先装依赖，**再**重载 —— 反过来重载会 import 失败 |

商店会照这三种情形分别给出提示，不会一律说「已安装」。

依赖那一步商店可以代跑：声明了 `dependencies` 的包，安装时会在包目录里执行
`pnpm install --prod`（找不到 pnpm 时退回 `npm install --omit=dev`）。这一步在确认框里写明
并可取消 —— 它会执行你依赖的 install 脚本，而那与你的 node 侧入口稍后被 import 属于同一道
信任边界。**不加 `--ignore-scripts`**：原生模块（sqlite、sharp）正是在 install 脚本里编译或
下载预编译产物的，禁掉脚本会装出一份 `import` 就报错的 `node_modules`。

### 取源会走代理与镜像

索引拉取与 tarball 下载走内核的 HTTP 客户端，它默认读 `https_proxy` / `HTTPS_PROXY` /
`http_proxy` / `HTTP_PROXY` / `ALL_PROXY`，命中时日志里会记一条。**`git clone` 是子进程，
不吃这些环境变量** —— 它按 git 自己的配置走（`git config http.proxy`）。

GitHub 反代复用内核配置的 `market.mirror`，面板不另设一份：让使用者填两遍，第二遍必然
有人忘。它**只对三个主机生效**：`github.com`、`raw.githubusercontent.com`、
`codeload.github.com`。镜像站通常只代理 GitHub，任意地址都套前缀会让自建源失效，且报错
会指向镜像站的 404 而不是使用者写错的地址。clone 那条路会把前缀拼进 clone 地址。

**商店不会替你跑构建。** 面板插件的入口是包根的手写 `index.js`，不需要构建。用
TypeScript 写的包须自己把产物提交进仓库 —— 商店只会 clone / 解包、校验、按需装依赖。

### 更新与删除

更新优先**就地 git 拉取**（`fetch --depth 1` + `reset --hard FETCH_HEAD`），故包目录里那份
`node_modules` 不会因为一次更新而重装。目录不是 git 仓库、本机没有 git、或索引声明的来源不是
git 时退回整目录重下 —— 那时依赖要重装一遍。使用者在包目录里未提交的改动会先
`git stash push --include-untracked` 暂存，可用 `git stash pop` 取回。

删除只删包目录。**配置留着** —— 它存在面板的数据目录下，故重装同名包之后原有配置仍然有效。

只读模式下装 / 更 / 删一律 403，商店页的那几个按钮一并隐去。

## 一份完整的示例包

上面各节是逐件说的；`webui-example` 把它们凑在一处，可以直接读代码 —— 它是一个包导出三枚组件加
一个页签，外加一份 node 侧与一份自带样式表，每样能力各示范一次。

**它示范什么、四处容易踩的、以及「上游失败不要冒成 500」那一条处置**，见
[webui-example](/plugins/webui-example)。想写面板插件时从它开始改，比从零拼快。

## 插件页上的一张卡片

装上之后，插件页的「面板插件」页签里**一个包一张卡片**（不是一枚组件一张）。
卡片上是版本、说明、形态、组件数、页签数与配置项数；点「查看」列出其下全部组件的标识、
所在页、默认尺寸与可否调整；声明了配置项的包多一个「配置」按钮。

**装载失败的组件也列在那张表里**，红字写明原因。「我装了却没出现」的答案应当在这里，
而不是在浏览器控制台里 —— 多数人不会去翻控制台。同理，配置声明写坏了或写错了地方，
缘由也写在这张详情里。

## 不能 import 裸包名

浏览器按 URL 解析模块说明符，故这一句在面板插件里直接是一条网络错误：

```js
import dayjs from "dayjs"        // ✗ 浏览器会去请求 /dayjs，得到 404
```

面板自己打包的能力经 `api` 取，**不经 import**。真要用第三方库，只能给出一个可直接
取到的完整 URL（同源的静态文件，或自己那半 node 侧挂出来的目录）：

```js
import dayjs from "./vendor/dayjs.js"   // ✓ 是一个相对 URL，落在本包目录内
```

同理，浏览器那半也不能 `import` 你包的 `src/` 下任何东西 —— 那些是 TypeScript，
且在 Node 那一侧。两半之间只经 HTTP 通信。

## 不要把令牌写进面板插件

面板插件是**静态资源，而静态资源刻意不鉴权** —— 浏览器无法为 `import()` 设置
`Authorization` 头，一旦要求鉴权，面板插件这套机制就不成立。

于是：凡能连上面板端口的人都读得到你的面板插件文件。**不要在里面写任何令牌、密钥或
Cookie。** 取数一律走 `api.get` 或 `api.own`，令牌由面板那边带上，不经过你的文件。

若你的数据本身敏感，把它放在 node 那半的端点后面（那些路由默认鉴权），
浏览器这半只负责画。

## api 的全部成员

`setup(api)` 收到的 `api` 逐实例构造，**每个组件与每个页签各一份**。它只有这些：

| 成员 | 说明 |
|---|---|
| `h` | Vue 的渲染函数 `h(type, props?, children?)` |
| `ref(v)` | 响应式引用，读写经 `.value` |
| `computed(fn)` | 派生值 |
| `get(url)` | 带令牌的 GET，返回解析后的响应体。**只收绝对路径**（须以 `/` 开头） |
| `own(path)` | 带令牌的 GET，打到**本包自己那半 node 侧**；路径相对本包，如 `own("hardware")` |
| `onTick(fn)` | 订阅共享刷新节拍（5 秒一拍），组件卸载时自动退订 |
| `onUnmounted(fn)` | 登记一份卸载时要做的收尾。**自带计时器、监听器的组件必须用它** |
| `config` | 本包当前的配置值，**只读且响应式**（`.value` 取值）。没声明配置项时是空对象 |
| `fmt` | 一组格式化纯函数，见下 |

**给 `h` 不等于给 Vue。** 拿不到 `createApp` / `defineComponent` / `watch`，
也写不出 `.vue`。这是为了日后换渲染层时只需换掉 `h` 的实现 —— 一旦把 Vue 本身交出去，
「面板用 Vue 渲染」就成了对插件作者的承诺。

`get` 拒绝相对路径：相对路径按当前页面的路径解析，在 `/` 下看起来是对的，
换到别的路由就成了另一个 URL。这类错不报错，只表现为「换到别的页再回来这个组件就没数了」。

**有 node 侧的包一律用 `own`，不要自己拼前缀。** 基地址由 node 侧算出、经清单送来；
拼在两处就会漂移，改了 webui 的前缀而 js 里仍是旧的，表现为你全部接口一齐 404。
没有 node 侧时调用 `own` 会抛错，且那句错话直接说清原因。

**`onTick` 与 `onUnmounted` 各管一半。** 共享节拍是 5 秒一拍的采样节拍，订阅了会自动退订，
不必管；而你自己建的东西要自己收 —— 一枚时钟要每秒一拍（用 `setInterval`），一张图表可能
监听 `resize`。不收的后果是：组件从版面上移除之后那个计时器仍在跑、仍在改一个已经没人看的
`ref`，直到整页刷新。一个页面开着半天、编辑态里反复增删几次组件，就攒下一串这样的计时器。

```js
setup(api) {
  const now = api.ref(new Date())
  const timer = setInterval(() => { now.value = new Date() }, 1000)
  api.onUnmounted(() => clearInterval(timer))
  return () => api.h("div", { class: "stat" }, api.h("b", {}, now.value.toLocaleTimeString()))
}
```

### fmt

| 函数 | 用途 |
|---|---|
| `bytes(n)` | 字节数 → `76.5 MB` |
| `percent(r)` | 比例（0-1）→ `31%`；`undefined` 给破折号 |
| `duration(ms)` | 毫秒 → `3天4小时` |
| `clock(ts)` | 毫秒时间戳 → `HH:mm:ss.SSS` |
| `ratioOf(used, total)` | 已用 ÷ 总量 → 0-1；总量为 0 或非有限数时 `undefined` |
| `gaugeLevel(r)` | 比例 → 着色档位类名（`""` / `"warn"` / `"err"`），直接加在 class 上 |

用 `gaugeLevel` 而不要自己比阈值：阈值一旦抄进插件，内核这边调整档位之后，
同一台机器上你的槽与内置的槽会在不同占用率变红，而「两处颜色不一致」几乎不会被当成
bug 报出来，只会被当成看错了。

### onTick 的语义

节拍 5 秒一拍，与概览页自身的刷新同步 —— 两处的数字看起来应是同时更新的。

**全部订阅者共用一条定时器。** 让插件各自 `setInterval` 的话，五个插件就是五条互不
对齐的节拍：同一秒里可能连发五次请求，刷新时页面上的数字一个个跳而不是一起跳。
更要紧的是卸载 —— 组件里起的表谁都可能忘记清，而忘记了不会报错，只是这个组件被移除
之后仍在后台发请求。`onTick` 的退订由面板代劳。

**`onTick` 不立即触发第一拍。** 首轮取数请自己发起，否则头五秒是空的：

```js
setup(api) {
  const data = api.ref(undefined)
  const pull = async () => {
    data.value = await api.own("stat")
  }
  void pull()          // 首轮自己来
  api.onTick(pull)
  return () => api.h("div", { class: "card" }, api.fmt.percent(data.value?.load))
}
```

回调里抛出的错会被记一条日志并隔离，不影响同一节拍上的其他订阅者。但**建议自己接住** ——
抛出去之后这一格仍显示着上一次的旧数，使用者看到的是「数字不动了」，无从知道端点挂了。

## 包的 node 侧那一半

浏览器里取不到的东西（磁盘、进程、Redis、要密钥的第三方接口）得由 node 侧去取。
在 `package.json` 里声明入口即可，**这一项是可选的** —— 绝大多数面板插件只画一个格子，
不该被迫写两个文件。

```json
{
  "name": "hardware",
  "version": "0.1.0",
  "description": "整机硬件占用",
  "repository": "git+https://github.com/Yunzai-NG/hardware-plugin.git",
  "webuiPanel": { "server": "dist/index.js" },
  "dependencies": { "systeminformation": "5.33.2" }
}
```

入口默认导出一个含 `setup` 的对象：

```js
export default {
  setup(ctx) {
    ctx.route("hardware", () => sample())
  }
}
```

`ctx` 是一份**受限上下文**，只有五项：

| 成员 | 说明 |
|---|---|
| `name` | 包名 |
| `dir` | 包目录绝对路径 |
| `dataDir` | webui 的数据目录，可在其下自建子目录存数据 |
| `logger` | `warn` / `error` / `debug`，前缀已带包名 |
| `route(path, handler)` | 注册一条 GET 路由，落在本包自己的前缀之下 |
| `config()` | 取本包当前的配置值，见[给使用者一份配置](#给使用者一份配置) |

给的不是内核的 `PluginContext`：一个面板插件包无从注册到别人的路由上,也看不见内核的
适配器与消息总线。给全套等于让面板插件包变成第二种内核插件，而那个东西已经有了 ——
需要命令、定时任务或适配器的，请写[内核插件](plugin-api.md)。

**路径相对本包，完整地址由 webui 拼**，故浏览器那半用 `api.own("hardware")` 取数，
两处都不必写死前缀。路由**照常鉴权**。

**`ctx.config()` 每次要用时都调一次，别在 `setup` 里取一次存起来**：

```js
export default {
  setup(ctx) {
    // ✓ 每次请求都读当前值，使用者改完下一次请求即生效
    ctx.route("redis", () => {
      const { host = "127.0.0.1", port = 6379 } = ctx.config().redis ?? {}
      return sampleRedis(host, port)
    })
  }
}
```

存下来的那个对象不会跟着使用者的改动变，表现为「改了配置，重启前一直不生效」。
取值一律带兜底：webui 保证类型，但不保证字段一定在（一个手改过的文件、或一份刚更新过的
声明都可能少一项）。若你在 `setup` 里据配置建立了长连接，须自己在取值时比对它是否变了。

`setup` 抛错只废掉这一个包（其余包与面板本身照常），故不必自己兜；但抛错之后清单里
不会给出这个包的接口地址 —— 浏览器那半调 `own` 会直接得到一句「没有 node 侧」而不是
一个稳定 404 的接口。

**依赖要自己装。** `dependencies` 非空即意味着装完这个包之后须在包目录内跑一次包管理器
（商店据此代劳）。已把依赖打进产物里的包写 `webuiPanel.install: false` 声明「无须安装」。
node 侧 import 得到裸包名（它跑在 Node 里），只有浏览器那半不行。

## 样式

面板的 CSS 类可直接用，多数组件靠它们加几行行内样式就够了；样式确实多的包可以自带一份
`.css`（见本节末尾）。

| 类 | 用途 |
|---|---|
| `card` | 一张卡片。**多数组件的最外层应是它** |
| `card fill` | 带标题的卡片，标题留在上沿、其余内容在余下空间里居中 |
| `sub` | 次要说明文字 |
| `mono` | 等宽 |
| `bars` / `bar` / `bar-head` / `bar-label` / `bar-value` / `bar-slot` / `bar-fill` | 线性进度，结构见下 |
| `gauge-hint` | 卡片底部的一行小字 |

线性进度的结构（`bar-fill` 的宽度用百分比，档位类名加在 `bar-value` 与 `bar-fill` 上）：

```js
api.h("div", { class: "bars" }, [
  api.h("div", { class: "bar" }, [
    api.h("div", { class: "bar-head" }, [
      api.h("span", { class: "bar-label mono" }, "CPU"),
      api.h("span", { class: `bar-value ${level}` }, api.fmt.percent(ratio))
    ]),
    api.h("div", { class: "bar-slot" }, [
      api.h("div", { class: `bar-fill ${level}`, style: { width: `${ratio * 100}%` } })
    ])
  ])
])
```

颜色一律取 CSS 变量（`var(--muted)`、`var(--warn)`、`var(--err)`、`var(--raise)`），
不要写死色值 —— 写死的那个在另一个主题下会看不见。

### 行内样式与 CSS 变量

`style` 收对象，故按需的排布直接写在那里，不必为几行样式带一份 `.css`：

```js
api.h("div", { class: "card", style: { display: "grid", gap: "8px" } }, [
  api.h("span", { style: { color: "var(--muted)", fontSize: "12px" } }, "上次更新"),
  // 用变量而非色值：深浅两套主题各自成立，无须自己判断当前是哪一套
  api.h("b", { style: { color: "var(--warn)" } }, text)
])
```

可取的变量与面板自身用的是同一套：

| 变量 | 含义 |
|---|---|
| `--fg` / `--muted` | 前景色 / 次要前景色 |
| `--bg` / `--raise` | 页面底色 / 抬起一层的底色（卡片即用它） |
| `--line` | 描边色 |
| `--accent` | 强调色 |
| `--ok` / `--info` / `--warn` / `--err` | 四色语义色 |
| `--s1` … `--s6` | 间距梯级 |
| `--r-ctl` / `--r-card` | 圆角：控件 / 卡片 |

主题切换只改这些变量的取值，故取变量的写法在两套主题下都成立。

### 自带一份样式表

样式多到不适合写进行内时，**包**可以带一份 `.css`，在 `package.json` 里指出它：

```json
{
  "name": "hardware",
  "version": "1.0.0",
  "description": "硬件信息",
  "repository": "https://github.com/you/hardware-panel",
  "webuiPanel": {
    "style": "style.css"
  }
}
```

路径相对包目录，写 `dist/style.css` 这样的子路径同样可以。只认 `.css` —— 浏览器不编译
scss / less，请给出构建好的那一份。

**每条选择器都会被限定到你这个包自己的地盘。** 面板取到这份 css 的文本，为每条选择器
前置一个 `[data-panel="panels/<包名>"]` 之后才注入页面。于是你写：

```css
.row { display: flex; gap: 8px }
.row .label { color: var(--muted) }
```

实际生效的是：

```css
[data-panel="panels/hardware"] .row { display: flex; gap: 8px }
[data-panel="panels/hardware"] .row .label { color: var(--muted) }
```

这意味着两件事：

- **类名不必加前缀。** 你写 `.row`，撞不到面板的 `.row`，也撞不到别的包的 `.row`。
- **改不到自己以外的东西。** 一份写着 `.card { padding: 0 }` 的样式表只会改你自己那几格
  的卡片，不会把整个面板的卡片压扁。

限定的几条细则：

| 你写的 | 实际生效的 | 为什么 |
|---|---|---|
| `:root { --gap: 8px }` | `[data-panel="…"] { --gap: 8px }` | 换写成你的容器而非前置 —— `[data-panel] :root` 永不匹配（`:root` 是文档根），那样你声明的变量一个都不生效 |
| `html` / `body` / `:host` | 同上 | 同一条道理 |
| `@media (width < 700px) { .row { … } }` | `@media` 保留，里层的 `.row` 被限定 | 限定要落在真正的选择器上 |
| `@keyframes spin { from { … } }` | 原样保留 | 里面是关键帧而非选择器，前置会让整段动画失效 |
| `@font-face` / `@import` | 原样保留 | 与选择器无关 |

`@keyframes` 的**动画名是全局的**，故请自己加前缀（`hardware-spin` 而非 `spin`）——
两个包用了同名动画时，后注入的那一份会盖掉前一份。

样式表取不到（路径写错、文件没了）时**不废掉这个包**：组件照常渲染，只是没有那份样式，
控制台留一句话。这比连数据都看不到要好。

**单文件面板插件没有这项能力** —— 面板要先读 `package.json` 才知道去取哪份 css，而单个
`.js` 没有 `package.json`。写了 `export const style` 不会有任何反应（控制台会说一句）。
需要自带样式表就改成一个包，或者用上面的行内样式。

## 测不到时不要显示 0

这是面板全站的一条口径：**取不到的值应当缺席，而不是记 0。**

`0%` 会被读成「确实空着」，而真相往往是「这台机器上没有可用的探测手段」。故 `fmt` 的
几个函数在收到 `undefined` 时给破折号，而不是 `0%`；线性槽在比例为 `undefined` 时
留空槽。你那半 node 侧也应遵此：测不到的字段**不出现**，而不是填 0。

## 出错时会怎样

五处失败，五种处置：

| 失败处 | 面板的反应 |
|---|---|
| 文件 404、语法错、`import` 了裸包名 | 那一格变成占位格，格内写明文件名与错误原文 |
| 缺自报信息（单文件没写 `meta`、包的 `package.json` 缺字段） | 同上，并写明该补在哪一份文件里 |
| 组件形状不对（缺 `id`、`setup` 不是函数、`page` 写错、声明可调却缺下限） | 同上，并写明是哪一项不对；数组里的一枚不合格只在控制台出声，其余照常上板 |
| 页签形状不对 | 只在控制台出声，不画占位格，不影响这个包的组件 |
| `setup()` 或渲染期抛错 | 只废掉那一格，其余组件照常 |

配置那一路另有三种，一律不影响这个包的组件与页签：

| 失败处 | 面板的反应 |
|---|---|
| `webuiPanel.config` 写坏了（顶层不是 object、`properties` 为空、某字段的 `type` 不认得） | 卡片上一枚「配置未生效」，详情里写明错在哪个字段；没有「配置」按钮 |
| schema 写错了地方（单文件写了 `config` 导出、包写在了 `index.js` 里） | 同上，并写明该挪到哪 |
| 存进来的值类型不符 | 那一次整份拒掉（400），错误标到对应字段上，文件一个字节都不改 |

自带样式表那一路另有两种，同样不影响组件与页签 —— 组件照常渲染，只是没有那份样式：

| 失败处 | 面板的反应 |
|---|---|
| `webuiPanel.style` 写坏了（不是字符串、含 `..` 或盘符、不是 `.css`、指向的文件不存在） | 控制台与内核日志各一句，写明是哪一条 |
| 样式表声明错了地方（单文件、或包写了 `export const style`） | 只在控制台出声 |

任何一种都**不会让面板打不开**，也不会影响别的插件。占位格而非静默跳过：静默跳过之后，
放了一个坏文件却什么都看不见，只能去翻控制台 —— 而多数人不会翻。

占位格挂在概览页：模块没解析成功，无从知道它想挂哪一页。它同时出现在插件页上它所属那个
包的详情里 —— 那里说得清是哪个文件、缺哪一项。