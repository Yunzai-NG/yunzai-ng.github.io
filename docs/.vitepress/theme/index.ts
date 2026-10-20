/**
 * 模块职责：文档站主题 —— 沿用 VitePress 默认主题，换一套配色并注册全局组件
 * 依赖方向：构建期依赖 vitepress 默认主题与本目录组件
 * 生命周期：构建期与浏览器运行期
 * 注意事项：只扩展、不替换默认主题（`extends: DefaultTheme`），故默认的导航、侧栏、
 *          搜索一律照旧。全局组件供 markdown 直接使用：首页、按系统分页、终端示意、
 *          面板截图、流程图、卡片链接与插件商店。
 */
import DefaultTheme from "vitepress/theme"
import type { Theme } from "vitepress"
import Flow from "./components/Flow.vue"
import HomePage from "./components/HomePage.vue"
import LinkCards from "./components/LinkCards.vue"
import OsTabs from "./components/OsTabs.vue"
import Shot from "./components/Shot.vue"
import Terminal from "./components/Terminal.vue"
import PluginStore from "./PluginStore.vue"
import "./style.css"

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Flow", Flow)
    app.component("HomePage", HomePage)
    app.component("LinkCards", LinkCards)
    app.component("OsTabs", OsTabs)
    app.component("PluginStore", PluginStore)
    app.component("Shot", Shot)
    app.component("Terminal", Terminal)
  }
} satisfies Theme
