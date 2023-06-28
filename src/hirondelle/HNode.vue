<template>
  <q-card  class="h-node" :style="`left:${node.state?.x}px; top: ${node.state?.y}px;`" :data-node-id="node.id"
    @mouseenter="open=true" @mouseleave="open=false">
    <!-- Title -->
    <q-card-section :class="`row items-center text-dark q-pa-sm ${node.type.trigger ? 'bg-accent text-white' : 'bg-primary'}`">
      <q-icon class="col-auto q-pr-xs" name="circle" size="xs" :color="node.type.active ? 'green' : 'red'"/>
      <div class="col">{{ node.type.title }} </div>
      <q-btn flat dense :disable="node.running || !node.type.active" icon="play_circle" class="col-auto text-positive" @click="node.start()"/>
      <q-btn flat dense icon="delete" class="col-auto text-negative" @click="node.remove"/>
    </q-card-section>
    <!-- Ports -->
    <q-btn v-if="node.type.accepts_input" flat round dense icon="circle" class="absolute-top-left"
      color="red" size="sm" style="left:-12px; top: 14px"
      @mousedown.stop @touchstart.stop data-port-type="input" data-port-class="main" />
    <q-btn v-if="node.type.accepts_output" @touchstart.stop flat round dense icon="circle"
      class="absolute-top-right" color="red" size="sm" style="right:-11px; top: 14px"
      @mousedown.stop="e => startConnection({type: main, event: e})" data-port-type="output" data-port-class="main" />
    <!-- Values -->
    <!-- <q-card-section>
      {{ node.values }}
    </q-card-section> -->
    <!-- Outputs -->
    <q-card-section v-if="(open || !node.graph.settings.autoCloseNodes) && _.size(node.type.outputs)"
      class="q-pr-none q-pl-xl q-py-xs">
      <div class="text-caption">
        Last values:
      </div>
      <q-list>
        <q-item v-for="(input, name) in node.type.outputs" :key="name">
          <q-item-section>
            <q-select v-if="input.options" :label="name" dense filled clearable v-model="node.values.output[name]" :options="input.options" />
            <q-toggle v-else-if="input.type == 'boolean'" :label="name" dense v-model="node.values.output[name]"/>
            <q-input v-else dense filled :label="name" v-model="node.values.output[name]" :type="input.type" />
            <q-btn flat round dense icon="circle" class="absolute-top-right" color="grey" size="xs" style="right:-10px; top: 20px"
              @mousedown.stop="e => startConnection({type:'param', param:name, event: e})" @touchstart.stop data-port="output" data-port-class="param" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Inputs -->
    <q-card-section v-if="(open || !node.graph.settings.autoCloseNodes) &&_.size(node.type.inputs)"
      class="q-pl-none q-pr-xl q-pt-none q-pb-xs" >
      <q-list>
        <q-item v-for="(input, name) in node.type.inputs" :key="name">
          <q-item-section>
            <HParam :param="input" :name="name" v-model="node.values.input[name]" />
            <q-btn flat round dense icon="circle" class="absolute-top-left" color="grey" size="xs" style="left:-12px; top: 20px"
                @mousedown.stop @touchstart.stop data-port="input" :data-param-name="name" data-port-class="param" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Special types -->
    <q-card-section class="q-pa-sm" v-if="node.type.type == 'BA:Condition'">
      <!-- Condition ports -->
      <div class="text-right row q-pr-sm">
        <span class="col-12">Si le test est valide:</span>
        <q-btn @touchstart.stop flat round dense icon="circle"
        class="absolute" color="green" size="sm" style="right:-12px; top: 6px"
        @mousedown.stop="e => startConnection({type:'condition', condition:true, event: e})" data-port-type="output" data-port-class="condition" />
        <span class="col-12">Sinon:</span>
        <q-btn @touchstart.stop flat round dense icon="circle"
        class="absolute" color="red" size="sm" style="right:-12px; top: 28px"
        @mousedown.stop="e => startConnection({type:'condition', condition:false, event: e})" data-port-type="output" data-port-class="condition" />
      </div>
      <div v-if="(open || !node.graph.settings.autoCloseNodes)">
        <div class="text-warning" v-if="sources.length != 1">
          <q-icon name="warning" />
          Il doit y avoir exactement une source pour ce noeud.
        </div>
        <div v-else>
          <div v-for="(p, k) in source.type.outputs" :key="k">
            <span class="text-subtitle2">{{ k }}</span>
            <!-- Strings -->
            <div v-if="p.type == 'string'" class="row items-center">
              <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
                <q-icon v-if="!node.options?.[k].filterType" name="expand_more" />
                <span>{{ node.options?.[k].filterType || ""}}</span>
                <q-menu>
                  <q-list dense>
                    <q-item clickable v-close-popup
                      v-for="o in [
                        { type: '', label: 'Ignorer', icon: ''},
                        { type: '=', label: 'Egal', icon: ''},
                        { type: 'regex', label: 'RegEx Match', icon: ''},
                        { type: 'Contient', label: 'Contient', icon: ''},
                        { type: 'Est contenu dans', label: 'Est contenu dans', icon: ''},

                      ]" :key="o.type"
                      @click="node.options[k].filterType = o.type">
                      <q-item-section avatar>
                        <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                      </q-item-section>
                      <q-item-section>{{ o.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-chip>
              <template v-if="p.options && node.options[k].filterType == '='">
                <q-select class="col" dense filled clearable
                  :options="p.options" v-model="node.options[k].filterText" />
              </template>
              <template v-else>

                <q-space />
                <q-btn v-if="node.options?.[k].filterType" flat dense icon="sym_o_match_case" :color="node.options[k].matchCase ? 'accent':''"
                @click="node.options[k].matchCase = !node.options[k].matchCase">
                <q-tooltip>Match case</q-tooltip>
              </q-btn>
              <q-input v-if="node.options?.[k].filterType" class="col-12" dense filled v-model="node.options[k].filterText"/>
            </template>
            </div>
            <!-- Number -->
            <div v-if="p.type == 'number'" class="row items-center">
              <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
                <q-icon v-if="!node.options?.[k].filterType" name="expand_more" />
                <span>{{ node.options?.[k].filterType || ""}}</span>
                <q-menu>
                  <q-list dense>
                    <q-item clickable v-close-popup
                      v-for="o in [
                        { type: '', label: 'Ignorer', icon: ''},
                        { type: '=', label: 'Égal', icon: ''},
                        { type: '>', label: 'Plus grand que', icon: ''},
                        { type: '<', label: 'Plus petit que', icon: ''},
                        { type: '< x <', label: 'Entre ...', icon: ''},

                      ]" :key="o.type"
                      @click="node.options[k].filterType = o.type">
                      <q-item-section avatar>
                        <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                      </q-item-section>
                      <q-item-section>{{ o.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-chip>
              <q-input v-if="['='].includes(node.options?.[k].filterType)" class="col" dense filled type="number" v-model="node.options[k].equals" label="Égal"/>
              <q-input v-if="['>', '< x <'].includes(node.options?.[k].filterType)" class="col" dense filled type="number" v-model="node.options[k].greaterThan" label="Plus grand que"/>
              <span v-if="node.options?.[k].filterType == '< x <'" class="col-auto text-center q-px-sm">et</span>
              <q-input v-if="['<', '< x <'].includes(node.options?.[k].filterType)" class="col" dense filled type="number" v-model="node.options[k].lesserThan" label="Plus petit que"/>
            </div>
            <!-- Boolean -->
            <div v-if="p.type == 'boolean'" class="row items-center">
              <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
                <q-icon v-if="!node.options?.[k].filterType" name="expand_more" />
                <span>{{ node.options?.[k].filterType || ""}}</span>
                <q-menu>
                  <q-list dense>
                    <q-item clickable v-close-popup
                      v-for="o in [
                        { type: '', label: 'Ignorer', icon: ''},
                        { type: '=', label: 'Égal', icon: ''},
                      ]" :key="o.type"
                      @click="node.options[k].filterType = o.type">
                      <q-item-section avatar>
                        <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                      </q-item-section>
                      <q-item-section>{{ o.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-chip>
              <q-toggle v-if="node.options?.[k].filterType" v-model="node.options[k].equals" :label="node.options[k].equals ? 'True' : 'False'"/>
            </div>
          </div>
        </div>

      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from 'lodash'
import HParam from "src/hirondelle/HParam.vue"

const props = defineProps({
  node: { type: Object, required: true }
})

const node = computed(() => props.node)

const sources = computed(() => node.value.graph.sources(node.value.id))
const source = computed(() => sources.value.length == 1 ? node.value.graph.sources(node.value.id)[0] : null)

watch(source, () => {
  if (node.value.type.type == 'BA:Condition' && source.value) {
    // On ajoute les options du filtre dans les propriétés du noeuds
    Object.keys(source.value.type.outputs).forEach(k => {
      if (!(k in node.value.options)) {
        node.value.options[k] = {}
      }
    })
  }
})

const open = ref(false)

const findAttribute = (n, attr) => {
  while(n) {
    try {
      if(n.getAttribute(attr)) return n.getAttribute(attr)
    } catch {}
    n = n.parentNode
  }
}

var temporaryConnection = ref()
const updateConnection = (event) => {
  let view = node.value.graph.view
  temporaryConnection.value.to.state = view.to({x: event.pageX, y: event.pageY - 88})
}
var startPos = {}
const startConnection = ({type="main", param=null, condition=null, event}) => {
  console.log(event)
  startPos = { x: event.pageX, y: event.pageY - 88}
  // On ajoute une connection temporaire
  temporaryConnection.value = node.value.graph.addConnection({
    from: { state: node.value.graph.view.to(startPos)},
    to: { state: node.value.graph.view.to(startPos)},
    type: "temporary"
  })
  addEventListener("mousemove", updateConnection)

  addEventListener("mouseup", (event) => {
    var t = event.target
    var port_type = findAttribute(t, "data-port-type")
    var port_class = findAttribute(t, "data-port-class")
    var nodeId = findAttribute(t, "data-node-id")
    if (nodeId && nodeId != node.value.id) {
      if (type == "main") // main connection
        node.value.graph.addConnection({from: node.value.id, to: nodeId})
      else if (type == "param" ) {
        var param_name = findAttribute(t, "data-param-name")
        console.log("MAKE CONNECTION", param, nodeId, param_name)
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
      else if (type == "condition" ) {
        node.value.graph.addConnection({from: node.value.id, to: nodeId, type: type, condition: condition})
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
    }
    removeEventListener("mousemove", updateConnection)
    node.value.graph.removeTemporaryConnection()
  }, { once: true});

}

</script>

<style lang="scss">

.h-node {
  position: absolute;
  width: 300px;
}

</style>
