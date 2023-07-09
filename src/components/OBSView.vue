<template>
  <div class="row q-gutter-md q-pa-xl" v-if="!obs.connected" @keyup.enter="obs.connect(ip, port, password)" >
    <q-input dense filled class="col" v-model="ip" label="IP" />
    <q-input dense filled class="col" v-model="port" label="port" />

    <q-input dense filled class="col-12" v-model="password" type="password" label = "password" />
    <q-btn  class="col-12 q-mt-md" icon="power" @click="obs.connect(ip, port, password)" label="Connect" color="primary" text-color="dark"/>

    <q-banner class="text-info">
      <template v-slot:avatar > <q-icon name="info"  /> </template>
      <p>Start Websocket server in OBS: <b>Tools > Websocker server settings > Show connect info</b> and fill info shere.</p>
      <p>None of those data leave your browser, connection is made between Hirondelle and OBS directly on your local network.</p>
    </q-banner>
  </div>
  <div class="row" v-else >
    <!-- Toolbar -->
    <div class="col-12 row q-gutter-sm items-center justify-center">
      <!-- Preview and settings -->
      <q-btn-dropdown class="col-auto" split :flat="!obs.preview" icon="preview" color="accent" @click="obs.preview = !obs.preview">
        <template v-slot:label>
          <h-tooltip>Realtime preview</h-tooltip>
        </template>
        <q-list>
          <q-item>
            <q-item-section side><q-icon name="preview" /></q-item-section>
            <q-item-section>Preview</q-item-section>
            <q-item-section side><q-toggle dense v-model="obs.preview"/></q-item-section>
          </q-item>
          <q-item>
            <q-item-section side><q-icon name="hd" /></q-item-section>
            <q-item-section>
              <q-item-label>
                Resolution:
                {{ `${obs.screenshotOptions.imageWidth}×${_.round(obs.screenshotOptions.imageWidth / obs.data.ratio)}` }}
              </q-item-label>
              <q-item-label>
                <q-slider dense :step="50" :min="obs.data.baseWidth * .05" :max="obs.data.baseWidth" v-model="obs.screenshotOptions.imageWidth"/>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section side><q-icon name="deblur" /></q-item-section>
            <q-item-section>
              <q-item-label> Quality: {{ obs.screenshotOptions.imageCompressionQuality }} </q-item-label>
              <q-item-label>
                <q-slider dense :step="5" :min="0" :max="100" v-model="obs.screenshotOptions.imageCompressionQuality"/>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section side><q-icon name="30fps_select" /></q-item-section>
            <q-item-section>
              <q-item-label>
                FPS: {{ `${obs.screenshotOptions.imagePerSecond}` }}
              </q-item-label>
              <q-item-label>
                <q-slider dense :step="1" :min="1" :max="24" v-model="obs.screenshotOptions.imagePerSecond"/>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section side><q-icon name="image" /></q-item-section>
            <q-item-section>
              <q-select dense filled v-model="obs.screenshotOptions.imageFormat" :options="obs.data.supportedImageFormats" />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section side><q-icon name="weight" /></q-item-section>
            <q-item-section>
              ~{{ _.round(obs.program_img.length *.75 / 1024, 1) }} Ko
            </q-item-section>
          </q-item>
          <q-item clickable @click="obs.restaureScreenshotOptions">
            <q-item-section side><q-icon name="restart_alt" /></q-item-section>
            <q-item-section>
              Restore defaults
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <!-- Studio mode -->
      <q-btn class="col-auto" :flat="!obs.data.studioModeEnabled" icon="sym_o_splitscreen_right" color="secondary"
        :text-color="obs.data.studioModeEnabled ? 'dark' : 'secondary'"
        @click="obs.setStudioMode(!obs.data.studioModeEnabled)">
        <h-tooltip>Studio Mode</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <!-- Start recording -->
      <q-btn :flat="!obs.data.record?.outputActive" class="col-auto" icon="sym_o_screen_record" color="negative"
        @click="obs.setRecordingState(!obs.data.record?.outputActive)"  >
        <h-tooltip v-if="obs.data.record?.outputActive">Stop recording</h-tooltip>
        <h-tooltip v-else>Start recording</h-tooltip>
      </q-btn>
      <!-- Start streaming -->
      <q-btn :flat="!obs.data.stream?.outputActive" class="col-auto" icon="live_tv"
        @click="obs.setStreamState(!obs.data.stream?.outputActive)" color="negative" >
        <h-tooltip v-if="obs.data.stream?.outputActive">Stop streaming</h-tooltip>
        <h-tooltip v-else>Start streaming</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <!-- Profiles and scenes collections -->
      <q-select filled dense class="col-auto" :options="obs.data.profiles" label="Profiles"
      :model-value="obs.data.currentProfileName" @update:model-value="value => obs.setProfile(value)" />
      <q-select filled dense class="col-auto" :options="obs.data.sceneCollections" label="Collections"
      :model-value="obs.data.currentSceneCollectionName" @update:model-value="value => obs.setSceneCollection(value)" />
      <q-separator vertical />
      <!-- Disconnect -->
      <q-btn flat class="col-auto" icon="power_off" @click="obs.disconnect()" color="negative" >
        <h-tooltip>Disconnect</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <!-- Browser source -->
      <q-btn-dropdown split class="col-auto" :flat="!obs.data.botCreated" icon="public" color="primary"
        menu-anchor="bottom middle" menu-self="top middle" :text-color="obs.data.botCreated ? 'dark' : ''"
        @click="!obs.data.botCreated ? obs.createOSCBotBrowserSource(peer.source_url) : obs.removeOSCBotBrowserSource()">
        <template v-slot:label>
          <q-badge :color="peer.connected ? 'green' : 'red'" floating />
          <h-tooltip v-if="obs.data.botCreated">Hirondelle browser source (active)</h-tooltip>
          <h-tooltip v-else>Hirondelle browser source (inactive, click to create)</h-tooltip>
        </template>
        <div class="col-12 row items-center" style="max-width: 500px;">
          <q-card class="col-12">
            <q-card-section class="bg-secondary text-dark">Hirondelle browser source</q-card-section>
            <q-card-section class="row items-center">
              <p class="col-12">
                We can create an Hirondelle browser source in OBS that allows you to do stuff like playing sounds,
                showing images, etc.
              </p>
              <p class="col-12">
                You can either create it manually on the scenes you want, using this URL:
              </p>
              <q-input class="col-12 q-pb-md" readonly v-model="peer.source_url" filled dense >
                <template v-slot:append>
                  <q-btn @click="peer.copyURL" icon="content_copy"/>
                </template>
              </q-input>
              <p class="col-12">
                Or you can create it automatically on every active scenes and don't worry about it:
              </p>
              <div class="col-12 text-center">

                <q-btn v-if="!obs.data.botCreated" class="col-auto"
                :disable="!obs.connected" @click="obs.createOSCBotBrowserSource(peer.source_url)"
                label="Create on all scenes" color="positive"/>
                <q-btn v-else class="col-auto" :disable="!obs.connected" @click="obs.removeOSCBotBrowserSource()"
                label="Remove" color="negative"/>
              </div>

              <div class="col-12 q-mt-md text-center" v-if="obs.data.botCreated" >
                  <p>Connection status: <q-icon name="circle" size="md" :color="peer.connected ? 'green' : 'red'"/></p>
                  <q-btn class="" label="Send test data" @click="peer.send(12)" />
              </div>
            </q-card-section>
            <q-card-section>
            </q-card-section>
          </q-card>
        </div>
      </q-btn-dropdown>
      <q-separator vertical />
      <!-- Infos -->
      <div class="col-auto column text-caption" v-if="!_.isEmpty(obs.data.record) && !_.isEmpty(obs.data.stream)">
        <span :class="obs.data.record.outputActive ? 'text-red' : ''">REC: {{ obs.data.record.outputTimecode.substring(0,8) }}</span>
        <span :class="obs.data.stream.outputActive ? 'text-red' : ''">LIVE: {{ obs.data.stream.outputTimecode.substring(0,8) }}</span>
      </div>
      <div class="col-auto column text-caption">
        <span>FPS: {{ _.round(obs.data.activeFps, 2) }}</span>
        <span style="min-width: 80px">CPU: {{ _.round(obs.data.cpuUsage, 1) }}%</span>
      </div>
    </div>
    <!-- SCENES -->
    <div class="col-12 q-my-md text-center" v-if="obs.connected">
      <q-btn flat icon="settings" color="primary" class="float-right">
        <q-menu><q-list separator>
          <q-item>
            <q-item-section>Icon only</q-item-section>
            <q-item-section side>
                <q-toggle v-model="scenesIconOnly" />
            </q-item-section>
          </q-item>
          <q-item class="row">
            <q-input class="col-8" v-model="filter_scenes" borderless dense clearable placeholder="filter" />
              <q-icon class="col-2" name="image" size="sm" />
              <q-toggle class="col-2" size="xs" :model-value="scenesVisibility"
              @update:model-value="v => toggleScenesVisibility(v)">
                <h-tooltip>Toggle all visibility</h-tooltip>
              </q-toggle>
          </q-item>
          <q-item v-for="s in obs.data.scenes.filter(s => !filter_scenes || s.sceneName.includes(filter_scenes))" :key="s.sceneIndex"
            class="row">
            <span :class="`col-8 ${scenesHide.includes(s.sceneName) ? 'text-grey' : ''}`">{{ s.sceneName }}</span>
            <q-item-section side>
              <q-btn flat :icon="scenesIcon[s.sceneName] || 'add_circle'"
                :color="scenesIcon[s.sceneName] ? 'white' : 'grey-8'" >
                <q-popup-proxy>
                  <div style="max-width: 520px;" class="row q-pa-md"  >
                    <div class="col-12 row items-center">
                      <q-icon name="search" size="sm" class="q-pa-sm"/>
                      <q-input class="col" v-model="icons.filter"
                      borderless dense clearable placeholder="filter" icon="search" />
                    </div>
                    <q-btn flat icon="clear" size="lg" class="q-pa-md" color="negative"
                    @click.stop="delete scenesIcon[s.sceneName]" v-close-popup
                    />
                    <q-btn v-for="i in icons.icons" :key="i"
                      flat :icon="i" size="lg" class="q-pa-md"
                      @click.stop="scenesIcon[s.sceneName] = i" v-close-popup
                      :color="scenesIcon[s.sceneName] == i ? 'accent' : ''"
                      />
                  </div>
                </q-popup-proxy>
              </q-btn></q-item-section>
            <q-item-section side>
              <q-toggle size="sm" :model-value="!scenesHide.includes(s.sceneName)"
                @update:model-value="scenesHide = _.xor(scenesHide, [s.sceneName])"/>
            </q-item-section>
          </q-item>
        </q-list></q-menu>
      </q-btn>
      <template v-if="!scenesIconOnly" >
        <q-chip square v-for="s in scenesFiltered" :key="s.sceneIndex" :label="s.sceneName" clickable
        :color="s.program ? 'green-9' : s.preview ? 'blue-9' : 'grey-9'"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenesIcon[s.sceneName]" />
      </template>
      <template v-else >
        <q-btn v-for="s in scenesFiltered" :key="s.sceneIndex" size="xl"
        class="q-ma-sm"
        :color="s.program ? 'green' : s.preview ? 'blue' : 'grey-9'"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenesIcon[s.sceneName] || 'image'" />
      </template>
    </div>

    <!-- Screenshots -->
    <div v-if="obs.data.studioModeEnabled" class="col-12 row items-center">
      <q-img class="col-xs-12 col-md" :src="obs.preview_img" no-transition />
      <div class="col-xs-12 col-md-auto text-center row justify-center">
        <!-- <q-btn v-for="t in obs.currentSceneTransitions.transitions" :key="t.transitionName"
          :label="t.transitionName" @click="obs.TriggerStudioModeTransition(t.transitionName)"/> -->
          <q-space />
          <q-btn class="col-auto col-md-12" flat color="primary" :icon="$q.screen.gt.sm ? 'switch_left' : 'unfold_more'"
            @click="obs.TriggerStudioModeTransition(swapScenes)">
            <h-tooltip>Transition</h-tooltip>
          </q-btn>
          <q-space />
          <q-btn class="col-auto col-md-12" flat icon="cameraswitch" :text-color="swapScenes ? 'secondary' : 'cream'"
            @click="swapScenes = !swapScenes">
            <h-tooltip>Swap preview/program scene after transitionning</h-tooltip>
          </q-btn>
      </div>
      <q-img class="col-xs-12 col-md" :src="obs.program_img" no-transition />
    </div>
    <div v-else class="col-12 row justify-around">
      <q-img class="col-xs-12 col-md-12" :src="obs.program_img" no-transition />
    </div>

    <!-- Custom actions -->
    <div class="col-12 text-center q-mt-xl" v-if="H.graph.nodes.length">
      <q-btn-dropdown icon="add_circle" flat color="secondary" class="float-left">
        <template v-slot:label>
          <h-tooltip>Add custom action from node editor</h-tooltip>
        </template>
        <q-list dense>
          <q-item>
            <q-input dense v-model="filterActions" placeholder="Search" />
          </q-item>
          <q-item v-for="(action, i) in actionsList" :key="`${i}:${action.name}`" clickable
            @click="actions.push(action)">
            <q-item-section>
              <q-item-label>
                {{ getNodeTitle(action.nodeId) }}
                <span v-if="action.slot || action.signal"> > {{ action.slot || action.signal }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle :model-value="actions.find(a => a.nodeId == action.nodeId && a.slot == action.slot && a.signal == action.signal) != undefined"
                @update:model-value="val => val ? actions.push(action) : actions = actions.filter(a => a.nodeId != action.nodeId || a.slot != action.slot || a.signal != action.signal)"/>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-btn v-for="(action, i) in actions" :key="`${i}:${action.name}`" :label="action.name"
        @click="runAction(action)" class="q-ma-sm bg-primary text-dark"/>
    </div>

  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted, toRef } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'
