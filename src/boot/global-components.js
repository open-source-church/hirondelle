import {defineAsyncComponent, defineComponent} from "vue"


export default async ({ app }) => {
  app.component('home-view', defineAsyncComponent(() => import('../components/HomeView.vue')))
  app.component('obs-view', defineAsyncComponent(() => import('../components/OBSView.vue')))
  app.component('twitch-view', defineAsyncComponent(() => import('../components/TwitchView.vue')))
  app.component('settings-view', defineAsyncComponent(() => import('../components/SettingsView.vue')))
  // Utils
  app.component('h-tooltip', defineAsyncComponent(() => import('../components/utils/ToolTip.vue')))
  app.component('h-help-dialog', defineAsyncComponent(() => import('../components/utils/HelpDialog.vue')))
  // Twitch
  app.component('reward-item', defineAsyncComponent(() => import('../components/twitch/RewardItem.vue')))
  // Hirondelle
  app.component('graph-view', defineAsyncComponent(() => import('../components/GraphView.vue')))

}
