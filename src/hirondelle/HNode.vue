<template>
  <q-card class="h-node" :style="`left:${node.state?.x}px; top: ${node.state?.y}px;`" :data-node-id="node.id"
    @mouseenter="node.graph.settings.autoCloseNodes ? node.state.open = true : ''"
    @mouseleave="node.graph.settings.autoCloseNodes ? node.state.open = false : ''" :id="node.id">
    <!-- Title -->
    <q-card-section
      :class="`row items-center text-dark q-pa-xs
        ${node.type.isSystem ? 'bg-secondary'
          : node.type.isTrigger ? 'bg-accent text-white'
          : node.type.isAction ? 'bg-primary'
          : 'bg-grey-8 text-white'}`">
      <q-btn flat dense class="col-auto q-pr-xs" :icon="node.state.open ? 'expand_more' : 'expand_less'" size="sm"
        @click="node.state.open = !node.state.open" />
      <q-icon v-if="!node.type.active" class="col-auto q-pr-xs" name="warning" size="md" color="negative" />
      <div class="col">
        {{ node.title || node.type.title }}
        <q-badge v-if="node.nodes.length" class="bg-accent">{{ node.nodes.length }}</q-badge>
      </div>
      <q-btn flat dense v-if="node.type.id == 'group'" icon="edit" class="col-auto" @click="$emit('edit', node)"/>
      <q-btn flat dense v-if="node.type.info && node.state.open" icon="info" color="info" class="col-auto">
        <q-tooltip>{{ node.type.info }}</q-tooltip>
      </q-btn>
      <q-btn flat dense v-if="node.type.accepts_output || node.type.action" :disable="node.running || !node.type.active" icon="play_circle" class="col-auto text-positive" @click="node.start()"/>
      <q-btn flat dense icon="delete" class="col-auto text-negative" @click="node.remove"/>
    </q-card-section>
    <!-- Ports -->
    <HConnector v-if="node.type.accepts_input" port-type="input" port-class="main" :node="node" :id="`input-${node.id}`"/>
    <HConnector v-if="node.type.accepts_output" port-type="output" port-class="main" :node="node" :id="`output-${node.id}`" />
    <!-- Group -->
    <q-card-section v-if="node.type.id == 'group' && (open)">
      <q-input dense filled v-model="node.title" label="Title"/>
    </q-card-section>
    <!-- Outputs -->
    <q-card-section v-if="(node.state.open) && _.size(node.type.outputs)"
      class="q-pr-none q-pl-xl q-py-xs">
      <div class="text-caption">
        Last values:
      </div>
      <q-list>
        <q-item v-for="(output, name) in node.type.outputs" :key="name">
          <q-item-section>
            <!-- <q-select v-if="input.options" :label="name" dense filled clearable v-model="node.values.output[name]" :options="input.options" />
            <q-toggle v-else-if="input.type == 'boolean'" :label="name" dense v-model="node.values.output[name]"/>
            <q-input v-else dense filled :label="name" v-model="node.values.output[name]" :type="input.type" /> -->
            <HParam :param="output" :name="name" v-model="node.values.output[name]" :node="node" />
            <HConnector port-type="output" port-class="param" :node="node" :param="name" :id="`output-${node.id}-${name}`"/>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Inputs -->
    <q-card-section v-if="(node.state.open) &&_.size(node.type.inputs)"
      class="q-pl-none q-pr-xl q-pt-none q-pb-xs" >
      <q-list>
        <q-item v-for="(input, name) in node.type.inputs" :key="name">
          <q-item-section>
            <HParam :param="input" :name="name" v-model="node.values.input[name]" :node="node" />
            <HConnector port-type="input" port-class="param" :node="node" :param="name" :id="`input-${node.id}-${name}`"/>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Special types -->
    <q-card-section class="q-pa-sm" v-if="node.type.id == 'BA:Condition'">
      <!-- Condition ports -->
      <div class="text-right row q-pr-sm">
        <span class="col-12">Si le test est valide:</span>
        <HConnector port-type="output" port-class="condition" :node="node" :condition="true" :id="`condition-${node.id}-true`"/>
        <span class="col-12">Sinon:</span>
        <HConnector port-type="output" port-class="condition" :node="node" :condition="false" :id="`condition-${node.id}-false`"/>
      </div>
      <div v-if="(node.state.open)">
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
    <q-resize-observer @resize="updatePortPositions" />
  </q-card>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from 'lodash'
import HParam from "src/hirondelle/HParam.vue"
import HConnector from "src/hirondelle/HConnector.vue"

const props = defineProps({
  node: { type: Object, required: true }
})
const emits = defineEmits(["edit"])

const node = computed(() => props.node)

const sources = computed(() => node.value.graph.sources(node.value.id))
const source = computed(() => sources.value.length == 1 ? node.value.graph.sources(node.value.id)[0] : null)

watch(source, () => {
  if (node.value.type.id == 'BA:Condition' && source.value) {
    // On ajoute les options du filtre dans les propriétés du noeuds
    Object.keys(source.value.type.outputs).forEach(k => {
      if (!(k in node.value.options)) {
        node.value.options[k] = {}
      }
    })
  }
})

const getBoundingRect = (id) => {
  var n = document.getElementById(node.value.id)?.getBoundingClientRect()
  if (!n) return

  var scaling = node.value.graph.view.scaling
  var c = document.getElementById(id)?.getBoundingClientRect()

  if (c) return {
    x: (c.left - n.left + c.width / 2) / scaling,
    y: (c.top - n.top + c.height / 2) / scaling
  }
}

const updatePortPositions = () => {

  node.value.connectors_state = {
    main_input: {},
    main_output: {},
    input: {},
    output: {}
  }

  // Main
  node.value.connectors_state.main_input = getBoundingRect(`input-${node.value.id}`)
  node.value.connectors_state.main_output = getBoundingRect(`output-${node.value.id}`)

  // Condition
  node.value.connectors_state.condition_true = getBoundingRect(`condition-${node.value.id}-true`)
  node.value.connectors_state.condition_false = getBoundingRect(`condition-${node.value.id}-false`)

  // Input
  _.forEach(node.value.type.inputs, (input, name) => {
    node.value.connectors_state.input[name] = getBoundingRect(`input-${node.value.id}-${name}`)
  })
  // Output
  _.forEach(node.value.type.outputs, (input, name) => {
    node.value.connectors_state.output[name] = getBoundingRect(`output-${node.value.id}-${name}`)
  })
}

onMounted(() => {
})

</script>

<style lang="scss">

.h-node {
  position: absolute;
  width: 300px;
  &:hover {
    z-index:10;
  }
}

</style>
