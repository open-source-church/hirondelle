<template>
  <q-page >
    <div v-for="(t, i) in messageBoxes" :key="'tb-'+i"
      :transition-style="t.transition" class="fixed row items-center justify-around"
      :style="`background-color: ${t.background}; left:${t.rect.x}px; top: ${t.rect.y}px; width: ${t.rect.width}px; height:${t.rect.height}px; ${t.style}`">
      {{ t.message }}
  </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { Peer } from "peerjs"
import _ from "lodash"
import 'transition-style'
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

const messageBoxes = ref([])
const messageBox = (opt) => {
  console.log(opt)
  opt.transition = "in:" + opt.transition_in
  messageBoxes.value.push(opt)
  setTimeout(() => {
    console.log("Removing")
    opt.transition = "out:" + opt.transition_out
    messageBoxes.value = messageBoxes.value.filter(tb => tb != opt)
  }, opt.duration)
}
const test = () => {
  textBox()
}

const onMessage = (data) => {
  console.log(data)
  if (data?.action == "confettis") confetti(data)
  if (data?.action == "messageBox") messageBox(data)
  else test()
}

onMounted(() => {
  setTimeout(() => connect(),  1000)
})



</script>