import { useIcons } from 'stores/material_icons'
import _ from 'lodash'
import { usePeer } from 'stores/peer'
import { useSettings } from 'stores/settings'
import { useHirondelle } from "src/hirondelle/hirondelle.js"

const obs = useOBS()
const $q = useQuasar()
const peer = usePeer()
const icons = useIcons()
const S = useSettings()
const H = useHirondelle()

// Tabs
const tab = ref("obs")

const ip = ref(S.get("obs.ip") || "localhost")
const port = ref(S.get("obs.port") || "4455")
const password = ref(S.get("obs.password") || "")

// Auto connect
if (ip.value && port.value && password.value)
  obs.connect(ip.value, port.value, password.value)

// Scenes
const scenesHide = ref(S.get("obs.scenes.hidden") || [])
const scenesIcon = ref(S.get("obs.scenes.icons") || {})
const scenesIconOnly = ref(S.get("obs.scenes.iconsOnly") || false)
const swapScenes = ref(S.get("obs.scenes.swap") || false)
const scenesFiltered = computed(() => obs.data.scenes.filter(s => !scenesHide.value.includes(s.sceneName)))
const scenesVisibility = computed(() => {
  var all = _.uniq(obs.data.scenes.map(s => !scenesHide.value.includes(s.sceneName)))
  if (all.length == 1) return all[0]
  else return undefined
})
const toggleScenesVisibility = val => {
  console.log(val)
  if (val) scenesHide.value = []
  else scenesHide.value = obs.data.scenes.map(s => s.sceneName)
}

