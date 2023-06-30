<template>
  <div class="row">
    <q-card class="col-4">
      <q-card-section class="bg-primary text-dark">Export settings</q-card-section>
      <q-card-section class="column">
        <q-toggle label="OBS" v-model="export_opt.obs" />
        <q-toggle label="Actions" v-model="export_opt.graph" />
        <q-toggle label="Twitch" v-model="export_opt.twitch" />
        <q-toggle label="Passwords" v-model="export_opt.passwords" />
        <q-btn label="Export Settings" class="bg-primary text-dark" @click="exportSettings"/>
      </q-card-section>
    </q-card>
    <q-card class="col-4">
      <q-card-section class="bg-primary text-dark">Load settings</q-card-section>
      <q-card-section class="column">
        <q-input dense filled type="textarea" v-model="import_opt"/>
        <q-btn label="Import Settings" class="bg-primary text-dark" @click="importSettings"/>
      </q-card-section>
    </q-card>
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

const export_opt = ref({
  obs: true,
  graph: true,
  twitch: true,
  passwords: false
})
const exportSettings = () => {
  var obj = {}
  console.log(export_opt.value)
  if (export_opt.value.obs) obj.obs = S.get("obs") || {}
  if (export_opt.value.graph) obj.graph = S.get("graph") || {}
  if (export_opt.value.twitch) obj.twitch = S.get("twitch") || {}

  obj = _.cloneDeep(obj)

  if (!export_opt.value.passwords) {
    if (export_opt.value.obs) obj.obs.password = null
    if (export_opt.value.twitch) obj.twitch.access_token = null
  }
  copyToClipboard(JSON.stringify(obj, null, "  "))
  $q.notify("Settings copiés dans le presse papier")
}
const import_opt = ref("")
const importSettings = () => {
  var obj = JSON.parse(import_opt.value)
  console.log(obj)
  if(obj.graph.state) H.graph.load(obj.graph.state)
  $q.notify("Settings chargés")
}

</script>

<style lang="scss">

</style>
