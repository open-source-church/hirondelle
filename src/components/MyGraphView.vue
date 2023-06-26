<template>
  <div class="column fit fixed">
    <div class="col-auto">
      <q-btn label="calculate" color="accent" flat icon="play_circle"/>
      {{ H.editor.view }}
      {{ PZ.pointers }}
    </div>
    <div class="col fit" style="min-width: 100px; min-height:100px;" >
      <HEditor />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import { usePeer } from 'stores/peer'
import { useIcons } from 'stores/material_icons'
import { useTwitch } from 'stores/twitch'
// import { displayNode, myNode } from 'stores/nodes'
import _ from 'lodash'
import { useActions } from 'stores/actions'
import { useSettings } from 'stores/settings'
// Node
import HEditor from "src/hirondelle/HEditor.vue"
import { useHirondelle } from "src/hirondelle/hirondelle.js"
import { useMovePanZoom } from "src/hirondelle/movePanZoom.js"

const $q = useQuasar()
const A = useActions()
const S = useSettings()

const H = useHirondelle()
const PZ = useMovePanZoom()


</script>

<style lang="scss">

</style>
