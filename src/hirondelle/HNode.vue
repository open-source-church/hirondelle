<template>
  <q-card  class="h-node" :style="`left:${node.state?.x}px; top: ${node.state?.y}px;`" :data-node-id="node.id">
    <q-card-section :class="`row items-center text-dark q-pa-sm ${node.type.accepts_input ? 'bg-primary' : 'bg-accent text-white'}`">
      <q-icon class="col-auto q-pr-xs" name="circle" size="xs" :color="node.type.active ? 'green' : 'red'"/>
      <div class="col">{{ node.type.title }} </div>
      <q-btn flat dense :disable="node.running || !node.type.active" icon="play_circle" class="col-auto text-positive" @click="node.start()"/>
      <q-btn flat dense icon="delete" class="col-auto text-negative" @click="node.remove"/>
    </q-card-section>
    <!-- Ports -->
    <q-btn v-if="node.type.accepts_input" flat round dense icon="circle" class="absolute-top-left" color="red" size="sm" style="left:-12px; top: 14px"
      @mousedown.stop @touchstart.stop data-port="input" />
    <q-btn v-if="node.type.accepts_output" @touchstart.stop flat round dense icon="circle" class="absolute-top-right" color="red" size="sm" style="right:-11px; top: 14px"
      @mousedown.stop="startConnection" data-port="output" />
    <!-- Values -->
    <!-- <q-card-section>
      {{ node.values }}
    </q-card-section> -->
    <!-- Outputs -->
    <q-card-section class="q-pr-none q-pl-xl q-py-xs">
      <q-list>
        <q-item v-for="(input, name) in node.type.outputs" :key="name">
          <q-item-section>
            <q-select v-if="input.options" :label="name" dense filled clearable v-model="node.values.output[name]" :options="input.options" />
            <q-input v-else dense filled :label="name" v-model="node.values.output[name]" />
            <q-btn flat round dense icon="circle" class="absolute-top-right" color="grey" size="xs" style="right:-10px; top: 20px"
                @mousedown.stop @touchstart.stop data-port="input" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Inputs -->
    <q-card-section class="q-pl-none q-pr-xl q-pt-none q-pb-xs">
      <q-list>
        <q-item v-for="(input, name) in node.type.inputs" :key="name">
          <q-item-section>
            <q-select v-if="input.options" :label="name" dense filled clearable v-model="node.values.input[name]" :options="input.options" />
            <q-input v-else dense filled :label="name" v-model="node.values.input[name]" />
            <q-btn flat round dense icon="circle" class="absolute-top-left" color="grey" size="xs" style="left:-12px; top: 20px"
                @mousedown.stop @touchstart.stop data-port="input" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'

const props = defineProps({
  node: { type: Object, required: true }
})

const node = computed(() => props.node)

const findAttribute = (n, attr) => {
  while(n) {
    try {
      if(n.getAttribute(attr)) return n.getAttribute(attr)
    } catch {}
    n = n.parentNode
  }
}

const startConnection = () => {
  var l = addEventListener("mouseup", (event) => {
    var t = event.target
    var port_type = findAttribute(t, "data-port")
    var nodeId = findAttribute(t, "data-node-id")
    if (nodeId && nodeId != node.value.id) node.value.graph.addConnection(node.value.id, nodeId)
  }, { once: true});
}

</script>

<style lang="scss">

.h-node {
  position: absolute;
  width: 300px;
}

</style>
