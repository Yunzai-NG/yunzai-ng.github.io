/**
 * 模块职责：文档站主题 —— 沿用 VitePress 默认主题，仅注册全局组件
 * 依赖方向：构建期依赖 vitepress 默认主题与本目录组件
 * 生命周期：构建期与浏览器运行期
 * 注意事项：只扩展、不替换默认主题（`extends: DefaultTheme`），故默认的导航、侧栏、
 *          搜索一律照旧；这里只把 `<PluginStore>` 注册为全局组件，供 store.md 直接使用。
 */
import DefaultTheme from "vitepress/theme"
import type { Theme } from "vitepress"
import PluginStore from "./PluginStore.vue"

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PluginStore", PluginStore)
  }
} satisfies Theme
