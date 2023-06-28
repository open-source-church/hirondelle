<template>
  <q-page >
    <h1>Peer connected: {{ peer_connected }}</h1>
    <Transition>
      <p v-if="show">Message</p>
    </Transition>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { Peer } from "peerjs"
import _ from "lodash"
import JSConfetti from 'js-confetti'
const jsConfetti = new JSConfetti()


const $q = useQuasar()

const props = defineProps(["peer_id"])

var conn = ref({})
var peer = new Peer()
const peer_connected = computed(() => conn.value.peer == props.peer_id)

peer.on("error", err => {
  console.log("Error", err)
})

const connect = async () => {
  console.log("Connecting to", props.peer_id)
  conn.value = peer.connect(props.peer_id)

  conn.value.on("data", onMessage)
  conn.value.on("close", connect)
  conn.value.on("error", connect)
}
watch(peer_connected, val => {
  if (!val) connect()
})

setInterval(() => conn.value.send("ping"), 5000)

const confetti = (opt) => {
  for(var i in _.range(opt.bursts || 1)) {
    let c = {
      confettiNumber: opt.confettiNumber * (.7 + Math.random() * .6),
    }
    if (opt.emojis) {
      c.emojis = opt.emojis.map(e => decodeURI(e))
      c.emojiSize = opt.emojiSize * (.7 + Math.random() * .6)
    } else {
      c.confettiRadius = opt.confettiRadius * (.7 + Math.random() * .6),
      c.confettiColors = opt.confettiColors
    }
    setTimeout(() => jsConfetti.addConfetti(c), i == 0 ? 0 : Math.random() * (opt.duration || 0))
  }
}

const show = ref(false)
const test = () => {
  show.value = true
  setTimeout(() => show.value = false, 2000)
}

const onMessage = (data) => {
  console.log(data)
  if (data?.action == "confettis") confetti(data)
  else test()
}

onMounted(() => {
  setTimeout(() => connect(),  1000)
})



</script>
