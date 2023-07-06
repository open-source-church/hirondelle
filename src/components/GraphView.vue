<template>
  <div class="column fit fixed">
    <div class="col-auto row bg-dark" style="z-index:0;">
      <!-- Triggers -->
      <q-btn-dropdown flat color="primary" label="Add node">
        <q-list>
          <q-item v-for="(item, i) in H.nodeTypesOptions" :key="`addNode-${i}`" :disable="item.header"
            @click="graph.addNode({ type: item.type }, parent)" clickable >
            <q-item-section avatar v-if="!item.header">
              <q-badge v-if="item.type.isTrigger" square class="bg-accent text-white">trigger</q-badge>
              <q-badge v-if="item.type.isAction" square class="bg-primary text-dark">action</q-badge>
              <q-badge v-if="item.type.isParam" square class="bg-grey-8 text-white">param</q-badge>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ item.label }}</q-item-label>
              <q-item-label caption>{{ item.description }}</q-item-label>
            </q-item-section>
          </q-item>
      </q-list>
      </q-btn-dropdown>
      <q-toggle v-model="graph.settings.autoCloseNodes" label="Auto-Close Nodes" />
      <q-toggle v-model="autoSave" label="Auto-Save" />
      <q-space />
      <q-btn :disable="!selected.length" flat icon="content_copy" color="primary" label="Copy" @click="CB.copy(selected)"  />
      <q-btn :disable="CB.empty" flat icon="content_paste" color="primary" label="Paste" @click="CB.paste()" />
      <q-space />
      <q-btn v-if="selected.length > 0" flat icon="group_work" color="primary" label="Create Group" @click="graph.newGroup(selected)"/>
    </div>
    <div class="col fit" style="min-width: 100px; min-height:100px;" >
      <HEditor :graph="graph" @selected="selected=$event" @parentChanged="parent=$event" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import _ from 'lodash'
import { useSettings } from 'stores/settings'
// Node
import HEditor from "src/hirondelle/HEditor.vue"
import { useHirondelle } from "src/hirondelle/hirondelle.js"
import { useClipboard } from "src/hirondelle/utils/clipboard.js"
// Importing types
import "src/hirondelle/types/variables.js"
import "src/hirondelle/types/base-actions.js"

const $q = useQuasar()
const S = useSettings()

const H = useHirondelle()
const CB = useClipboard()

const graph = H.graph
const selected = ref([])
const parent = ref()

var autoLoad = true
var autoSave = ref(true)

// Loading and saving
if (autoLoad) {
  var state = S.get("graph.state")
  if (state) {
    graph.load(state)
  }
}


const _save = () => {
  console.log("Saving graph")
  S.set("graph.state", graph.save())
}
const save = _.throttle(_save, 2000, { leading: true })

const graph_changed = computed(() => ({
  nodeState: graph.flatNodes().map(n => [_.map(n.values.input, v => v.val), n.state.x, n.state.y])
}))

watch(graph_changed, () => {
  if (autoSave.value) save()
}, { immediate: true })

</script>

<style lang="scss">

</style>
