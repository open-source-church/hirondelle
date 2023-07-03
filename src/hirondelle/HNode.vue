<template>
  <template v-if="simplified">
    <div class="h-node"
    :style="`left:${node.state?.x}px; top: ${node.state?.y}px;
    width:300px;
    height:${node._state?.height || 300}px;`">
    <q-card-section :class="headerClass" />
    <q-resize-observer @resize="updatePortPositions" />
    </div>
  </template>
  <template v-else >
  <div class="h-node" :data-node-id="node.id" v-show="visible"
    :style="`left:${node.state?.x}px; top: ${node.state?.y}px;`"
    @mouseenter="node.graph.settings.autoCloseNodes ? node.state.open = true : ''"
    @mouseleave="node.graph.settings.autoCloseNodes ? node.state.open = false : ''" :id="node.id">
    <!-- Title -->
    <q-card-section
      :class="'row items-center text-dark q-pa-xs ' + headerClass">
      <q-btn flat dense class="col-auto q-pr-xs" :icon="node.state.open ? 'expand_more' : 'expand_less'" size="sm"
        @click="node.state.open = !node.state.open" />
      <q-icon v-if="!node.type.active" class="col-auto q-pr-xs" name="warning" size="md" color="negative" >
        <q-tooltip>'{{ node.type.category }}' n'est pas connecté</q-tooltip>
      </q-icon>
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
    <!-- Main Ports -->
    <HConnector v-if="node.type.accepts_input" port-type="input" port-class="flow" :node="node" />
    <HConnector v-if="node.type.accepts_output" port-type="output" port-class="flow" :node="node" />
    <!-- Group -->
    <q-card-section v-if="node.type.id == 'group' && node.state.open">
      <q-input dense filled v-model="node.title" label="Title"/>
    </q-card-section>
    <!-- Slots / Signals -->
    <q-card-section v-if="(node.state.open) && (_.size(node.type.slots) || _.size(node.type.signals))"
      class="q-pl-none q-pr-none q-pb-xs row">
      <q-list class="col-6">
        <q-item dense v-for="(f, key) in node.type.slots" :key="key" class="">
          <q-item-section>
            <q-item-label>
              {{ key }} <span class="text-grey">()</span>
            </q-item-label>
            <HConnector port-type="input" port-class="flow" :slot-name="key" :node="node"
            @click="() => node.start(key)" />
          </q-item-section>
        </q-item>
      </q-list>
      <q-list class="col-6">
        <q-item dense v-for="(f, key) in node.type.signals" :key="key" class="text-right">
          <q-item-section>
            <q-item-label>
              {{ key }} <span class="text-grey">()</span>
            </q-item-label>
            <HConnector port-type="output" port-class="flow" :signal="key" :node="node"
            @click="() => node.emit(key)" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Outputs -->
    <q-card-section v-if="(node.state.open) && _.size(node.outputs)"
      class="q-pr-none q-pl-xl q-py-xs justify-end">
      <q-list>
        <q-item dense v-for="(output, name) in node.outputs" :key="name">
          <!-- <q-item-section /> -->
          <q-item-section >
            <HParam :disable="false" :param="output" :name="name" v-model="node.values.output[name].val" :node="node" />
            <HConnector port-type="output" port-class="param" :node="node" :param-id="output.id" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- Inputs -->
    <q-card-section v-if="(node.state.open) &&_.size(node.inputs)"
      class="q-pl-none q-pr-xl q-pt-none q-pb-xs" >
      <q-list>
        <q-item dense v-for="(input, name) in node.inputs" :key="name">
          <q-item-section>
            <HParam :param="input" :name="name" v-model="node.values.input[name].val" :node="node" />
            <HConnector port-type="input" port-class="param" :node="node" :param-id="input.id" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <!-- SPECIAL TYPES : CONDITIONS -->
    <q-card-section class="q-pa-sm" v-if="node.type.id == 'BA:Condition'">
      <div v-if="(node.state.open)">
        <div class="text-info" v-if="_.isEmpty(paramSources.vars)">
          <q-icon name="info" />
          Ajouter des connections vers 'vars' pour filtrer des trucs.
        </div>
        <div v-for="(p, k) in node._paramSourcesType" :key="k">
          <span class="text-subtitle2">{{ k }}</span>
          <!-- Strings -->
          <div v-if="p.type == 'string'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[k].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[k].filterType || ""}}</span>
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
                    @click="node.state.filter[k].filterType = o.type">
                    <q-item-section avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </q-item-section>
                    <q-item-section>{{ o.label }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-chip>
            <template v-if="p.options && node.state.filter[k].filterType == '='">
              <q-select class="col" dense filled clearable options-dense
                :options="p.options" v-model="node.state.filter[k].filterText" />
            </template>
            <template v-else>

              <q-space />
              <q-btn v-if="node.state.filter?.[k].filterType" flat dense icon="sym_o_match_case" :color="node.state.filter[k].matchCase ? 'accent':''"
              @click="node.state.filter[k].matchCase = !node.state.filter[k].matchCase">
              <q-tooltip>Match case</q-tooltip>
            </q-btn>
            <q-input v-if="node.state.filter?.[k].filterType" class="col-12" dense filled v-model="node.state.filter[k].filterText"/>
          </template>
          </div>
          <!-- Number -->
          <div v-if="p.type == 'number'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[k].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[k].filterType || ""}}</span>
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
                    @click="node.state.filter[k].filterType = o.type">
                    <q-item-section avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </q-item-section>
                    <q-item-section>{{ o.label }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-chip>
            <q-input v-if="['='].includes(node.state.filter?.[k].filterType)" class="col" dense filled type="number" v-model="node.state.filter[k].equals" label="Égal"/>
            <q-input v-if="['>', '< x <'].includes(node.state.filter?.[k].filterType)" class="col" dense filled type="number" v-model="node.state.filter[k].greaterThan" label="Plus grand que"/>
            <span v-if="node.state.filter?.[k].filterType == '< x <'" class="col-auto text-center q-px-sm">et</span>
            <q-input v-if="['<', '< x <'].includes(node.state.filter?.[k].filterType)" class="col" dense filled type="number" v-model="node.state.filter[k].lesserThan" label="Plus petit que"/>
          </div>
          <!-- Boolean -->
          <div v-if="p.type == 'boolean'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[k].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[k].filterType || ""}}</span>
              <q-menu>
                <q-list dense>
                  <q-item clickable v-close-popup
                    v-for="o in [
                      { type: '', label: 'Ignorer', icon: ''},
                      { type: '=', label: 'Égal', icon: ''},
                    ]" :key="o.type"
                    @click="node.state.filter[k].filterType = o.type">
                    <q-item-section avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </q-item-section>
                    <q-item-section>{{ o.label }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-chip>
            <q-toggle v-if="node.state.filter?.[k].filterType" v-model="node.state.filter[k].equals" :label="node.state.filter[k].equals ? 'True' : 'False'"/>
          </div>
        </div>
      </div>
    </q-card-section>
    <q-resize-observer @resize="updatePortPositions" />
  </div>


  </template>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from 'lodash'
import HParam from "src/hirondelle/HParam.vue"
import HConnector from "src/hirondelle/HConnector.vue"
import { useHirondelle } from './hirondelle';
import { useMovePanZoom } from './movePanZoom';

const H = useHirondelle()
const PZ = useMovePanZoom()

const props = defineProps({
  node: { type: Object, required: true }
})
const emits = defineEmits(["edit"])

const node = computed(() => props.node)
const simplified = computed(() => H.view.scaling < .3) // || PZ.isMoving
const visible = computed(() =>
  node.value.state.x + (node.value._state?.width || 300) > H.view.viewport.left + 20 &&
  node.value.state.x < H.view.viewport.right - 20 &&
  node.value.state.y + (node.value._state?.height || 300) > H.view.viewport.top - 20 &&
  node.value.state.y < H.view.viewport.bottom - 20
  )

const headerClass = computed(() => node.value.type.isSystem ? 'bg-secondary'
          : node.value.type.isTrigger ? 'bg-accent text-white'
          : node.value.type.isAction ? 'bg-primary'
          : 'bg-grey-8 text-white')


const paramSources = computed(() => {
  // En fait on l'utilise juste pour le watcher, mais pour les valeurs on utilise
  // un hack avec node._paramSourcesType
  return node.value.graph.paramSources(node.value.id)
})

const inputs = computed(() => {
  return props.node.inputs
})
const outputs = computed(() => {
  return props.node.outputs
})

watch(paramSources, () => {
  if (node.value.type.id == 'BA:Condition' && node.value._paramSourcesType) {
    if (!node.value.state.filter) node.value.state.filter = {}
    // On ajoute les options du filtre dans les propriétés du noeuds
    Object.keys(node.value._paramSourcesType).forEach(k => {
      if (!(k in node.value.state.filter)) {
        node.value.state.filter[k] = {}
      }
    })
  }
})

const updatePortPositions = (val) => {
  node.value._state = {
    width: val.width,
    height: val.height
  }
}

onMounted(() => {
})

</script>

<style lang="scss">

.h-node {
  position: absolute;
  width: 300px;
  background: #212227;
  border-radius: 10px;
  &:hover {
    z-index:10;
  }

  .q-card__section {
    border-radius: 10px 10px 0px 0px;
  }
}

</style>
