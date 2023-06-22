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
  <div class="row" v-else>
    <div class="col-12 row q-gutter-md items-center">
      <q-btn :flat="!obs.preview" label="Preview" color="accent" @click="obs.preview = !obs.preview"/>
      <q-btn :flat="!obs.data.studioModeEnabled" label="Studio" color="secondary"
        :text-color="obs.data.studioModeEnabled ? 'dark' : 'secondary'"
        @click="obs.setStudioMode(!obs.data.studioModeEnabled)"/>
      <q-select filled dense class="col" :options="obs.data.profiles" label="Profiles"
      :model-value="obs.data.currentProfileName" @update:model-value="value => obs.setProfile(value)" />
      <q-select filled dense class="col" :options="obs.data.sceneCollections" label="Collections"
      :model-value="obs.data.currentSceneCollectionName" @update:model-value="value => obs.setSceneCollection(value)" />
      <q-btn class="col-auto" icon="power_off" @click="obs.disconnect()" color="negative" />
    </div>

    <!-- SCENES -->
    <div class="col-12 row items-start q-my-md" v-if="obs.connected">
      <q-btn flat icon="settings" class="col-auto">
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
      <div v-if="!scenes_icon_only" class="col" >
        <q-chip square v-for="s in scenes_filtered" :key="s.sceneIndex" :label="s.sceneName" clickable
        :color="s.program ? 'green-9' : s.preview ? 'blue-9' : 'grey-9'"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenes_icon[s.sceneName]" />
      </div>
      <div v-else class="col">
        <q-btn v-for="s in scenes_filtered" :key="s.sceneIndex" size="xl"
        :color="s.program ? 'green' : s.preview ? 'blue' : ''"
        @click="obs.setPreviewScene(s.sceneName)"
        @dblclick="obs.setProgramScene(s.sceneName)"
        :icon="scenes_icon[s.sceneName] || 'image'" />
      </div>

    </div>

    <!-- Screenshots -->
    <div class="col-12 row" >
      <q-img class="col" :src="obs.preview_img" no-transition v-if="obs.data.studioModeEnabled" />
      <q-img class="col" :src="obs.program_img" no-transition />
    </div>

    <!-- Browser source -->
    <div class="col-12 row items-center q-my-lg">
      <q-card class="col-12">
        <q-card-section class="bg-secondary text-dark">Source navigateur</q-card-section>
        <q-card-section class="row items-center">
          <p class="col-12">On peut créer une source navigateur dans OBS qui permet d'afficher des choses.</p>
          <q-input v-if="false" class="col-12" readonly v-model="peer.source_url" filled dense >
            <template v-slot:append>
              <q-btn @click="peer.copyURL" icon="content_copy"/>
            </template>
          </q-input>
          <q-btn v-if="!obs.data.botCreated" class="col-auto" :disable="!obs.connected" @click="obs.createOSCBotBrowserSource(peer.source_url)"
          label="Créer" color="positive"/>
          <q-btn v-else class="col-auto" :disable="!obs.connected" @click="obs.removeOSCBotBrowserSource()"
          label="Supprimer" color="negative"/>
          <div v-if="obs.data.botCreated" class="col-auto q-ml-md">
              Connection status: <q-icon name="circle" size="md" :color="peer.connected ? 'green' : 'red'"/>
              <q-btn label="Send test data" @click="peer.send" />
          </div>
        </q-card-section>
        <q-card-section>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'
import { useIcons } from 'stores/material_icons'
import _ from 'lodash'
import { usePeer } from 'stores/peer'
import { useSettings } from 'stores/settings'

const obs = useOBS()
const $q = useQuasar()
const peer = usePeer()
const icons = useIcons()
const S = useSettings()

// Tabs
const tab = ref("obs")

const ip = ref(S.get("obs.ip") || "192.168.1.56")
const port = ref(S.get("obs.port") || "4455")
const password = ref(S.get("obs.password") || "password")

const scenes_hide = ref(S.get("scenes.hidden") || [])
const scenes_icon = ref(S.get("scenes.icons") || {})
const scenes_icon_only = ref(false)

const scenes_filtered = computed(() => obs.data.scenes.filter(s => !scenes_hide.value.includes(s.sceneName)))

watch(scenes_hide, () => S.set("scenes.hidden", scenes_hide.value))
watch(scenes_icon, () => S.set("scenes.icons", scenes_icon.value), { deep: true })

const filter_scenes = ref("")

</script>
