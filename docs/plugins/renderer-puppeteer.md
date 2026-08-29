# renderer-puppeteer

以 Chromium 把模板渲染成图片。art-template + 可选的 Tailwind。

## 它做什么

内核对「怎么把 HTML 变成图片」零认知，只负责在多个渲染器里择一可用者。这个插件是那个实现：
接一份模板与数据，出一张 PNG。

## 怎么装

在插件市场里装，装完在插件目录下执行 `pnpm run install:browser` 下一份无头浏览器
（`chrome-headless-shell`，约 100MB，落在主目录的 `cache/puppeteer` 下）。

**不探测系统上的 Edge 与 Chrome。** 系统浏览器的版本随机器漂移，而 `puppeteer-core` 只与一个
固定构建配套 —— 用系统浏览器出图时，「某台机器上少一块背景、多一道边框」这类问题无从复现。
故改由脚本下载固定版本，构建号记在 `package.json` 的 `yunzai.browserBuildId`，升级
`puppeteer-core` 时同步。

需要覆盖时还有两条：配置项 `chromiumPath` 指向自备的可执行文件；或配 `wsEndpoint`
连一个已在运行的实例（多实例共用一个浏览器）。

::: tip Linux ARM64 与 Termux 例外
Chrome for Testing 不发布这两个平台的构建 —— arm64 上「下载成功」得到的其实是 x86 二进制，
Android 更是连平台都识别不出。这两处需自行 `apt install chromium` / `pkg install chromium`，
插件会自动用系统那一份。装不上时可以只用文字回复：渲染器不可用不影响收发消息，内核会在插件调
`ctx.render()` 时给出一条可读的错误。
:::

一个都没有时插件照常加载，只是渲染时给出一句说明原因的错误 —— 而不是让整个插件加载失败。

## 关键实现

**不 import puppeteer 的那一半逻辑单独成文件。** 页面池与生命周期在 `src/browser.ts`，真实的
puppeteer 调用收敛在 `src/launcher.ts` —— 于是页面池的逻辑在没装浏览器的机器上也受测。

**并发闸门在渲染器一侧。** 内核明确不限并发（它无从得知页面池容量），故此处必须限，否则一条群
消息触发数张图就能在 1GB 内存的设备上耗尽 Chromium 可用内存。上限按机器内存推导，低内存设备
取串行。

**启动是 single-flight。** 用一个布尔量做锁的话，冷启动期间并发到达的渲染会直接失败，而使用者
看到的是「渲染失败」；此处让它们共同等待同一个启动 promise。

**断开后延迟重启。** 在 `disconnected` 里立即重启会让每日只出一张图的实例常驻一个 Chromium
进程；此处只标记为不可用，待下一次实际渲染时再启动。

**区分「自行启动」与「连接接入」。** 靠 `isConnected` 推断会在推断错误时关掉他方的共享浏览器，
故显式记录来源：`external` 只 disconnect，`launch` / `reconnect` 才 close。

**模板缓存是有界 LRU 加读取时比对 mtime**，不为每个模板注册 watcher —— 后者只增不减，既泄漏
又占句柄。子模板也进缓存：不传 filename 而关掉 art-template 的缓存，会让 `include` / `extend`
的每一层在每次渲染时都重新读盘与解析。见 `src/template.ts`。

**注入 `<base href>` 指向模板所在目录。** 模板里写 `href="./style.css"` 最自然，而中间 HTML 在
临时目录，缺 base 必然 404。靠相对层级计算规避的话，模板目录一挪就白屏。

**Tailwind 不引入构建步骤。** 用 v4 的程序化接口，候选类名取自已渲染出的 HTML 本身 —— 比扫描
源码更准，运行期拼出来的类名也在其中。`tailwindcss` 是可选依赖，动态 `import()` 加载，缺失时整体
降级为空操作（旧模板不含工具类，毫无影响）。见 `src/tailwind.ts`。

**编译是插件显式声明才做的。** 在 `defineTemplate()` 的第三参里写 `{ tailwind: true }` 才编译，
未声明即不编译 —— 于是不用工具类的插件既不必装 `tailwindcss`，也不会看到与它无关的编译告警。
渲染器无从判断一段 HTML 里的 `class="flex"` 是工具类还是模板自带的规则，猜错的代价还不对称：
该编译而未编译只是少了样式，不该编译而编译了会引入 preflight，把现存模板的边距与字号一并重置。

## 源码在哪

[Yunzai-NG/renderer-puppeteer](https://github.com/Yunzai-NG/renderer-puppeteer)

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 渲染器注册与配置 schema |
| `src/browser.ts` | 浏览器生命周期与页面池（不 import puppeteer） |
| `src/launcher.ts` | 真实的 puppeteer 调用 |
| `src/chromium.ts` | 定位已下载的无头浏览器与启动参数 |
| `src/template.ts` | art-template 编译层与临时 HTML |
| `src/tailwind.ts` | 按已渲染 HTML 里的类名编译一段 `<style>` |
| `src/screenshot.ts` | 截图参数与出图 |
