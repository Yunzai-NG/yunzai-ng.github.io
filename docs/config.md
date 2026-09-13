# 配置与面板

## 配置文件的组织方式

一份 schema 声明同时产出三项内容：带中文注释的 YAML、面板表单与写入校验。
因此**修改配置的推荐方式是面板**，直接编辑 YAML 亦可，修改将被热加载。

```
<home>/config/
├─ yunzai.yaml              内核
├─ adapter-napcat.yaml      每个插件一份，文件名即插件名
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
| `ignoreSelf` | `true` | 关闭后将处理自身发出的消息，易形成死循环，仅供调试 |
| `onlyMaster` | `false` | 维护模式：仅响应主人。用于线上排障期间隔离其他用户 |

### 日志 `log`

`level`（trace 至 silent）、`consoleLevel` / `fileLevel`（留空则跟随 `level`；常见用法为
文件记录 debug 而控制台仅显示 info）、`color`、`keepDays` 14、`maxSize` 8（MB）、`maxFiles` 100。

### 存储 `store`

`driver`：`auto`（默认，优先使用内嵌 level，无法装载时回退至 JSON）/ `level` / `json`（纯 JS
实现，Termux 上最为稳定）/ `memory`（重启即丢失，供测试使用）。`dir` 留空则使用 `data/store/`。
`sqlite` 默认开启，原生模块不可用时自动降级为纯 KV。

Redis 不在此处 —— 它是可选的 KV 驱动插件。旧框架硬依赖 Redis，未部署即无法启动。

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
`hotReload`（开发用途，卸载时回收该插件登记的全部资源）、`loadTimeout` 30 秒
（超时的插件被跳过并记录错误，**不影响启动流程** —— 旧框架中单个插件阻塞将导致整个 Bot
无法启动）。

### 插件市场 `market`

`sources`（索引地址列表，靠前者优先）、`mirror`（GitHub 镜像前缀）、`cacheTtl` 1 小时、
`timeout` 15 秒。索引格式与安装语义详见[插件市场](market.md)。

### 消息 `message`

`cooldown` 全局冷却（0 表示不限，命令自身声明的值优先）、`splitLength` 3000（长文本切分，
切点优先取换行与空白）、`sendTimeout` 30 秒、`sequential` true（同会话串行发送，
以保证到达顺序）、`concurrency`（命令处理并发上限，留空表示不限）。

`concurrency` 是低内存设备最应调整的一项：设为 2~4 可避免多张图同时渲染耗尽内存；
设置过小则会使等待用户应答一类的交互式命令相互排队。**该项修改后需重启生效**，
其余消息与渲染选项均即时生效。

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

0.5.2 之前这四项的缺省是 `0` / `2s` / `1m` / `2`（即无限重连、2 秒起步、逐次翻倍）。
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

**在面板的账号页改**：那一行的「配置」里除适配器自己的字段外另有一节「重连策略」。四项各自可
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
需要内核 0.5.2 及以上；更早的版本会报「适配器 X 未注册」。
:::

### 网络 `net`

`proxy`（留空则读取 `HTTPS_PROXY` / `HTTP_PROXY`）、`timeout` 20 秒、`retry` 2
（仅对幂等请求与网络层错误重试）、`userAgent`。

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
4. **令牌恒于启动阶段生成**：`server.token` 为空时生成 16 位字母数字，写入配置文件并
   输出至日志（首次打开面板须从日志里抄入）。**与监听地址无关** —— 早先仅监听本机时不生成，
   理由是「单机部署不该为打开面板先抄一串随机字符」，但那让本机部署处在一种没有门的状态：
   使用者浏览器里的任何页面都能向 `127.0.0.1:2536` 发请求，而那正是面板的全部写权限。

   令牌抄丢了可经 `POST /api/token/reveal` 重新打进日志一次（面板令牌页有一枚按钮）。
   该端点**不鉴权**（需要它的人恰恰没有令牌）、只放行本机对端，且**响应体一个字节都不带
   令牌** —— 带上就等于任何本机页面都能取到写权限。
5. **令牌被手工清空时仅接受本机请求**：来自其他地址的请求一律 401 并说明须设置
   `server.token`。这是兜底路径，正常启动过后不会走到。非本机监听而令牌短于 16 位时输出 warn。
6. **只读模式**（`server.readonly`）：面板可查看但不可修改。

对外暴露前应确认：设置足够长的令牌、置于 HTTPS 反向代理之后、正确填写 `publicUrl`。

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
store:
  driver: json        # 纯 JS 实现，不需要原生模块
message:
  concurrency: 2      # 修改后需重启
render:
  scale: 1
```

另将 renderer-puppeteer 的 `pages` 设为 1、`restartAfter` 调小（如 50）。
实测数据见[性能基线](perf.md)。

## 配置热加载

启动后内核将监听配置目录。修改文件，或经面板与 API 修改，均会触发 `onChange`，
**回调附带变更路径**，因此插件可仅失效受影响的部分。旧框架的 `mergedCache`
在任何变动时整体 `clear()`。少数配置项标注为需重启生效，面板中会予以说明。
