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
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type DefaultTheme } from "vitepress"

/**
 * 正文字数：汉字逐个计，英文与数字按词计
 *
 * 先去掉 frontmatter、页内的 <script> / <style>、HTML 标签与 markdown 记号，
 * 否则组件的示例数据与链接地址会被算进去。代码块保留 —— 那也是要读的。
 */
function countWords(source: string): number {
  const text = source
    .replace(/^---[\s\S]*?\n---/, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#>*_`|~[\]-]/g, " ")
  const han = text.match(/[㐀-鿿豈-﫿]/g)?.length ?? 0
  const latin = text.replace(/[㐀-鿿豈-﫿]/g, " ").match(/[A-Za-z0-9]+(?:[.'][A-Za-z0-9]+)*/g)?.length ?? 0
  return han + latin
}

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

  // 字数在构建期算好，交给 DocMeta 显示；首页等无正文的页不算
  transformPageData(pageData, { siteConfig }) {
    if ((pageData.frontmatter.layout ?? "doc") !== "doc") return
    const source = readFileSync(join(siteConfig.srcDir, pageData.relativePath), "utf8")
    pageData.frontmatter.wordCount = countWords(source)
  },

  markdown: {
    // 每页第一个 h1 之后插一行「更新日期 · 字数 · 阅读时间」
    config(md) {
      md.core.ruler.push("yz-doc-meta", state => {
        const i = state.tokens.findIndex(t => t.type === "heading_close" && t.tag === "h1")
        if (i < 0) return
        const token = new state.Token("html_block", "", 0)
        token.content = "<DocMeta />\n"
        state.tokens.splice(i + 1, 0, token)
      })
    }
  },

  // 图标与字标见 public/brand/README.md
  head: [
    ["link", { rel: "icon", type: "image/png", sizes: "64x64", href: "/brand/favicon-64.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "256x256", href: "/brand/logo-mark-256.png" }],
    ["link", { rel: "apple-touch-icon", href: "/brand/logo-square.png" }],
    ["meta", { name: "theme-color", content: "#0b0e16" }]
  ],

  themeConfig: {
    // 页头直接放「图标 + YUNZAI NG」整张字标，故关掉文字标题；深浅两版只差字色
    logo: { light: "/brand/logo-lockup.svg", dark: "/brand/logo-lockup-ondark.svg", alt: "Yunzai NG" },
    siteTitle: false,

    nav: [
      { text: "快速上手", link: "/getting-started", activeMatch: "^/(intro|getting-started|first-bot|deploy|faq)" },
      { text: "插件商店", link: "/store", activeMatch: "^/(store|install-plugins|themes)" },
      { text: "开发者指南", link: "/plugin-api", activeMatch: "^/(plugin-api|plugin/|adapter|renderer|panel-plugin|custom-page|theme-dev|design-tokens|market|from-source)" },
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
          { text: "安装与管理插件", link: "/install-plugins" },
          { text: "外观与主题", link: "/themes" }
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
              { text: "扩展页面", link: "/custom-page" },
              { text: "主题开发", link: "/theme-dev" },
              { text: "设计令牌", link: "/design-tokens" }
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

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
          modal: {
            displayDetails: "显示详细列表",
            resetButtonTitle: "清空查询",
            backButtonTitle: "关闭搜索",
            noResultsText: "没有找到相关结果",
            footer: {
              selectText: "选择",
              selectKeyAriaLabel: "回车",
              navigateText: "切换",
              navigateUpKeyAriaLabel: "上方向键",
              navigateDownKeyAriaLabel: "下方向键",
              closeText: "关闭",
              closeKeyAriaLabel: "Esc"
            }
          }
        }
      }
    },

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
        },
        // 替换版侧栏要引用默认主题的内部组件，见 Sidebar.vue 与 env.d.ts
        { find: /^@vp-theme\//, replacement: "vitepress/dist/client/theme-default/components/" }
      ]
    }
  }
})
