<template>
  <q-page >
    <!-- Message boxes -->
    <div v-for="(t, i) in messageBoxes" :key="'tb-'+i"
      :transition-style="t.transition" class="fixed row items-center justify-around text-center"
      :style="`background-color: ${t.background}; left:${t.rect.x}px; top: ${t.rect.y}px; width: ${t.rect.width}px; height:${t.rect.height}px; ${t.style}`">
      {{ t.message }}
    </div>
    <!-- Progress bars -->
    <q-linear-progress v-for="pb in progressBars.filter(pb => pb.visible)" :key="pb.id"
    :animation-speed="pb.value ? 300 : 0"
    :style="`background-color: ${pb.background}; left:${pb.rect.x}px; top: ${pb.rect.y}px; width: ${pb.rect.width}px; height:${pb.rect.height}px; ${pb.style}`"
    :value="pb.value" class="absolute"
    />

  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted, resolveDirective } from 'vue'
import { useQuasar } from 'quasar'
import { Peer } from "peerjs"
import _ from "lodash"
import 'transition-style'
import JSConfetti from 'js-confetti'
import {Howl, Howler} from 'howler'

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

const progressBars = ref([])
const progressBar = (opt) => {
  console.log(opt, progressBars.value)
  var pb = progressBars.value.find(p => p.id == opt.id)
  if (pb) _.assign(pb, opt)
  else progressBars.value.push(opt)
}

const playSound = (opt) => {
  // https://www.myinstants.com/media/sounds/kaamelott-paladin.mp3
  // https://kaamelott-soundboard.2ec0b4.fr/sounds/ah_ah_ah_les_pegus.mp3
  // https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3 // success
  // https://cdn.pixabay.com/audio/2022/03/15/audio_e8b2fa25cf.mp3 // good result
  var sound = new Howl({
    src: [opt.src],
    html5: true,
    volume: opt.volume
  })
  sound.play()
}

const test = () => {
  var obj = {
    action: "confettis",
    bursts: 1,
    duration: 0,
    confettiNumber: 30,
    confettiRadius: 10
  }
  confetti(obj)
  playSound({
    src: "https://cdn.pixabay.com/audio/2022/03/17/audio_bc9b676777.mp3",
    volume: .3
  })
}

const onMessage = (data) => {
  console.log(data)
  if (data?.action == "confettis") confetti(data)
  else if (data?.action == "messageBox") messageBox(data)
  else if (data?.action == "progressBar") progressBar(data)
  else if (data?.action == "playSound") playSound(data)
  else test(data)
}

onMounted(() => {
  setTimeout(() => connect(),  1000)
})



</script>
