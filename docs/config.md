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
| `masterQQ` | `[]` | 主人，拥有全部权限。留空时于首次经面板绑定 |
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
| `token` | 空 | 留空时仅接受本机请求；`host` 为非本机地址而此项为空时于启动阶段自动生成并落盘 |
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

### 网络 `net`

`proxy`（留空则读取 `HTTPS_PROXY` / `HTTP_PROXY`）、`timeout` 20 秒、`retry` 2
（仅对幂等请求与网络层错误重试）、`userAgent`。

## 面板

默认地址为 `http://127.0.0.1:2536`，含八个页面：**概览 / 账号 / 日志 / 插件 / 插件市场 /
面板商店 / 配置 / 帮助**。配置页的表单并非手写，而由各插件的 schema 生成 —— 插件新增配置项后
面板自动出现控件，不存在"修改校验而遗漏表单"的情形。

### 安全姿态

沿用旧面板 `lib/tools/panel/server.js` 的底线，并将其固化为启动时的断言：

1. **默认仅监听 `127.0.0.1`。**
2. **令牌仅自请求头读取**：`Authorization: Bearer <令牌>` 或 `x-yunzai-token`，
   WebSocket 经 `Sec-WebSocket-Protocol: yunzai, <令牌>` 传递。
   **不读取查询串与 Cookie** —— 由此免疫 CSRF，亦不会将令牌留存于浏览器历史与
   反向代理日志中。
3. **比较使用 `timingSafeEqual`**，而非 `===`。
4. **令牌为空时仅接受本机请求**：来自其他地址的请求一律 401，并在响应中说明须设置
   `server.token`。仅监听本机时不会自动生成令牌 —— 单机部署无须为打开面板先抄一串随机
   字符；`host` 改为非本机地址而令牌仍为空时，启动阶段自动生成一份、写入配置并输出至日志。
5. **非本机监听时输出 warn**：未设置令牌，或令牌短于 16 位。
6. **只读模式**（`server.readonly`）：面板可查看但不可修改。

对外暴露前应确认：设置足够长的令牌、置于 HTTPS 反向代理之后、正确填写 `publicUrl`。

### HTTP API

面板前端即基于该接口，位于 `/api` 之下，鉴权方式同上：

```
GET    /api/overview                    概览
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
POST   /api/market/install              安装，请求体 `{ name, load? }`
POST   /api/market/:name/update         更新
DELETE /api/market/:name                卸载并删除目录
GET    /api/commands  /tasks            命令 / 定时任务清单
GET    /api/adapters  /renderers        已注册的适配器 / 渲染器
GET    /api/accounts       /:id          账号列表 / 详情
POST   /api/accounts                    新建
PATCH  /api/accounts/:id                修改
DELETE /api/accounts/:id                删除
POST   /api/accounts/:id/connect | disconnect | reconnect
GET    /api/logins         /:id          交互式登录会话
POST   /api/logins                      发起
POST   /api/logins/:id/answer           回答一步
DELETE /api/logins/:id                  取消
GET    /api/logs                        日志查询
GET    /api/server                      服务器信息
```

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
