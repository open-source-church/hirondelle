import {defineAsyncComponent, defineComponent} from "vue"


export default async ({ app }) => {
  app.component('obs-view', defineAsyncComponent(() => import('../components/OBSView.vue')))
  app.component('twitch-view', defineAsyncComponent(() => import('../components/TwitchView.vue')))
  app.component('actions-view', defineAsyncComponent(() => import('../components/ActionsView.vue')))
  // Twitch
  app.component('reward-item', defineAsyncComponent(() => import('../components/twitch/RewardItem.vue')))
  // Hirondelle
  app.component('graph-view', defineAsyncComponent(() => import('../components/GraphView.vue')))

}
