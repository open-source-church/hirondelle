<template>
  <div class="row" v-if="!obs.connected">
    <q-input class="col-10" v-model="ip" label="IP" />
    <q-input class="col-2" v-model="port" label="port" />

    <q-input class="col-12" v-model="password" type="password" label = "password" />
    <q-btn class="col-12 q-mt-md" icon="power" @click="obs.connect(ip, port, password)" label="Connect" color="primary" text-color="dark"/>

    <q-banner class="text-info">
      <template v-slot:avatar > <q-icon name="info"  /> </template>
      <p>Démarrer le serveur dans OBS: <b>Outils > Paramètres de serveur Websocket</b> et renseigner ici les mêmes info.</p>
      <p>Aucune de ces infos ne sortent de votre navigateur, la connection se fait directement avec OBS dans votre réseau local.</p>
    </q-banner>
  </div>
  <div class="row" v-else >
    <!-- Toolbar -->
    <div class="col-12 row q-gutter-sm items-center">
      <!-- Preview and settings -->
      <q-btn-dropdown split :flat="!obs.preview" icon="preview" color="accent" @click="obs.preview = !obs.preview">
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
              ~{{ _.round(obs.preview_img.length *.75 / 1024, 1) }} Ko
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
      <q-btn :flat="!obs.data.studioModeEnabled" icon="sym_o_splitscreen_right" color="secondary"
        :text-color="obs.data.studioModeEnabled ? 'dark' : 'secondary'"
        @click="obs.setStudioMode(!obs.data.studioModeEnabled)">
        <h-tooltip>Studio Mode</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <q-btn :flat="!obs.data.record.outputActive" class="col-auto" icon="sym_o_screen_record" color="negative"
        @click="obs.setRecordingState(!obs.data.record.outputActive)"  >
        <h-tooltip v-if="obs.data.record.outputActive">Stop recording</h-tooltip>
        <h-tooltip v-else>Start recording</h-tooltip>
      </q-btn>
      <q-btn :flat="!obs.data.stream.outputActive" class="col-auto" icon="live_tv"
        @click="obs.setStreamState(!obs.data.stream.outputActive)" color="negative" >
        <h-tooltip v-if="obs.data.stream.outputActive">Stop streaming</h-tooltip>
        <h-tooltip v-else>Start streaming</h-tooltip>
      </q-btn>
      <q-separator vertical />
      <q-select filled dense class="col" :options="obs.data.profiles" label="Profiles"
      :model-value="obs.data.currentProfileName" @update:model-value="value => obs.setProfile(value)" />
      <q-select filled dense class="col" :options="obs.data.sceneCollections" label="Collections"
      :model-value="obs.data.currentSceneCollectionName" @update:model-value="value => obs.setSceneCollection(value)" />
      <q-separator vertical />
      <q-btn class="col-auto" icon="power_off" @click="obs.disconnect()" color="negative" />
      <q-separator vertical />
      <div class="col-auto column text-caption">
        <span :class="obs.data.record.outputActive ? 'text-red' : ''">REC: {{ obs.data.record.outputTimecode.substring(0,8) }}</span>
        <span :class="obs.data.stream.outputActive ? 'text-red' : ''">LIVE: {{ obs.data.stream.outputTimecode.substring(0,8) }}</span>
      </div>
      <div class="col-auto column text-caption">
        <span>FPS: {{ _.round(obs.data.activeFps, 2) }}</span>
        <span>CPU: {{ _.round(obs.data.cpuUsage, 1) }}%</span>
      </div>
    </div>
    <!-- SCENES -->
    <div class="col-12 q-my-md text-center" v-if="obs.connected">
      <q-btn flat icon="settings" color="primary" class="float-right">
        <q-menu><q-list separator>
          <q-item>
            <q-item-section>
              Icon only
            </q-item-section>
            <q-item-section side>
                <q-toggle v-model="scenes_icon_only" />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-input v-model="filter_scenes" borderless dense clearable placeholder="filter" />
            </q-item-section>
            <q-item-section side>
                <q-icon name="visibility" />
            </q-item-section>
            <q-item-section side>
                <q-icon name="image" />
            </q-item-section>
          </q-item>
          <q-item v-for="s in obs.data.scenes.filter(s => !filter_scenes || s.sceneName.includes(filter_scenes))" :key="s.sceneIndex">
            <q-item-section>{{ s.sceneName }}</q-item-section>
            <q-item-section side>
              <q-toggle size="xs" :model-value="!scenes_hide.includes(s.sceneName)"
                @update:model-value="scenes_hide = _.xor(scenes_hide, [s.sceneName])"/>
            </q-item-section>
            <q-item-section side>
              <q-btn flat :icon="scenes_icon[s.sceneName] || 'add_circle'"
                :color="scenes_icon[s.sceneName] ? 'white' : 'grey-8'" >
                <q-popup-proxy>
                  <div style="max-width: 520px;" class="row q-pa-md"  >
                    <div class="col-12 row items-center">
                      <q-icon name="search" size="sm" class="q-pa-sm"/>
                      <q-input class="col" v-model="icons.filter"
                      borderless dense clearable placeholder="filter" icon="search" />
                    </div>
                    <q-btn flat icon="clear" size="lg" class="q-pa-md" color="negative"
                    @click.stop="delete scenes_icon[s.sceneName]" v-close-popup
                    />
                    <q-btn v-for="i in icons.icons" :key="i"
                      flat :icon="i" size="lg" class="q-pa-md"
                      @click.stop="scenes_icon[s.sceneName] = i" v-close-popup
                      :color="scenes_icon[s.sceneName] == i ? 'accent' : ''"
                      />
                  </div>
                </q-popup-proxy>
              </q-btn></q-item-section>
          </q-item>
        </q-list></q-menu>
      </q-btn>
      <template v-if="!scenes_icon_only" >
        <q-chip square v-for="s in scenes_filtered" :key="s.sceneIndex" :label="s.sceneName" clickable
        :color="s.program ? 'green-9' : s.preview ? 'blue-9' : 'grey-9'"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenes_icon[s.sceneName]" />
      </template>
      <template v-else >
        <q-btn v-for="s in scenes_filtered" :key="s.sceneIndex" size="xl"
        :color="s.program ? 'green' : s.preview ? 'blue' : ''"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenes_icon[s.sceneName] || 'image'" />
      </template>

    </div>

    <!-- Screenshots -->
    <div v-if="obs.data.studioModeEnabled" class="col-12 row">
      <q-img class="col-xs-12 col-md-6" :src="obs.preview_img" no-transition />
      <q-img class="col-xs-12 col-md-6" :src="obs.program_img" no-transition />
    </div>
    <div v-else class="col-12 row justify-around">
      <q-img class="col-xs-12 col-md-6" :src="obs.program_img" no-transition />
    </div>

    <!-- Browser source -->
    <div class="col-12 row items-center q-my-lg">
      <q-card class="col-12">
        <q-card-section class="bg-secondary text-dark">Source navigateur</q-card-section>
        <q-card-section class="row items-center">
          <p class="col-12">On peut créer une source navigateur dans OBS qui permet d'afficher des choses.</p>
          <q-input class="col-12 q-pa-md" readonly v-model="peer.source_url" filled dense >
            <template v-slot:append>
              <q-btn @click="peer.copyURL" icon="content_copy"/>
            </template>
          </q-input>
          <q-btn v-if="!obs.data.botCreated" class="col-auto"
            :disable="!obs.connected" @click="obs.createOSCBotBrowserSource(peer.source_url)"
            label="Créer automatiquement sur toutes les scènes" color="positive"/>
          <q-btn v-else class="col-auto" :disable="!obs.connected" @click="obs.removeOSCBotBrowserSource()"
          label="Supprimer" color="negative"/>
          <div class="col-auto q-ml-md">
              Connection status: <q-icon name="circle" size="md" :color="peer.connected ? 'green' : 'red'"/>
              <q-btn label="Send test data" @click="peer.send(12)" />
          </div>
          Connection: {{ peer.conn.peer }}
        </q-card-section>
        <q-card-section>
        </q-card-section>
      </q-card>
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
const scenes_hide = ref(S.get("obs.scenes.hidden") || [])
const scenes_icon = ref(S.get("obs.scenes.icons") || {})
const scenes_icon_only = ref(false)

const scenes_filtered = computed(() => obs.data.scenes.filter(s => !scenes_hide.value.includes(s.sceneName)))

watch(scenes_hide, () => S.set("obs.scenes.hidden", scenes_hide.value))
watch(scenes_icon, () => S.set("obs.scenes.icons", scenes_icon.value), { deep: true })

const filter_scenes = ref("")


// Actions
const connected = computed(() => peer.connected)

</script>
