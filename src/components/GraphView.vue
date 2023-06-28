<template>
  <div class="column fit fixed">
    <div class="col-auto row">
      <!-- Triggers -->
      <q-btn-dropdown flat color="primary" label="Triggers">
        <q-list>
          <q-item v-for="t in H.nodeTypes.filter(t => t.trigger)" :key="t.type" clickable
            @click="graph.addNode({type: t}, parent)">
            <q-item-section><q-item-label>
              <q-badge color="accent">{{t.category}}</q-badge>
              {{ t.title }}
            </q-item-label></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <!-- Actions -->
      <q-btn-dropdown flat color="primary" label="Actions">
        <q-list>
          <q-item v-for="t in H.nodeTypes.filter(t => !t.trigger)" :key="t.type" clickable
            @click="graph.addNode({type: t}, parent)">
            <q-item-section><q-item-label>
              <q-badge color="accent">{{t.category}}</q-badge>
              {{ t.title }}
            </q-item-label></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-toggle v-model="graph.settings.autoCloseNodes" label="Auto-Close Nodes" />
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
import { useBaseActions } from "src/hirondelle/base-actions.js"

const $q = useQuasar()
const S = useSettings()

const H = useHirondelle()
useBaseActions()

const graph = H.graph
const selected = ref([])
const parent = ref()

// Loading and saving
var state = S.get("graph.state")
if (state) {
  graph.load(state)
}

const save = _.debounce(() => {
  S.set("graph.state", graph.save())
}, 1000)
watch(graph, () => {
  save()
}, { deep: true })

</script>

<style lang="scss">

</style>