watch(scenesHide, () => S.set("obs.scenes.hidden", scenesHide.value))
watch(scenesIcon, () => S.set("obs.scenes.icons", scenesIcon.value), { deep: true })
watch(scenesIconOnly, () => S.set("obs.scenes.iconsOnly", scenesIconOnly.value))
watch(swapScenes, () => S.set("obs.scenes.swap", swapScenes.value))

const filter_scenes = ref("")

// Custom actions
const actions = ref(S.get("obs.actions") || [])
const filterActions = ref("")
const actionsList = computed(() => {
  var _actions = []
  H.graph.flatNodes()
  .filter(n => (n.title || n.type.title).includes(filterActions.value))
  .sort((n1, n2) => (actions.value.find(a => a.nodeId == n2.id) == undefined ? -1 : 1) - (actions.value.find(a => a.nodeId == n1.id) == undefined ? -1 : 1))
  .forEach(n => {
    var title = n.title || n.type.title
    if (n.type.accepts_input && n.type.action) _actions.push({
      name: title,
      type: "slot",
      nodeId: n.id
    })
    _.forEach(n.type.slots, (s, name) => _actions.push({
      name: `${title} > ${name}`,
      type: "slot",
      slot: name,
      nodeId: n.id
    }))
    _.forEach(n.type.signals, (s, name) => _actions.push({
      name: `${title} > ${name}`,
      type: "signal",
      signal: name,
      nodeId: n.id
    }))
  })
  return _actions
})
const getNodeTitle = nodeId => H.graph.findNode(nodeId).title || H.graph.findNode(nodeId).type.title
const runAction = action => {
  var node = H.graph.findNode(action.nodeId)
  if (action.slot) node.start(action.slot)
  else if (action.signal) node.emit(action.signal)
  else node.start()
}
watch(actions, () => S.set("obs.actions", actions.value))

// Peer
const connected = computed(() => peer.connected)

</script>
