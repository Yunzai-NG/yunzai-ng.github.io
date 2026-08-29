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
import { defineConfig } from "vitepress"

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
    ["link", { rel: "icon", type: "image/svg+xml", href: "/brand/icon-square.svg" }]
  ],

  themeConfig: {
    // 站点标题旁的标记用 mark：它不画背景，`currentColor` 随深浅主题走，
    // 带底色的方形版压在浅色页头上会是一个突兀的深色块
    logo: "/brand/icon-mark.svg",

    nav: [
      { text: "快速开始", link: "/getting-started" },
      { text: "插件开发", link: "/plugin-api" },
      { text: "框架说明", link: "/architecture" },
      { text: "从 Miao-Yunzai 迁移", link: "/migration" }
    ],

    sidebar: [
      {
        text: "入门",
        items: [
          { text: "快速开始", link: "/getting-started" },
          { text: "配置与面板", link: "/config" }
        ]
      },
      {
        /*
         * 官方插件收成一个可展开的分组，每个插件一页
         *
         * `collapsed: true` 使它默认折起：六个插件平铺会让侧栏比其余三组加起来还长，
         * 而多数人只需要读其中一两个。落地页（`/official-plugins`）留着 —— 它回答
         * 「有哪些、装在哪个市场」，那是读任何单页之前要先知道的事。
         */
        text: "官方插件",
        collapsed: true,
        items: [
          { text: "一览与两个市场", link: "/official-plugins" },
          { text: "webui（面板）", link: "/plugins/webui" },
          { text: "adapter-napcat（QQ）", link: "/plugins/adapter-napcat" },
          { text: "renderer-puppeteer（出图）", link: "/plugins/renderer-puppeteer" },
          { text: "hardware（硬件监控）", link: "/plugins/hardware" },
          { text: "webui-example（示例）", link: "/plugins/webui-example" },
          { text: "mhy-game（米游社）", link: "/plugins/mhy-game" }
        ]
      },
      {
        text: "开发",
        items: [
          { text: "插件开发", link: "/plugin-api" },
          { text: "面板插件", link: "/panel-plugin" },
          { text: "适配器开发", link: "/adapter" },
          { text: "渲染与模板", link: "/renderer" },
          { text: "插件市场", link: "/market" }
        ]
      },
      {
        text: "参考",
        items: [
          { text: "框架说明", link: "/architecture" },
          { text: "从 Miao-Yunzai 迁移", link: "/migration" },
          { text: "性能基线", link: "/perf" }
        ]
      }
    ],

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
  }
})
