<template>
  <div class="column fit fixed">
    <div class="col-auto row">
      <!-- Node types -->
      <q-btn-dropdown flat color="primary" label="Node Types">
        <q-list>
          <q-item v-for="t in graph.nodeTypes" :key="t.type" clickable
            @click="graph.addNode(t)">
            <q-item-section><q-item-label>
              <q-badge color="accent">{{t.category}}</q-badge>
              {{ t.title }}
            </q-item-label></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
    <div class="col fit" style="min-width: 100px; min-height:100px;" >
      <HEditor :graph="graph"/>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import _ from 'lodash'
import { useActions } from 'stores/actions'
import { useSettings } from 'stores/settings'
// Node
import HEditor from "src/hirondelle/HEditor.vue"
import { useHirondelle } from "src/hirondelle/hirondelle.js"
import { useBaseActions } from "src/hirondelle/base-actions.js"

const $q = useQuasar()
const A = useActions()
const S = useSettings()

const H = useHirondelle()
useBaseActions()

const graph = H.graph

// Loading and saving
var state = S.get("graph.state")
if (state) {
  graph.load(state)
}

const save = _.debounce(() => {
  console.log("GRAPH CHANGED", graph)
  S.set("graph.state", graph.save())
}, 1000)
watch(graph, () => {
  save()
}, { deep: true })

</script>

<style lang="scss">

</style>
