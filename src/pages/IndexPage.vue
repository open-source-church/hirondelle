<template>
  <q-page class="col column no-wrap">
    <q-tabs inline-label class="bg-primary text-black" v-model="tab" style="z-index: 10">
      <q-tab name="obs" label="OBS" icon="tv">
        <q-badge floating :color="obs.connected ? 'green' : 'red'" />
      </q-tab>
      <q-tab name="twitch" label="Twitch" icon="stream" >
        <q-badge floating :color="twitch.chat_connected ? 'green' : 'red'" />
      </q-tab>
      <q-tab name="graph" label="Node editor" icon="account_tree" />
      <q-tab name="settings" label="Options" icon="settings" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated class="col" keep-alive>
      <q-tab-panel name="obs">
        <obs-view />
      </q-tab-panel>
      <q-tab-panel name="twitch">
        <twitch-view />
      </q-tab-panel>
      <q-tab-panel class="q-pa-none" name="graph">
        <graph-view />
      </q-tab-panel>
      <q-tab-panel name="settings">
        <settings-view />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>

import { ref, computed, reactive, watch } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'
import { useTwitch } from 'stores/twitch'
import _ from 'lodash'

const obs = useOBS()
const $q = useQuasar()
const twitch = useTwitch()

// Tabs
const tab = ref("graph")


</script>
