<template>
  <q-page class="column">
    <q-toolbar class="col-auto bg-primary text-dark">
      <q-btn flat to="/" :label="showLabel ? 'Hirondelle' : ''" icon="img:icon.png" />
      <q-space />
      <q-tabs shrink stretch inline-label >
        <q-route-tab to="obs" :label="showLabel ? 'OBS' : ''" icon="img:icons/obs.png">
          <q-badge floating :color="obs.connected ? 'green' : 'red'" />
        </q-route-tab>
        <q-route-tab to="twitch" :label="showLabel ? 'Twitch' : ''" icon="img:icons/twitch.png" >
          <q-badge floating :color="twitch.chat_connected ? 'green' : 'red'" />
        </q-route-tab>
        <q-route-tab to="graph" :label="showLabel ? 'Node editor' : ''" icon="account_tree" />
        <q-route-tab to="settings" :label="showLabel ? 'Settings' : ''" icon="settings" />
      </q-tabs>
      <q-space />
      <div style="min-width: 100px"></div>
    </q-toolbar>

    <q-tab-panels :model-value="tab" animated keep-alive>
      <q-tab-panel name="obs">
        <obs-view />
      </q-tab-panel>
      <q-tab-panel name="twitch">
        <twitch-view />
      </q-tab-panel>
      <q-tab-panel name="graph" class="q-pa-none" >
        <graph-view />
      </q-tab-panel>
      <q-tab-panel name="settings">
        <settings-view />
      </q-tab-panel>
    </q-tab-panels>
    <!-- Github banner -->
    <github-banner />
  </q-page>
</template>

<script setup>

import { ref, computed, reactive, watch } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'
import { useTwitch } from 'stores/twitch'
import _ from 'lodash'
import { useSettings } from 'src/stores/settings'
import { useHirondelle } from 'src/hirondelle/hirondelle'
// Nodes types
import "src/hirondelle/types/variables.js"
import "src/hirondelle/types/base-actions.js"

const obs = useOBS()
const $q = useQuasar()
const S = useSettings()
const H = useHirondelle()
const twitch = useTwitch()

const props = defineProps({
  tab: { type: String, default: "obs"}
})

// Tabs
const showLabel = computed(() => $q.screen.gt.xs)

</script>
