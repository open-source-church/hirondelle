<template>
  <q-page >
    <div class="row">
      <q-input class="col-10" v-model="ip" label="URL" />
      <q-input class="col-2" v-model="port" label="port" />

      <q-input class="col-12" v-model="password" label = "password" />
      <q-btn class="col-6" @click="obs.connect(url, password)" label="Connect" color="primary"/>
      <q-btn class="col-6" @click="obs.disconnect()" label="Disconnect" color="secondary"/>

      <q-checkbox :model-value="obs.connected" label="Connecté"/>
      <q-checkbox v-model="obs.preview" label="Preview"/>
      <q-checkbox :model-value="obs.studio" @update:model-value="obs.setStudioMode(!obs.studio)" label="Studio"/>

      <q-chip v-for="s in obs.scenes" :key="s.sceneIndex" :label="s.sceneName" clickable
        :color="s.program ? 'green' : s.preview ? 'blue' : ''"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)" />
      <div class="col-12 row">
        <q-img class="col" :src="obs.preview_img" no-transition v-if="obs.studio" />
        <q-img class="col" :src="obs.program_img" no-transition />
      </div>
      <div class="col-12 row items-center">
        <div class="col-auto q-pa-md">
          Browser source in OBS to:
        </div>
        <q-input class="col" readonly v-model="source_url" filled dense >
          <template v-slot:append>
            <q-btn @click="copyURL" icon="content_copy"/>
          </template>
        </q-input>
      </div>
      Connection status: <q-icon name="circle" size="md" :color="peer_connected ? 'green' : 'red'"/>
      <q-btn label="Send data" @click="send" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'

import { Peer } from "peerjs"

const obs = useOBS()
const $q = useQuasar()

const ip = ref("192.168.1.56")
const port = ref("4455")
const password = ref("testing")

const url = computed(() => `ws://${ip.value}:${port.value}`)

const peer_id = ref($q.localStorage.getItem("peer_id"))
const conn = ref({})
const peer_connected = computed(() => conn.value.connectionId != null)
var peer = new Peer(peer_id.value)
// On store l'id
peer.on("open", id => {
  $q.localStorage.set("peer_id", id)
  peer_id.value = id
})

peer.on("connection", c => {
  console.log("Connection", c)
  conn.value = c
})

peer.on("error", err => {
  console.log("Error", err)
})

const send = () => {
  conn.value.send("Coucou: " + Math.random().toString(36).substring(4))
}

const source_url = computed(() => window.location + "source/" + peer_id.value)
const copyURL = () => {
  copyToClipboard(source_url.value)
  $q.notify("URL copiée dans le presse-papier.")
}

</script>
