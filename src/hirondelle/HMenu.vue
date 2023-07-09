<template>
  <q-list dense style="min-width: 100px">
    <q-item clickable v-for="item in items" :key="item.title"
      @click="menuAction(item)" v-close-popup="!item.items">
      <q-item-section>{{ item.title }}</q-item-section>
      <q-item-section side v-if="item.type">
        <q-badge v-if="item.type.isTrigger" square class="bg-accent text-white">trigger</q-badge>
        <q-badge v-if="item.type.isAction" square class="bg-primary text-dark">action</q-badge>
        <q-badge v-if="item.type.isParam" square class="bg-grey-8 text-white">param</q-badge>
      </q-item-section>
      <q-item-section side v-if="item.items">
        <q-icon name="keyboard_arrow_right" />
      </q-item-section>
      <q-menu anchor="top end" self="top start" v-if="item.items">
        <HMenu :items="item.items" />
      </q-menu>
    </q-item>
  </q-list>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import HMenu from "src/hirondelle/HMenu.vue"
import { useHirondelle } from './hirondelle'
import { useQuasar } from 'quasar'

const H = useHirondelle()
const $q = useQuasar()

const props = defineProps({
  items : { Object, required: true }
})

defineEmits(["selected"])

const menuAction = (item) => {

  // Add node
  if (item.action == "addNode") {
    var mouse = H.view.mouse
    var state = H.view.to({
      x: mouse.x,
      y: mouse.y - H.view.dimensions.top
    })
    state.open = true
    H.graph.addNode({ type: item.type.id, state })
  }

  // Edit node title
  else if (item.action == "editNodeTitle") {
    $q.dialog({
        title: 'Edit node name',
        prompt: {
          model: item.node.title,
          type: 'text' // optional
        },
      }).onOk(data => {
        item.node.title = data
      })
  }

  // Edit node title
  else if (item.action == "clearNodeTitle") {
    item.node.title = null
  }
}

</script>

<style lang="scss">


</style>
