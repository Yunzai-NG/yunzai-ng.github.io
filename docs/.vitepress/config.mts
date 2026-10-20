/**
 * 模块职责：文档站构建与主题配置
 * 依赖方向：构建期依赖 vitepress
 * 生命周期：构建期
 * 注意事项：**`base` 必须为 `/`。** 面板帮助页中的 `DOCS_SITE` 常量取值为
 *          `https://yunzai-ng.github.io`，链接按 `<站点>/<文档名>` 拼接。
 *          若以项目页形式部署（`<组织>.github.io/<仓库名>/`），`base` 须改为
 *          `/<仓库名>/`，此时帮助页中的全部文档链接均失效。因此本仓库须部署为
 *          组织主站点仓库（`Yunzai-NG/yunzai-ng.github.io`）。
 *
 *          `cleanUrls` 启用后产出 `/getting-started` 而非 `/getting-started.html`，
 *          与帮助页的链接形式一致。GitHub Pages 支持无扩展名寻址。
 *
 *          搜索采用 `local`：本站文档数量有限，接入 Algolia 需申请配额、配置爬虫并
 *          维护一份索引凭据，而本地搜索在构建期即将索引写入产物。
 *
 *          侧边栏与导航**逐项声明而非扫描目录**：文档的阅读顺序由内容决定，
 *          按文件名排序只能得到字母序。
 */
import { fileURLToPath } from "node:url"
import { defineConfig, type DefaultTheme } from "vitepress"

/**
 * 侧栏的每个分组（含子组）都标成可折叠、默认折起
 *
 * 配合 theme/components/Sidebar.vue 换页时重建分组：只有含当前页的那一串展开，
 * 其余一律收回。逐项手写 `collapsed: true` 容易漏，新加的组也就一直开着。
 */
function foldAll(items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] {
  return items.map(item =>
    item.items === undefined ? item : { ...item, collapsed: true, items: foldAll(item.items) }
  )
}

