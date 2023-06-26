import {defineAsyncComponent, defineComponent} from "vue"
import { EditorComponent } from "@baklavajs/renderer-vue"

export default async ({ app }) => {
  app.component('obs-view', defineAsyncComponent(() => import('../components/OBSView.vue')))
  app.component('twitch-view', defineAsyncComponent(() => import('../components/TwitchView.vue')))
  app.component('actions-view', defineAsyncComponent(() => import('../components/ActionsView.vue')))
  // Baklava
  app.component('graph-view', defineAsyncComponent(() => import('../components/GraphView.vue')))
  app.component('baklava-editor', defineComponent(EditorComponent))
  // Test
  app.component('my-graph-view', defineAsyncComponent(() => import('../components/MyGraphView.vue')))

}
