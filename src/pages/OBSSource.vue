<template>
  <q-page >
    <div class="row">
      Dernier message: {{ last_message }}
      <q-btn @click="connect" label="connect" />
      <h1>Connected: {{ peer_connected }}</h1>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar } from 'quasar'

import { Peer } from "peerjs"

const $q = useQuasar()

const props = defineProps(["peer_id"])

var conn = ref({})
var peer = new Peer()
const peer_connected = computed(() => conn.value.connectionId != null)

peer.on("error", err => {
  console.log("Error", err)
})

const last_message = ref()


const connect = async () => {
  console.log("Connecting to", props.peer_id)
  conn.value = peer.connect(props.peer_id)

  conn.value.on("data", data => {
    console.log("DATA", data)
    last_message.value = data
  })
}

onMounted(() => {
  setTimeout(() => connect(),  1000)
})



</script>
