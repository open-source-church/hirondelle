<template>
  <q-card style="min-width: 60vw">
    <q-card-section class="bg-secondary text-dark">
      Help
    </q-card-section>
    <q-card-section>
      <p class="text-subtitle1 q-mb-md">Keyboards shortcuts:</p>
      <div class="column justify-between">
        <p><kbd>CTRL</kbd>+<kbd>C</kbd> : Copy</p>
        <p><kbd>CTRL</kbd>+<kbd>V</kbd> : Paste</p>
        <p><kbd>CTRL</kbd>+<kbd>G</kbd> : Group</p>
        <p><kbd>Shift</kbd>+<kbd>A</kbd> / <kbd>dblClick</kbd> : Add node</p>
        <p><kbd>CTRL</kbd>+<kbd>A</kbd> : Select all node</p>
        <p><kbd>Del</kbd>/<kbd>backspace</kbd> : Delete selected nodes</p>
      </div>
    </q-card-section>
    <q-card-section>
      <p class="text-subtitle1 q-mb-md">Connections</p>
      <p>Drag from connectors to create connections.</p>
      <div class="row items-start">
        <q-icon class="col-1" name="circle" color="green" size="sm"/>
        <span class="col-11"><b>Main connectors:</b> node will call other nodes following those connections.</span>
        <span class="col-11 offset-1 q-mb-sm">Click on an <i>incoming</i> connector (on the left) to start node.
        Click on an <i>outgoing</i> connector (on the right) to trigger connected nodes.</span>
        <q-icon class="col-1" name="circle" color="grey" size="xs"/>
        <span class="col-11 q-mb-sm"><b>Variables:</b> nodes will pass variables values following those connections.
        It is done automatically as soon as any value changes.</span>
        <q-icon class="col-1 offset-1" name="circle" color="grey" size="xs"/>
        <span class="col-4">Accepts <b>multiple</b> connections.</span>
        <q-icon class="col-1" name="square" color="grey" size="xs"/>
        <span class="col-4">Accepts <b>one</b> connection.</span>
        <span class="col-11 offset-1 q-my-sm">Variable types:</span>
        <!-- Types -->
        <q-icon class="col-1 offset-1" name="circle" color="yellow" size="xs"/>
        <span class="col-2"><b>String:</b> texts.</span>
        <q-icon class="col-1" name="circle" color="blue" size="xs"/>
        <span class="col-2"><b>Number</b></span>
        <q-icon class="col-1" name="circle" color="purple" size="xs"/>
        <span class="col-4"><b>Boolean:</b> true/false</span>
        <q-icon class="col-1 offset-1" name="circle" color="deep-orange" size="xs"/>
        <span class="col-2"><b>Color</b></span>
        <q-icon class="col-1" name="circle" color="brown" size="xs"/>
        <span class="col-2"><b>Rect</b></span>
        <q-icon class="col-1" name="circle" color="white" size="xs"/>
        <span class="col-4"><b>Any</b></span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>

import { computed } from 'vue'

const props = defineProps({
  top: { type: Boolean, default: false},
  class: { type: String, default: "bg-secondary text-dark text-body2" }
})

const anchor = computed(() => props.top ? "top middle" : "bottom middle")
const self = computed(() => props.top ? "bottom middle" : "top middle")

</script>

<style lang="scss">

kbd {
  white-space: nowrap;
  background: #d700d7;
  box-shadow: inset 0 -4px #370037, inset 0 0 1px 1px #da34da, -1px 0 #630063, 1px 0 #630063, 0 1px #630063;
  padding: 3px 6px 7px;
  font-size: .8rem;
  line-height: .8rem;;
  border-radius: 4px;
  margin: 0 0.2rem;
}

</style>
