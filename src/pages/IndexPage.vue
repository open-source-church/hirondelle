<template>
  <q-page >
    <div class="row">
      <q-input class="col-10" v-model="ip" label="URL" />
      <q-input class="col-2" v-model="port" label="port" />

      <q-input class="col-12" v-model="password" label = "password" />
      <q-btn class="col-6" @click="obs.connect(url, password)" label="Connect" color="primary"/>
      <q-btn class="col-6" @click="obs.disconnect()" label="Disconnect" color="secondary"/>

      <q-checkbox :model-value="obs.connected" label="Connecté"/>

      <q-chip v-for="s in obs.scenes" :key="s.sceneIndex" :label="s.sceneName" clickable
        :color="s.program ? 'green' : s.preview ? 'blue' : ''"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)" />

        <h1>Coucou : {{ value }}</h1>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar } from 'quasar'

const obs = useOBS()
const $q = useQuasar()

const ip = ref("192.168.1.56")
const port = ref("4455")
const password = ref("testing")

const url = computed(() => `ws://${ip.value}:${port.value}`)

// $q.localStorage.set("test", 12)
const value = $q.localStorage.getItem("test")

</script>
