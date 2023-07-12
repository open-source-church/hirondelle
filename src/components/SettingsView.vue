<template>
  <div class="column">
    <div class="col-1 row q-gutter-md">
      <q-card class="col-auto">
        <q-card-section class="bg-primary text-dark">Export settings</q-card-section>
        <q-card-section class="column q-gutter-md">
          <q-toggle label="OBS" v-model="export_opt.obs" />
          <q-toggle label="Actions" v-model="export_opt.graph" />
          <q-toggle label="Twitch" v-model="export_opt.twitch" />
          <q-toggle label="Passwords" v-model="export_opt.passwords" />
          <q-btn label="Export Settings" class="bg-primary text-dark" @click="exportSettings"/>
        </q-card-section>
      </q-card>
      <q-card class="col">
        <q-card-section class="bg-primary text-dark">Load settings</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input dense filled type="textarea" v-model="import_opt" placeholder="Colle ici quelque chose"/>
          <q-btn class="bg-primary text-dark" label="Import Settings" @click="importSettings"/>
        </q-card-section>
      </q-card>
    </div>
  </div>
  <div class="column q-mt-md">
    <div class="col-3 row q-gutter-md">
      <q-card class="col-auto">
        <q-card-section class="bg-primary text-dark">
          Backups
          <q-btn flat icon="add_circle" class="absolute-right" @click="S.B.createBackup()"/>
        </q-card-section>
        <q-card-section class="column q-gutter-md">
          <q-list separator>
            <q-item v-for="b in backups" :key="b.date" >
              <q-item-section>
                <q-item-label class="cursor-pointer">
                  {{ b.name || date.formatDate(b.date, "YYYY-MM-DD HH:mm:ss") }}
                  <q-popup-edit :model-value="b.name" auto-save v-slot="scope"
                    @update:model-value="val => S.B.renameBackup(b.date, val)">
                    <q-input label="Backup name" v-model="scope.value" dense autofocus counter @keyup.enter="scope.set" />
                  </q-popup-edit>
                </q-item-label>
                <q-item-label caption>{{ b.nodes }} nodes · {{ b.connections }} connections</q-item-label>
                <q-item-label caption>Il y a {{ date.getDateDiff(now, b.date, "minutes") }} minutes</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div>
                  <q-btn flat dense round icon="delete" color="negative" @click="S.B.removeBackup(b.date)"/>
                  <q-btn flat dense round icon="publish" color="positive" @click="restoreBackup(b)"/>
                  <q-btn flat dense round icon="content_copy" @click="copyBackup(b)"/>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useQuasar, copyToClipboard, date } from 'quasar'
import _ from 'lodash'
import { useSettings } from 'stores/settings'
// Node
import { useHirondelle } from "src/hirondelle/hirondelle.js"

const $q = useQuasar()
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
  if(obj.graph.state) {
    H.graph.load(obj.graph.state, true)
  }
  $q.notify("Settings chargés")
}

const now = Date.now()
const backups = computed(() => _.sortBy(S.backups, "date").reverse())

const restoreBackup = backup => {
  console.log(`Restoring backup: ${backup.name || backup.date}`)
  H.graph.load(backup.data.graph.state, true)
}
const copyBackup = backup => {
  copyToClipboard(JSON.stringify(backup.data, null, "  "))
  $q.notify("Backup copiée dans le presse papier")
}

</script>

<style lang="scss">

</style>
