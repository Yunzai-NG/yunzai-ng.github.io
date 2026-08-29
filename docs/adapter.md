# 适配器开发

"账号登录亦为插件"这一原则即落在这一层。内核不知晓 QQ 的存在，仅知晓
**某个插件声称能将一份账号配置转为一个可收发消息的驱动**。

旧框架的 `lib/bot.js` 直接书写 `class Yunzai extends Client`（icqq），更换协议端只能借助
`skip_login` 并覆写 `global.Bot`。

## 三个接口

| 接口 | 实现方 | 职责 |
|---|---|---|
| `AdapterProvider` | 插件 | 描述适配器自身、校验账号配置、创建驱动 |
| `BotDriver`（即 `BotApi` 与 `connect` / `disconnect`） | 插件 | 每账号一个实例，承担实际收发 |
| `AdapterHost` | 内核 | 适配器接触外界的唯一入口：日志、KV、事件投递、路由挂载、缓存 |

```ts
export default definePlugin({
  name: "adapter-xxx",
  setup(ctx) {
    ctx.registerAdapter({
      id: "xxx",
      name: "XXX (示例)",
      platform: "xxx",
      accountSchema: ACCOUNT_SCHEMA.describe(),
      validateAccount: input => ACCOUNT_SCHEMA.parse(input),
      createBot: (account, host) => new XxxBot(account, host)
    })
  }
})
```

`accountSchema` 为 `SchemaDescriptor`（`s.object({...}).describe()` 的产物），
面板据此渲染"添加账号"表单 —— 编写适配器无须编写任何前端。

## AdapterHost

```
host.logger      已附带 adapter / account 字段的日志器
host.kv          该账号专属的 KV 命名空间
host.account     账号记录（含内核生成的 uuid 与用户填写的 config）
host.policy      主人判定
host.server      内置 HTTP 服务器信息，用于拼接反向连接与回调地址
host.signal      账号被停用或插件卸载时 abort
host.submit(e)   将已翻译为通用模型的事件投递进管线
host.route()     挂载 HTTP 端点，位于 /adapter/<id> 之下
host.websocket() 挂载 WebSocket 路径，位于 /adapter/<id> 之下
host.createCache({ max, ttl })  具备 LRU、TTL 与 single-flight 的联系人缓存
host.onDispose(fn)              断开时逆序执行
host.setStatus(status, detail?) 上报 connecting / online / error，面板实时反映
```

四条硬约束：

1. **`submit()` 同步返回，不应等待其结果。** 内核内部异步派发，适配器不应关心处理结果。
2. **联系人缓存必须使用 `host.createCache`，不得使用裸 `Map`。** 旧适配器将整个群的成员表
   常驻于 `Bot[id].gml` 且从不淘汰，千人群占用数百 MB 即由此产生。
3. **`disconnect()` 之后不得再有事件投递。** socket、定时器与缓存均须释放；
   内核将在卸载时调用该方法并据此断言。
4. **被动模式须先检查 `host.server.enabled`。** 用户可关闭内置服务器；反向 WebSocket 与
   HTTP 回调应在创建账号时即提示该模式需先启用内置服务器，而非等待对端连接失败后再行推断。

## 事件：仅填写平台确实提供的字段

适配器产出 `IncomingEvent`，`id`、`time`、`platform`、`selfId`、`bot`、`reply`、`isMaster`、
`text`、`images` 等派生项由内核补齐。因此编写一个新适配器的核心工作仅有一项：
**将平台报文翻译为 `IncomingEvent`**。

```ts
host.submit({
  kind: "message",
  scene: "group",
  messageId: String(raw.message_id),
  message: decodeSegments(raw.message),
  sender: { uid: String(raw.user_id), name: raw.sender.nickname, role: "member" },
  group: { gid: String(raw.group_id) },
  raw                                  // 务必带上：排障主要依赖该字段
})
```

四类事件：`message`；`notice`（`group.increase` / `decrease` / `admin` / `mute`、
`message.recall`、`poke`，未覆盖者归入 `GenericNotice`）；`request`
（`friend` / `group.add` / `group.invite`）；`meta`（`connect`、`heartbeat` 等）。

群消息的 `sender` 应提供 `MemberInfo`（含 `role`），否则内核无法判定 `isGroupAdmin`。

## 能力声明

