<template>
  <template v-if="simplified">
    <div class="h-node" v-memo="[node.state.x, node.title]"
      :style="`left:${node.state?.x}px; top: ${node.state?.y}px;
      width:300px;
      height:${node._state?.height || 300}px;`">
      <q-card-section :class="headerClass" />
    <!-- Main Ports -->
    <!-- <HConnector port-type="input" port-class="flow" :node="node" />
    <HConnector port-type="output" port-class="flow" :node="node" /> -->
      <q-card-section c-if="node.state.open" class="row justify-around items-center full-height text-center">
        <span class="text-h4 q-pb-xl">{{ node.title || node.type.title }}</span>
      </q-card-section>
      <q-resize-observer @resize="updatePortPositions" />
    </div>
  </template>
  <template v-else >
  <div class="h-node" :data-node-id="node.id" v-show="visible"
    :style="`left:${node.state?.x}px; top: ${node.state?.y}px;`"
    @mouseenter="node.graph.settings.autoCloseNodes ? node.state.open = true : ''"
    @mouseleave="node.graph.settings.autoCloseNodes ? node.state.open = false : ''" :id="node.id"
    @dblclick="node.type.isGroup ? $emit('edit', node) : ''"
    >
    <!-- Title -->
    <q-card-section
      :class="'row items-center text-dark q-pa-xs ' + headerClass">
      <q-btn flat dense class="col-auto q-pr-xs" :icon="node.state.open ? 'expand_more' : 'expand_less'" size="sm"
        @click="node.state.open = !node.state.open" />
      <q-icon v-if="!node.type.active" class="col-auto q-pr-xs" name="warning" size="md" color="negative" >
        <q-tooltip>'{{ node.type.category }}' n'est pas connecté</q-tooltip>
      </q-icon>
      <div class="col ellipsis">
        {{ node.title || node.type.title }}
        <q-badge v-if="node.nodes.length" class="bg-accent">{{ node.nodes.length }}</q-badge>
      </div>
      <!-- <q-btn flat dense v-if="node.type.id == 'group'" icon="edit" class="col-auto" @click="$emit('edit', node)"/> -->
      <q-btn flat dense v-if="node.type.info && node.state.open" icon="info" color="info" class="col-auto">
        <q-tooltip anchor="top middle" self="bottom middle" class="bg-info text-dark text-body2" >{{ node.type.info }}</q-tooltip>
      </q-btn>
      <!-- <q-btn flat dense v-if="node.type.accepts_output || node.type.action" :disable="node.running || !node.type.active" icon="play_circle" class="col-auto text-positive" @click="node.start()"/> -->
      <!-- <q-btn flat dense icon="delete" class="col-auto text-negative" @click="node.remove"/> -->
    </q-card-section>
    <!-- Main Ports -->
    <HConnector v-if="node.type.accepts_input" port-type="input" port-class="flow"
      :node="node" @click.stop="() => node.start()" />
    <HConnector v-if="node.type.accepts_output" port-type="output" port-class="flow" :node="node" />
    <!-- Group -->
    <q-card-section v-if="node.type.id == 'group' && node.state.open">
      <input v-model="node.title" class="full-width"/>
    </q-card-section>
    <!-- Slots / Signals -->
    <q-card-section v-if="(node.state.open) && (_.size(node.type.slots) || _.size(node.type.signals))"
      class="q-pl-none q-pr-none q-pb-xs row">
      <div class="col-6">
        <template v-for="(f, key) in node.type.slots" :key="key">
          <div dense class="" v-if="!node._state.slots?.[key]?.hidden">
            <div>
              <div>
                {{ key }} <span class="text-grey">()</span>
              </div>
              <HConnector port-type="input" port-class="flow" :slot-name="key" :node="node"
              @click.stop.prevent="() => node.start(key)" />
            </div>
          </div>
        </template>
      </div>
      <div class="col-6">
        <div dense v-for="(f, key) in node.type.signals" :key="key" class="text-right">
          <div>
            <div>
              {{ key }} <span class="text-grey">()</span>
            </div>
            <HConnector port-type="output" port-class="flow" :signal="key" :node="node"
            @click="() => node.emit(key)" />
          </div>
        </div>
      </div>
    </q-card-section>
    <!-- Inputs -->
    <q-card-section v-if="(node.state.open) && (_.size(node.inputs) || node.type.isGroup)"
      class="q-pl-none q-pr-xl q-pt-none q-pb-xs" >
      <div>
        <div dense v-for="(input, name) in _.pickBy(node.inputs, p => !p.hidden)" :key="name">
          <div>
            <HParam :param="input" :name="name" v-model="node.values.input[name].val" :node="node" />
            <HConnector port-type="input" port-class="param" :node="node" :param-id="input.id" />
          </div>
        </div>
        <!-- On affiche les params des groupes -->
        <template v-if="node.type.isGroup">
          <div dense v-for="(c) in node.connectionsFrom.filter(c => c.type == 'clone')" :key="c.input.name">
            <div>
              <HParam :param="c.input" :name="c.input.name" v-model="c.to.values.input[c.input.name].val" :node="c.to" />
              <HConnector port-type="input" port-class="param" :node="c.to" :param-id="c.input.id" />
            </div>
          </div>
        </template>
      </div>
    </q-card-section>
    <!-- SPECIAL TYPES : CONDITIONS -->
    <q-card-section class="q-pa-sm" v-if="node.type.id == 'BA:Condition'">
      <div v-if="(node.state.open)">
        <div class="text-info" v-if="!node.values.input.vars.val.length">
          <q-icon name="info" />
          Ajouter des connections vers 'vars' pour filtrer des trucs.
        </div>
        <div v-for="(v) in node.values.input.vars.val" :key="v.id">
          <span class="text-subtitle2">{{ v.name }}</span>
          <!-- Strings -->
          <div v-if="v.type == 'string'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[v.name].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[v.name].filterType || ""}}</span>
              <q-menu>
                <div dense>
                  <div clickable v-close-popup
                    v-for="o in [
                      { type: '', label: 'Ignorer', icon: ''},
                      { type: '=', label: 'Egal', icon: ''},
                      { type: 'regex', label: 'RegEx Match', icon: ''},
                      { type: 'Contient', label: 'Contient', icon: ''},
                      { type: 'Est contenu dans', label: 'Est contenu dans', icon: ''},

                    ]" :key="o.type"
                    @click="node.state.filter[v.name].filterType = o.type">
                    <div avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </div>
                    <div>{{ o.label }}</div>
                  </div>
                </div>
              </q-menu>
            </q-chip>
            <template v-if="v.options && node.state.filter[v.name].filterType == '='">
              <q-select class="col" dense filled clearable options-dense
                :options="v.options" v-model="node.state.filter[v.name].filterText" />
            </template>
            <template v-else>

              <q-space />
              <q-btn v-if="node.state.filter?.[v.name].filterType" flat dense icon="sym_o_match_case" :color="node.state.filter[v.name].matchCase ? 'accent':''"
              @click="node.state.filter[v.name].matchCase = !node.state.filter[v.name].matchCase">
              <q-tooltip>Match case</q-tooltip>
            </q-btn>
            <q-input v-if="node.state.filter?.[v.name].filterType" class="col-12" dense filled v-model="node.state.filter[v.name].filterText"/>
          </template>
          </div>
          <!-- Number -->
          <div v-if="v.type == 'number'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[v.name].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[v.name].filterType || ""}}</span>
              <q-menu>
                <div dense>
                  <div clickable v-close-popup
                    v-for="o in [
                      { type: '', label: 'Ignorer', icon: ''},
                      { type: '=', label: 'Égal', icon: ''},
                      { type: '>', label: 'Plus grand que', icon: ''},
                      { type: '<', label: 'Plus petit que', icon: ''},
                      { type: '< x <', label: 'Entre ...', icon: ''},

                    ]" :key="o.type"
                    @click="node.state.filter[v.name].filterType = o.type">
                    <div avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </div>
                    <div>{{ o.label }}</div>
                  </div>
                </div>
              </q-menu>
            </q-chip>
            <q-input v-if="['='].includes(node.state.filter?.[v.name].filterType)" class="col" dense filled type="number" v-model="node.state.filter[v.name].equals" label="Égal"/>
            <q-input v-if="['>', '< x <'].includes(node.state.filter?.[v.name].filterType)" class="col" dense filled type="number" v-model="node.state.filter[v.name].greaterThan" label="Plus grand que"/>
            <span v-if="node.state.filter?.[v.name].filterType == '< x <'" class="col-auto text-center q-px-sm">et</span>
            <q-input v-if="['<', '< x <'].includes(node.state.filter?.[v.name].filterType)" class="col" dense filled type="number" v-model="node.state.filter[v.name].lesserThan" label="Plus petit que"/>
          </div>
          <!-- Boolean -->
          <div v-if="v.type == 'boolean'" class="row items-center">
            <q-chip square class="col-auto cursor-pointer bg-grey-9 q-mr-sm">
              <q-icon v-if="!node.state.filter?.[v.name].filterType" name="expand_more" />
              <span>{{ node.state.filter?.[v.name].filterType || ""}}</span>
              <q-menu>
                <div dense>
                  <div clickable v-close-popup
                    v-for="o in [
                      { type: '', label: 'Ignorer', icon: ''},
                      { type: '=', label: 'Égal', icon: ''},
                    ]" :key="o.type"
                    @click="node.state.filter[v.name].filterType = o.type">
                    <div avatar>
                      <q-chip dense square class="col-auto bg-grey-9"> {{ o.type}} </q-chip>
                    </div>
                    <div>{{ o.label }}</div>
                  </div>
                </div>
              </q-menu>
            </q-chip>
            <q-toggle v-if="node.state.filter?.[v.name]?.filterType" v-model="node.state.filter[v.name].equals" :label="node.state.filter[v.name].equals ? 'True' : 'False'"/>
          </div>
        </div>
      </div>
    </q-card-section>
    <!-- Outputs -->
    <q-card-section v-if="(node.state.open) && (_.size(node.outputs)  || node.type.isGroup)"
      class="q-pr-none q-pl-xl q-py-xs justify-end">
      <div>
        <div dense v-for="(output, name) in _.pickBy(node.outputs, p => !p.hidden)" :key="name">
          <!-- <div /> -->
          <div >
            <HParam :disable="false" :param="output" :name="name" v-model="node.values.output[name].val" :node="node" />
            <HConnector port-type="output" port-class="param" :node="node" :param-id="output.id" />
          </div>
        </div>
        <!-- On affiche les params des groupes -->
        <template v-if="node.type.isGroup">
          <div dense v-for="(c) in node.connectionsTo.filter(c => c.type == 'clone')" :key="c.output.name">
            <div>
              <HParam :param="c.output" :name="c.output.name" v-model="c.from.values.output[c.output.name].val" :node="c.to" />
              <HConnector port-type="output" port-class="param" :node="c.from" :param-id="c.output.id" />
            </div>
          </div>
        </template>
      </div>
    </q-card-section>
    <q-resize-observer @resize="updatePortPositions" />
  </div>


  </template>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from 'lodash'
// import HParam from "src/hirondelle/HParam.vue"
import HParam from "src/hirondelle/HParamNative.vue"
// import HConnector from "src/hirondelle/HConnector.vue"
import HConnector from "src/hirondelle/HConnectorNative.vue"
import { useHirondelle } from './hirondelle';
import { useMovePanZoom } from './movePanZoom';

const H = useHirondelle()
const PZ = useMovePanZoom()

const props = defineProps({
  node: { type: Object, required: true },
  showSimplified: { type: Boolean }
})
const emits = defineEmits(["edit"])

const node = computed(() => props.node)
const simplified = computed(() =>  H.view.scaling < .3) //props.showSimplified) // H.view.scaling < .3 // || PZ.isMoving
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

const inputs = computed(() => {
  return props.node.inputs
})
const outputs = computed(() => {
  return props.node.outputs
})

watch(node.value, () => {
  if (node.value.type.id == 'BA:Condition' && node.value.values.input.vars) {
    if (!node.value.state.filter) node.value.state.filter = {}
    // On ajoute les options du filtre dans les propriétés du noeuds
    node.value.values.input.vars.val.forEach(v => {
      if (!(v.name in node.value.state.filter)) node.value.state.filter[v.name] = {}
    })
  }
})

const updatePortPositions = (val) => {
  if (node.value._state?.width && simplified.value) return
  node.value._state.width = val.width
  node.value._state.height = val.height
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
