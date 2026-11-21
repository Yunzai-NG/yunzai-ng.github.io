# 配置与面板

## 配置文件的组织方式

一份 schema 声明同时产出三项内容：带中文注释的 YAML、面板表单与写入校验。
因此**修改配置的推荐方式是面板**，直接编辑 YAML 亦可，修改将被热加载。

```
<home>/config/
├─ yunzai.yaml              内核
├─ renderer-puppeteer.yaml  每个插件一份，文件名即插件名
├─ renderer-puppeteer.yaml
└─ mhy-game.yaml
```

规则是**由消费方声明**：插件的配置由插件自身以 `configSchema` 声明，各自独立成文件。
旧框架的 `config/default_config/other.yaml` 中混入了 `autoQuote`、`disableGuildMsg`
一类仅插件关心的开关，导致内核配置与业务配置相互纠缠。

## 内核配置：config/yunzai.yaml

### 基础 `bot`

| 键 | 缺省 | 说明 |
|---|---|---|
| `masterQQ` | `[]` | 主人，拥有全部权限。留空时于首次经面板绑定。填适配器给出的原始 id，不限于纯数字：QQ 号为纯数字，QQ 官方机器人为 32 位 openid（如 `FF23DED2F67B06F46C7A23AE9BB7C5AE`），频道用户带 `qg_` 前缀（如 `qg_2492083538938174755`） |
| `prefix` | `["#", "*", "%"]` | **仅以这些字符开头的消息进入命令路由**。留空表示不作限制，将显著增加匹配开销 |
| `nickname` | `[]` | 群内以昵称开头等同于 @ 机器人 |
| `onlyMaster` | `false` | 维护模式：仅响应主人。用于线上排障期间隔离其他用户 |

`ignoreSelf` 已下放给适配器：自身消息投不投由它决定（adapter-onebot 是账号配置项 `ignoreSelf`，
缺省不投），内核不再过滤。老配置里残留的那一行会被静默忽略，不必手动删。

### 日志 `log`

`level`（trace 至 silent）只管**控制台看什么**，也是面板日志页不指定级别时的缺省过滤。
`consoleLevel` 留空即跟随 `level`。

`fileLevel` 留空即**记全部**（trace），不跟随 `level`：调低级别是为了少看，而没落盘的历史
补不回来 —— 复现不了的缺陷正靠它翻回去查。于是面板上把级别调到 debug，之前那段 debug 也在。
要少记才显式填 `fileLevel`。内核入站消息日志保留账号、场景、发送者和消息段数，不记录正文。

其余：`color`、`keepDays` 14、`maxSize` 8（MB）、`maxFiles` 100。轮转参数重载后从下一次滚动起生效；`color` 开启时仍尊重终端能力和 `NO_COLOR`。

### 存储 `store`