`BotApi` 中仅有一部分为必须实现：`sendMessage`、`recallMessage`、`getSelfInfo`、
`getFriend`、`getFriendList`、`getGroup`、`getGroupList`、`getGroupMember`、
`getGroupMemberList`、`callApi`。其余方法（`sendForward`、`muteGroupMember`、
`setReaction` 等）为可选，实现后应在 `caps` 中声明对应的能力标记。

插件在运行时应查询 `bot.caps.has("recall")`，而非如旧框架那样以
`typeof Bot[id].xxx === "function"` 试探 —— 试探失败即构成一次线上异常。

`getGroupMemberList` 标记为**昂贵操作**：内核绝不会在启动时调用该方法，插件亦应仅在用户
显式请求（如群签到排行）时使用，且须支持 `limit`。

`callApi` 为逃生通道：通用接口未覆盖的平台特有能力经此调用；使用即意味着代码绑定具体平台，
插件应先判定 `bot.platform`。

## 交互式登录

扫码、验证码、填写 token 三种流程以同一套原语表达，因此新增登录方式**无须修改前端**：

```ts
loginModes: [{ id: "qrcode", name: "扫码登录" }],
async login(session, mode) {
  session.push({ type: "qrcode", image: qr, text: "用手机 QQ 扫码" })
  const code = await session.ask<string>({ type: "code", label: "短信验证码" })
  return { token }        // 返回值直接存入 AccountRecord.config
}
```

`session.signal` 在用户取消或超时时 abort。适配器仅负责推进一步并等待一次输入，
面板负责将其渲染为页面。

## 媒体

`MediaRef` 允许 URL、本地绝对路径、Buffer、base64 四种来源，**并按该顺序优先**：
同机部署时应以 `file://` 路径将图片交给协议端，从而省去 base64 编解码与一次完整传输。
旧框架采用全链路 base64 往返，一张 2 MB 的图片在内存中需经多次复制。

协议端不在同一主机上时必须回落至直传 —— NapCat 适配器将该开关实现为账号配置项
`localFileAccess`。

## 参照实现

[`adapter-napcat`](https://github.com/Yunzai-NG/adapter-napcat) 仓库的 `src/`
是 OneBot v11 的完整实现，其文件划分可直接沿用：

| 文件 | 内容 |
|---|---|
| `index.ts` | `definePlugin` 与 `registerAdapter` |
| `config.ts` | 账号 schema（四种网络模式的字段与互斥关系） |
| `protocol.ts` `fields.ts` | 平台报文的类型定义 |
| `codec.ts` | 消息段编解码（两个方向） |
| `events.ts` | 报文转换为 `IncomingEvent` |
| `bot.ts` | `BotDriver` 实现与 `caps` |
| `media.ts` | `MediaRef` 转换为平台的 file 字段 |
| `pending.ts` | `echo` 与 pending promise 的关联表 |
| `transport.ts` `transport-ws.ts` `transport-ws-reverse.ts` `transport-http.ts` | 四种网络模式 |
| `ws-session.ts` | 心跳、空闲超时、退避重连 |
| `sign.ts` | HTTP 上报的签名校验 |

其中 `pending.ts` 值得单独阅读：请求与响应经 `echo` 关联，一条请求对应
`Map<string, {resolve, reject, timer}>` 中的一个 promise。其他参考实现中常见的
"1200 次 × 50ms 忙等轮询"在此处并无必要，亦不应出现在任何新适配器中。

## 测试

无须连接真实平台。`@yunzai-ng/core/testing` 的 `createMockAdapter()` 本身即是一份
**在编译期必须满足 `AdapterProvider` 与 `BotDriver`** 的真实实现，既作测试替身，
亦是"至少需实现哪些方法"的可执行文档：

```ts
const mock = createMockAdapter({ platform: "mock", caps: ["recall"] })
app.runtime.adapters.register(mock.provider, "test-plugin")
await app.runtime.accounts.create("mock", { selfId: "10000" })
mock.driver.receiveGroup("#ping", { gid: "1", uid: "2" })
await mock.waitForSend()
expect(mock.texts).toEqual(["pong"])
```

`waitForSend()` 超时时会将已发出的内容写入错误信息 —— 否则 vitest 仅报告一句
"test timed out"，而"命令未匹配 / 插件抛错 / 回复内容不符"这三种情况的排查方向
完全不同。
