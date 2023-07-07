<template>
  <div class="column fit fixed">
    <div class="col-auto row bg-dark" style="z-index:0;">
      <q-btn flat icon="help" color="info">
        <q-popup-proxy breakpoint="99999">
          <h-help-dialog />
        </q-popup-proxy>
      </q-btn>
      <q-space />
      <q-separator vertical />
      <!-- New node -->
      <q-btn flat color="primary" icon="add_circle" @click="$refs.editor.newNodeDialog()">
        <q-icon name="arrow_drop_down" class="q-pl-sm"/>
        <h-tooltip>New Node</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <!-- Copy / Paste -->
      <q-btn :disable="!selected.length" flat icon="content_copy" color="primary" label="" @click="CB.copy(selected)">
        <h-tooltip>Copy</h-tooltip>
      </q-btn>
      <q-btn :disable="CB.empty" flat icon="content_paste" color="primary" label="" @click="CB.paste()">
        <h-tooltip>Paste</h-tooltip>
      </q-btn>
      <q-btn :disable="!selected.length > 0" flat icon="group_work" color="primary"
        @click="graph.newGroup(selected)">
        <h-tooltip>Create group with selected nodes</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <q-btn flat icon="unfold_less" :color="graph.settings.autoCloseNodes ? 'primary' : ''"
        @click="graph.settings.autoCloseNodes = !graph.settings.autoCloseNodes">
        <h-tooltip>Fold and unfold nodes when mouse is over.
          <q-chip v-if="graph.settings.autoCloseNodes" class="q-py-xs text-caption bg-accent">Active</q-chip>
          <q-chip v-else class="q-py-xs text-caption bg-grey text-black">Inactive</q-chip>
        </h-tooltip>
      </q-btn>
      <q-separator vertical />
      <!-- Save and autosave -->
      <q-btn-group >
        <q-btn flat icon="save" color="primary" :disable="!graphChanged" @click="_save"/>
        <q-btn flat icon="autorenew" :color="autoSave ? 'primary' : ''" @click="autoSave = !autoSave">
          <h-tooltip>Auto save graph on change.
            <q-chip v-if="autoSave" class="q-py-xs text-caption bg-accent">Active</q-chip>
            <q-chip v-else class="q-py-xs text-caption bg-grey text-black">Inactive</q-chip>
          </h-tooltip>
        </q-btn>
      </q-btn-group>
      <q-space />
    </div>
    <div class="col fit" style="min-width: 100px; min-height:100px;" >
      <HEditor ref="editor" :graph="graph" @selected="selected=$event" @parentChanged="parent=$event" />
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
  graphChanged.value = false
}
const save = _.throttle(_save, 2000, { leading: true })

const graphState = computed(() => ({
  nodeState: graph.flatNodes().map(n => [_.map(n.values.input, v => v.val), n.state.x, n.state.y])
}))
const graphChanged = ref(false)

watch(graphState, () => {
  graphChanged.value = true
  if (autoSave.value) save()
}, { immediate: true })

</script>

<style lang="scss">

</style>