export default defineConfig({
  lang: "zh-CN",
  title: "Yunzai NG",
  description: "面向 QQ 机器人的可插拔运行时内核",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  srcDir: ".",
  // 死链即构建失败：文档间互相引用，改名后留下的断链在站点上是一个 404 页面，
  // 而在这里是一条构建错误
  ignoreDeadLinks: false,

  // 图标由 tools/brand.ps1 生成，几何全部由参数算出，不要手改这些 SVG
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/brand/icon-square.svg" }],
    ["meta", { name: "theme-color", content: "#0b0e16" }]
  ],

  themeConfig: {
    // 站点标题旁的标记用 mark：它不画背景，`currentColor` 随深浅主题走，
    // 带底色的方形版压在浅色页头上会是一个突兀的深色块
    logo: "/brand/icon-mark.svg",

    nav: [
      { text: "快速上手", link: "/getting-started", activeMatch: "^/(intro|getting-started|first-bot|deploy|faq)" },
      { text: "插件商店", link: "/store", activeMatch: "^/(store|install-plugins)" },
      { text: "开发者指南", link: "/plugin-api", activeMatch: "^/(plugin-api|plugin/|adapter|renderer|panel-plugin|custom-page|market|from-source)" },
      { text: "官方插件", link: "/official-plugins", activeMatch: "^/(official-plugins|plugins/)" },
      {
        text: "参考",
        items: [
          { text: "CLI 命令", link: "/cli" },
          { text: "配置项", link: "/config" },
          { text: "框架说明", link: "/architecture" },
          { text: "从 Miao-Yunzai 迁移", link: "/migration" },
          { text: "性能基线", link: "/perf" }
        ]
      }
    ],

    /*
     * 侧栏按读者的路径排：先用起来（上手 → 装插件），再写插件，最后是查阅用的
     *
     * 官方插件与参考放在最后：前者是逐个插件的说明，后者是逐项的命令与配置，
     * 都是「用到时来查」，不该挡在新手的阅读路线中间。
     */
    sidebar: foldAll([
      {
        text: "快速上手",
        items: [
          { text: "这是什么", link: "/intro" },
          { text: "安装与启动", link: "/getting-started" },
          { text: "接入 QQ", link: "/first-bot" },
          { text: "让它一直跑着", link: "/deploy" },
          { text: "常见问题", link: "/faq" }
        ]
      },
      {
        text: "插件商店",
        items: [
          { text: "浏览插件", link: "/store" },
          { text: "安装与管理插件", link: "/install-plugins" }
        ]
      },
      {
        /*
         * 开发者指南按学习顺序排：上手 → 发消息 → 命令 → 存储 → 协作，
         * 再到接平台 / 出图、扩展面板、发布。`/plugin-api` 留在首位作为入口页（面板帮助页链的就是它）。
         */
        text: "开发者指南",
        items: [
          {
            text: "插件基础",
            items: [
              { text: "上手", link: "/plugin-api" },
              { text: "发消息", link: "/plugin/message" },
              { text: "命令与事件", link: "/plugin/command" },
              { text: "配置与存储", link: "/plugin/storage" },
              { text: "定时任务与协作", link: "/plugin/service" }
            ]
          },
          {
            text: "接平台与出图",
            items: [
              { text: "适配器开发", link: "/adapter" },
              { text: "渲染与模板", link: "/renderer" }
            ]
          },
          {
            text: "扩展面板",
            items: [
              { text: "面板插件", link: "/panel-plugin" },
              { text: "扩展页面", link: "/custom-page" }
            ]
          },
          {
            text: "发布",
            items: [
              { text: "测试与发布", link: "/plugin/publish" },
              { text: "上架插件市场", link: "/market" },
              { text: "从源码构建框架", link: "/from-source" }
            ]
          }
        ]
      },
      {
        // 落地页回答「有哪些、装在哪个市场」，那是读任何单页之前要先知道的事
        text: "官方插件",
        items: [
          { text: "一览与两个市场", link: "/official-plugins" },
          { text: "webui（面板）", link: "/plugins/webui" },
          { text: "adapter-napcat（QQ）", link: "/plugins/adapter-napcat" },
          { text: "adapter-qqbot（QQ 官方）", link: "/plugins/adapter-qqbot" },
          { text: "adapter-stdin（终端调试）", link: "/plugins/adapter-stdin" },
          { text: "renderer-puppeteer（出图）", link: "/plugins/renderer-puppeteer" },
          { text: "hardware（硬件监控）", link: "/plugins/hardware" },
          { text: "webui-example（示例）", link: "/plugins/webui-example" },
          { text: "mhy-game（米游社）", link: "/plugins/mhy-game" },
          { text: "yenai-state（状态图）", link: "/plugins/yenai-state" },
          { text: "steward（运维）", link: "/plugins/steward" },
          { text: "TermZero（远程执行）", link: "/plugins/termzero" }
        ]
      },
      {
        text: "参考",
        items: [
          { text: "CLI 命令", link: "/cli" },
          { text: "配置项", link: "/config" },
          { text: "框架说明", link: "/architecture" },
          { text: "从 Miao-Yunzai 迁移", link: "/migration" },
          { text: "性能基线", link: "/perf" }
        ]
      }
    ]),

    socialLinks: [{ icon: "github", link: "https://github.com/Yunzai-NG" }],

    search: { provider: "local" },

    outline: { level: [2, 3], label: "本页目录" },

    docFooter: { prev: "上一页", next: "下一页" },

    lastUpdatedText: "最后更新",
    darkModeSwitchLabel: "外观",
    sidebarMenuLabel: "目录",
    returnToTopLabel: "回到顶部",

    editLink: {
      pattern: "https://github.com/Yunzai-NG/yunzai-ng.github.io/edit/main/docs/:path",
      text: "在 GitHub 上编辑本页"
    },

    footer: {
      message: "以 AGPL-3.0-or-later 许可发布",
      copyright: "Yunzai NG"
    }
  },

  vite: {
    resolve: {
      // 默认主题的 Layout 以相对路径引入侧栏；只换掉这一处引用，见 theme/components/Sidebar.vue
      alias: [
        {
          find: /^\.\/components\/VPSidebar\.vue$/,
          replacement: fileURLToPath(new URL("./theme/components/Sidebar.vue", import.meta.url))
        }
      ]
    }
  }
})
