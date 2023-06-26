<template>
  <div class="column fit fixed">
    <div class="col-auto">
      <q-btn label="calculate" color="accent" flat icon="play_circle" @click="calculate"/>
    </div>
    <div class="col bg-yellow fit" style="min-width: 100px; min-height:100px;" >
      <baklava-editor :view-model="baklava" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import { usePeer } from 'stores/peer'
import { useIcons } from 'stores/material_icons'
import { useTwitch } from 'stores/twitch'
// import { displayNode, myNode } from 'stores/nodes'
import _ from 'lodash'
import { useActions } from 'stores/actions'
import { useNodesBaklava } from 'stores/nodes_baklava'
// Baklava
import { useBaklava } from "@baklavajs/renderer-vue"
import "@baklavajs/themes/dist/syrup-dark.css"
import { DependencyEngine, applyResult } from "@baklavajs/engine";
import { useSystemNodes } from 'stores/system_nodes'
import { useSettings } from 'stores/settings'

const $q = useQuasar()
const A = useActions()
const N = useNodesBaklava()
const S = useSettings()
useSystemNodes()

const baklava = useBaklava()
N.nodes.forEach(c => c.nodes.forEach(n => {
  baklava.editor.registerNodeType(n, { category: c.source })
}))

baklava.settings.enableMinimap = true

// const engine = new DependencyEngine(baklava.editor);
// const token = Symbol();
// engine.events.afterRun.subscribe(token, (result) => {
//     engine.pause();
//     applyResult(result, baklava.editor);
//     engine.resume();
// });
// engine.start()
N.engine.setEditor(baklava.editor)

const calculate = async () => {
  console.log("CALCULATING")
  // const result = await engine.runOnce({ foo: "bar" });
  var result = N.engine.run()
  console.log("RESULTS", result)
}

// Loading previous saved state
var saved = S.get("baklava.state")
console.log("SAVED STATE:", saved)
if(saved)
  baklava.editor.load(saved)

console.log(baklava)

// Saving
const state = ref()
onMounted(() => setInterval(() => {
  console.log("SAVING")
  state.value = baklava.editor.save()
  S.set("baklava.state", state.value)
}, 5000))

</script>

<style lang="scss">

.baklava-editor {
  font-size: 12px;
}

.baklava-toolbar {
  margin: 0;
  height: unset;
  padding: 0.5rem;
  height: 42px;
}

.baklava-node-palette {
  top: 42px;
  padding: 0.5rem;
  h1 {
    font-size: 1rem;
    line-height: unset;
    margin-top: 0;
  }
}

</style>