KV 数据存在 `dir`（留空即 `data/store/`）下的 **`kv.db`** 一个文件里，格式是 SQLite。这个文件在 Windows、
Linux、macOS 与安卓之间通用，换机器直接拷，见[搬到另一台机器](#搬到另一台机器)。

`driver`：`sqlite`（默认）/ `memory`（重启即丢失，只供测试）。旧配置里的 `auto` / `level` / `json` 照收，
都当 `sqlite`，不必手动改。读写 `kv.db` 用 better-sqlite3，它装不上时改用 Node 自带的 `node:sqlite`
（Node 22.13 起）；两者读写同一种文件。两者都不可用时**启动直接报错**，不会退到内存 —— 那样每次重启账号与插件数据全丢。

`sqlite` 管的是**插件 SQL 库**（插件自己建表的那种，落在 `data/sql/<插件>/`），默认开启，需要 better-sqlite3；
它装不上时，用到 SQL 的插件拿到一条错误说明，只用 KV 的插件不受影响。

**旧版数据自动迁移。** 此前的版本把 KV 存在 `kv/`（LevelDB）或 `kv.json`（JSON）里。升级后首次启动时，
内核把它们迁进 `kv.db`，核对条数一致后把原件改名为 `kv.migrated-<时间>` / `kv.json.migrated-<时间>` 保留，不删。
迁移先写临时文件 `kv.db.migrating`，途中断电或被杀不会留下半截的 `kv.db`，下次启动重来。

LevelDB 只有原生模块 classic-level 读得了。它在本机加载不了（安卓多半如此）时启动会报错并指路：
回到原来那台机器上升级并启动一次完成迁移，或在那里 `yzng data export`。

存储只由内核负责，没有 Redis 选项，插件也不能注册驱动接管存储：账号凭据与全部插件的数据同在一个库里。
旧框架硬依赖 Redis，未部署即无法启动；这里不需要它。

#### 搬到另一台机器

- **同样跑新版内核的两台机器**：停掉实例，把 `config/` 与 `data/` 整个拷过去即可。`kv.db` 是普通文件，不挑系统。
- **原机器还是旧版数据、或想要一份干净的副本**：用 [`yzng data export`](/cli#data) 导出，到新机器上 `yzng data import`。
  导出不改动原机器上的任何文件，旧版数据在导出里已经转成 `kv.db`。
- 配置里写死的绝对路径（`store.dir`、`plugins.dirs`、插件里的目录项）换了系统多半不对，`import` 会逐行列出来。

### 面板 `server`

| 键 | 缺省 | 说明 |
|---|---|---|
| `enable` | `true` | 关闭则不启动 HTTP 服务，机器人照常收发消息 |
| `host` | `127.0.0.1` | 仅监听本机 |
| `port` | `2536` | |
| `token` | 空 | 留空时于启动阶段自动生成 16 位并落盘，同时打进日志一次。**与监听地址无关** |
| `readonly` | `false` | 面板仅可查看，不可修改配置、不可重载插件 |
| `publicUrl` | | 反向代理场景下用于拼接回调 URL |

### 插件 `plugins`

`dirs`（额外扫描目录）、`disabled`（按插件名精确匹配，禁用后完全不加载、不占用内存）、
`watchScripts`（单文件插件热加载，缺省开：往插件目录里放进、拿走、改动单文件 js 即自动加载、卸载、重载，改本项要重启）、
`hotReload`（开发用途，卸载时回收该插件登记的全部资源）、`loadTimeout` 30 秒
（超时的插件被跳过并记录错误，**不影响启动流程** —— 旧框架中单个插件阻塞将导致整个 Bot
无法启动）。

### 插件市场 `market`

`sources`（索引地址列表，靠前者优先）、`mirror`（GitHub 镜像前缀）、`cacheTtl` 1 小时、
`timeout` 15 秒。索引格式与安装语义详见[插件市场](market.md)。

### 消息 `message`

`cooldown` 全局冷却（0 表示不限，命令自身声明的值优先）、`splitLength` 3000（长文本切分，
切点优先取换行与空白）、`sendTimeout` 30 秒（发送超时与重连间隔须为 1～2147483647 毫秒）、`sequential` true（同会话串行发送，
以保证到达顺序）、`concurrency`（命令处理并发上限，留空表示不限）。

`concurrency` 是低内存设备最应调整的一项：设为 2~4 可避免多张图同时渲染耗尽内存；
设置过小则会使等待用户应答一类的交互式命令相互排队。**该项修改后需重启生效**，
其余消息与渲染选项均即时生效。

### 群配置 `scope`

按群设前缀、禁用插件或命令。**只管群聊**，私聊不受影响。面板里在**配置 → 消息**：全局群前缀与全局禁用就在那一栏，
跟着页面底部的保存钮走；「编辑群配置」打开右侧抽屉，挑账号、挑群来设，群列表取自在线账号。

| 键 | 缺省 | 说明 |
|---|---|---|
| `prefix` | `[]` | 全局群前缀，可以填几个。填了之后群里要先带上其中一个：前缀 `小云` 时发 `小云#帮助` 才响应，直接发 `#帮助` 不理。剥掉前缀后再交给插件，插件看到的仍是 `#帮助` |
| `disabled` | `[]` | 全局禁用：写插件名禁整个插件，写 `插件名:命令名` 只禁那一条 |
| `presets` | `[]` | 规则组：起好名字的一套前缀与禁用，见下 |
| `rules` | `[]` | 群配置，见下 |

`rules` 的每一条：`account`（机器人账号，`*` 为所有机器人）、`groups`（群号，留空为这个账号的全部群）、
`preset`（填规则组名即整套套用，下面几项不再看）、`prefixMode`（`inherit` 沿用全局 / `custom` 用本条的 `prefix` /
`none` 不要前缀）、`ownDisabled`（为真时只认本条的 `disabled`，全局禁用对这些群不再生效）。`presets` 的每一组与之同形，
多一个 `name`、没有 `account` 与 `groups`；面板新建时叫「组1」「组2」。改了规则组，套用它的群一并跟着变；规则组被删或改名而
群配置里还引用着旧名时，按那条群配置自己那几项走。

**群配置优先于全局**，写了的项整项覆盖，没写的沿用：全局禁了抽卡、只在某个群放开，就给那个群一条
`ownDisabled: true` 而 `disabled` 留空。一个群落进几条群配置时按四档取：账号与群号都对上的、`*` 而群号对上的、
账号对上而管全部群的、`*` 且管全部群的；同一档里靠后的那条优先。

**群配置只管接受群配置的机器人**：提供它那个适配器的插件声明了 `groupRules`（见[插件 API](plugin-api.md#defineplugin)；
adapter-onebot 0.7.1 起已声明）。面板里也只列这些账号、能取它们的群列表来配。没声明的适配器（如终端 adapter-stdin）名下的机器人
在群里照常收发，前缀与禁用都不管。禁用清单列出所有注册了命令的插件。

主人同样受约束：在某个群禁了的插件，主人在那里也叫不动 —— 不然主人自己试一下发现还能用，会以为禁用没生效。
`e.prompt()` 等回话那一步不要求前缀。改完下一条消息即生效。
### 渲染 `render`

`default` 渲染器注册名（缺省为 `puppeteer`）、`timeout` 60 秒、`retry` 1、`quality` 90、
`scale` 1（等价于旧框架的 `renderScale / 100`）。

### 适配器 `adapter`

账号断线后的自动重连策略，四项都是**全局缺省**，单个账号可在自己的记录里逐项覆盖。

| 键 | 缺省 | 说明 |
|---|---|---|
| `reconnectLimit` | `5` | 连续失败多少次后放弃。`0` 是「一直重连」而非「不重连」 |
| `reconnectInterval` | `5s` | 第一次失败之后等多久再试 |
| `reconnectMaxInterval` | `1m` | 退避增长到此为止 |
| `reconnectFactor` | `1` | 每失败一次把等待乘上这个数。缺省的 `1` 表示不退避、始终按 `reconnectInterval` 重试 |

缺省这套（5 次、5 秒一试、不退避）照着最常见的部署来定：对端是本机的 NapCat，掉线多半几秒内
就回来，退避只是白等；而真连不上的号（配置写错、对端没起）在半分钟内停下来，比无休止重试更容易
被发现。对端在公网、可能长时间不在线时才值得把 `reconnectFactor` 调大，免得反复敲门。

0.6.0 之前这四项的缺省是 `0` / `2s` / `1m` / `2`（即无限重连、2 秒起步、逐次翻倍）。
**已有的 `config/yunzai.yaml` 里落盘的值优先于新缺省**，要用新值得自己改那份文件或删掉这四行。

计数说的是「**连续**失败多少次」：连上一次即归零，面板点「重连」也归零。故达到上限之后仍有一条
出路，不必重启进程。达到上限时状态留在 `error` 上，并输出一条 warn 说明此后不再自动重试。

设一个上限的意义在于：号被封、配置填错这类失败重试一万次也是同样的结果，而无休止的重试会把
日志里真正要看的东西刷走。

#### 按账号覆盖

账号记录里的 `retry` 可覆盖上述四项（键名去掉 `reconnect` 前缀：`limit`、`interval`、
`maxInterval`、`factor`），**逐项可缺，缺的那项各自回落到全局值**。诉求是真实的：连本机
NapCat 的号连不上多半是配置写错了，重试几次就该停；连远程网关的号可能只是网络抖动，值得一直
试下去 —— 一个全局数字满足不了两者。

回落逐字段而非整套二选一：只想给某个号设个上限，不该因此被迫把退避那三个数也抄一遍 ——
抄来的那份此后不跟着全局改动走，而没人记得自己抄过。

**在面板的账号页改**：那一行的「配置」里，适配器自己的那几栏之后另有一个「重连策略」页签。四项各自可
留空，留空即跟随全局，每项下方给出全局此刻的值。留空**不等于填 0** —— `limit` 为 0 是「一直
重连」、`interval` 为 0 是「不等待、立刻重试」，两者都是合法取值。另有一枚按钮把四项一并改回
跟随全局。

也可经 `POST /api/accounts` 与 `PATCH /api/accounts/:id` 的请求体 `retry` 设置；`PATCH` 传
`retry: null` 清掉覆盖、回到跟随全局。时长两项收毫秒数或 `"2s"` 这类表达式，与全局配置一致。

只改 `retry` 的 `PATCH` 不会踢掉一个正在线的号 —— 重连策略下一次失败时才用得上，为它断一次线
是白断（改地址、改 token 时仍会断开重连，那是必须的）。同理，面板只在适配器配置真的改过时才把
`config` 一并提交，故保存按钮的文案随内容而变。

自定义过重连策略的账号在列表里会标出来，并列出填了哪几项。这是一条看不见的状态，而「这个号
为什么不再重试了」的答案往往就在里面。

::: tip 适配器插件被卸载的账号
它名下的账号记录是刻意留着的（把插件装回来就自动连上）。备注与这四项**照旧改得动** ——
两者都不经适配器。`config` 仍会被拒绝：没有 `accountSchema` 就无从判断填进来的东西对不对。
需要内核 0.6.0 及以上；更早的版本会报「适配器 X 未注册」。
:::

### 网络 `net`

`proxy`（未配置时按目标协议读取 `HTTPS_PROXY` / `HTTP_PROXY`，缺省退回 `ALL_PROXY`；环境代理支持小写变量、`NO_PROXY` 的主机/域名、可选端口与 `*`，并绕过回环地址）、`timeout` 20 秒（`download()` 与流式读取只限到响应头，
之后按两次收到数据的间隔计，大文件不会下到一半被掐断）、`retry` 2
（只对 GET / HEAD / OPTIONS / PUT / DELETE 生效；POST 与 PATCH 重发会让对方执行两遍，缺省不重试，
插件确需重试时在那一次请求上写 `retry`）、`userAgent`。

## 面板

默认地址为 `http://127.0.0.1:2536`，含十个页面：**概览 / 账号 / 日志 / 插件 / 扩展页面 /
插件市场 / 面板商店 / 配置 / 帮助 / 外观**。配置页的表单并非手写，而由各插件的 schema 生成 ——
插件新增配置项后面板自动出现控件，不存在"修改校验而遗漏表单"的情形。

### 安全姿态

沿用旧面板 `lib/tools/panel/server.js` 的底线，并将其固化为启动时的断言：

1. **默认仅监听 `127.0.0.1`。**
2. **令牌仅自请求头读取**：`Authorization: Bearer <令牌>` 或 `x-yunzai-token`，
   WebSocket 经 `Sec-WebSocket-Protocol: yunzai, <令牌>` 传递。
   **不读取查询串与 Cookie** —— 由此免疫 CSRF，亦不会将令牌留存于浏览器历史与
   反向代理日志中。
3. **比较使用 `timingSafeEqual`**，而非 `===`。
4. **令牌恒于启动阶段生成**：`server.token` 为空时生成 16 位字母数字，写入配置文件；启动日志只提示位置，不输出令牌。**与监听地址无关** —— 早先仅监听本机时不生成，
   理由是「单机部署不该为打开面板先抄一串随机字符」，但那让本机部署处在一种没有门的状态：
   使用者浏览器里的任何页面都能向 `127.0.0.1:2536` 发请求，而那正是面板的全部写权限。

   令牌抄丢了可经 `POST /api/token/reveal` 重新打进日志一次（面板令牌页有一枚按钮）。
   该端点**不鉴权**（需要它的人恰恰没有令牌）、只放行本机对端，且**响应体一个字节都不带
   令牌** —— 带上就等于任何本机页面都能取到写权限。
5. **令牌被清空时立即补一个**：运行中经面板或手改文件把 `server.token` 清空，内核当场重新生成但不向日志输出令牌。
   补上之前的那一瞬只接受本机对端，且 `Host` 必须是 `localhost` / `127.0.0.1` / `[::1]`（挡 DNS 重绑定：
   恶意域名被解析到 127.0.0.1 时，浏览器把它当同源）。非本机监听而令牌短于 16 位时输出 warn。
6. **别的网页发来的写请求与 WebSocket 握手一律 403**：判据是浏览器自填的 `Sec-Fetch-Site`
   （须为 `same-origin` 或 `none`，经反向代理也不变），旧浏览器退回比 `Origin` 与 `Host`。
   写请求带请求体时必须声明 `Content-Type: application/json`：不声明类型的请求体同样能被别的网页造出来。
   脚本、curl 一类的客户端不带这几个头，不受影响。
7. **只读模式**（`server.readonly`）：面板可查看但不可修改。
8. **鉴权失败限流**：同一个外部地址 10 分钟内令牌错满 30 次，暂时拒绝它 15 分钟（429，带
   `Retry-After`），封禁期间带对令牌也不放 —— 不然猜中的那一次照样进得来。本机地址不计：
   经反向代理进来的请求对端都是本机，那时限流交给代理做。
9. **基础安全响应头**：每个响应带 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: no-referrer`；
   HTML 另带 `X-Frame-Options: SAMEORIGIN` 与 `Content-Security-Policy: frame-ancestors 'self'`，
   别的网站因此不能把面板嵌进自己的页面骗人点「删除」。处理函数自己给了这两个头时以它的为准，
   要被别处嵌入的插件页可以这样放行。
10. **监听在非本机地址时启动日志提醒一次**：本服务器不提供 HTTPS，令牌会明文经过网络。

`auth: false` 的路由（适配器 webhook）不过第 6 条：它们本就是给外部程序调的，各自验签。
不该被网页调用的那种，插件可用内核导出的 `isBrowserRequest(req.headers)` 自己挡，adapter-onebot 即如此。

### 暴露到公网

**没有「绝对安全」。** 面板的令牌等于这台机器的控制权：拿到它的人能装任意插件（插件就是任意代码）、
改配置、跑 SQL、列目录。上面那些措施挡的是「没有令牌的人」，挡不住「令牌已经泄露」。故：

1. **能不暴露就不暴露。** 只在自己用时，走 SSH 隧道或 Tailscale / ZeroTier 一类的组网，面板仍只监听 `127.0.0.1`；
2. 必须暴露时，**放在 HTTPS 反向代理之后**（Nginx / Caddy），并正确填写 `publicUrl`；可以的话在代理上再加一层
   基本认证或 IP 白名单；
3. 用自动生成的 16 位令牌，或更长的；怀疑泄露就改掉 `server.token` 并重启；
4. 只给人看、不给人改的，打开 `server.readonly`。

**为什么不给删 KV 之类的操作加一道验证码。** 那道码只能防「拿着令牌的人不在电脑跟前」，而拿着令牌的人
不必经过那个按钮：他可以直接装一个插件去删数据文件。给一个按钮加码，安全上是错觉，使用上是负担。面板对
误操作的办法是：删一个键、删勾选的键之后提示条上有几秒「撤销」；清空整个前缀要先键入那个前缀。

### HTTP API

面板前端即基于该接口，位于 `/api` 之下，鉴权方式同上：

```
GET    /api/overview                    概览
GET    /api/system                      磁盘与显卡（容量与型号，不含任何路径）
GET    /api/config                      配置文件列表
GET    /api/config/:name                单份配置（含 schema 描述）
PATCH  /api/config/:name                局部更新
PUT    /api/config/:name                整体替换
POST   /api/config/:name/reset          恢复默认
GET    /api/plugins        /:name        插件列表 / 详情
POST   /api/plugins/:name/reload        重载
POST   /api/plugins/:name/unload        卸载
GET    /api/market                      市场索引（`?refresh=1` 强制刷新）
POST   /api/market/refresh              刷新索引
POST   /api/market/install              安装，请求体 `{ name, load?, dependencies? }`
GET    /api/market/:name/update-probe   探测：会不会就地拉取、目录里有没有改动（只读）
POST   /api/market/:name/update         更新，请求体 `{ stash?, fresh?, load?, dependencies? }`
POST   /api/market/:name/setup          只重跑装依赖与装后步骤，不重新取源
DELETE /api/market/:name                卸载并删除目录
GET    /api/commands  /tasks            命令 / 定时任务清单
GET    /api/middlewares                 中间件清单，顺序即实际执行顺序
GET    /api/adapters  /renderers        已注册的适配器 / 渲染器
GET    /api/accounts       /:id          账号列表 / 详情
POST   /api/accounts                    新建，请求体可带 `retry`
PATCH  /api/accounts/:id                修改；`retry: null` 清掉该账号的重连覆盖
DELETE /api/accounts/:id                删除
POST   /api/accounts/:id/connect | disconnect | reconnect
GET    /api/logins         /:id          交互式登录会话
POST   /api/logins                      发起
POST   /api/logins/:id/answer           回答一步
DELETE /api/logins/:id                  取消
GET    /api/logs                        日志查询（历史）
WS     /api/logs                        实时日志，只推此后新产生的记录
GET    /api/server                      服务器信息
GET    /api/fs                           列目录（只读；只读模式下 403）
POST   /api/token/reveal                把当前令牌重新打进日志（仅本机、响应体不带令牌）
```

`GET /api/logs` 与 `WS /api/logs` 分工不同：历史走前者，实时走后者，**后者只推握手之后新产生的
记录**。筛选条件写在握手的查询串里而非握手后发一帧配置过来 —— 后者存在「配置帧到达之前已经推了
一批不该推的记录」的窗口期。WebSocket 的令牌经 `Sec-WebSocket-Protocol` 传递。

`GET /api/fs` 在**只读模式下返回 403**，与其余只读端点不同：它能看见整棵目录树，而只读模式的
用意正是「这台面板不该泄露超出运行状态的东西」。`GET /api/system` 反过来，只读模式下照常可用 ——
它报的是容量与型号，不含任何路径或文件名。

`market/:name/update-probe` 与 `token/reveal` 是两个刻意不对称的端点：前者只读故不要求写权限，
后者 `auth: false` —— 需要它的人恰恰是被令牌页挡在外面的那个人，故它把令牌写进日志而**不放进
响应体**，否则任何本机页面都能取到面板的全部写权限。

插件自身的路由挂载于 `/plugin/<插件名>`，适配器的路由挂载于 `/adapter/<适配器 id>`，
与 `/api` 互不干扰。

### 未安装面板插件时的行为

内核不自带面板前端。未安装 `webui` 插件时，站点根路径无人提供，仅 `/api` 可用；
启动日志会给出一条指向插件市场的提示。该情况不影响机器人 —— 面板与消息收发相互独立，
端口被占用时亦然。

## 低内存设备

Termux 与小内存 VPS 推荐以下配置：

```yaml
message:
  concurrency: 2      # 修改后需重启
render:
  scale: 1
```

存储不用改：better-sqlite3 编译不过时内核自动用 Node 自带的 `node:sqlite`，要求 Node 22.13 及以上（Termux 的 `nodejs` 包满足）。

另将 renderer-puppeteer 的 `pages` 设为 1、`restartAfter` 调小（如 50）。
实测数据见[性能基线](perf.md)。

## 配置热加载

启动后内核将监听配置目录。修改文件，或经面板与 API 修改，均会触发 `onChange`，
**回调附带变更路径**，因此插件可仅失效受影响的部分。旧框架的 `mergedCache`
在任何变动时整体 `clear()`。少数配置项标注为需重启生效，面板中会予以说明。

### 日常消息日志（mark）

`debug < mark < info`。普通平台消息在当前分发结束时归类：没有被命令、等待回复、中间件消费，也没有通过 `e.reply()` 尝试回复，则记灰色 `mark`。仅旁听统计不算响应。入站日志默认附最多 240 字的单行正文摘要；常见 token、Cookie、密码字段与 URL 用户信息会遮蔽，媒体只显示摘要。设置 `log.messageContent: false` 可隐藏正文。新生成配置默认显示 `mark` 及以上；已有配置若显式保存了 `log.level: info`，请改为 `mark` 才会在控制台显示。文件级别和面板筛选独立。
