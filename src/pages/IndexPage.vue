<template>
  <q-page >
    <div class="row">
      <q-input class="col-10" v-model="ip" label="URL" />
      <q-input class="col-2" v-model="port" label="port" />

      <q-input class="col-12" v-model="password" type="password" label = "password" />
      <q-btn class="col-6" :disable="obs.connected" @click="obs.connect(url, password)" label="Connect" color="primary"/>
      <q-btn class="col-6" :disable="!obs.connected" @click="obs.disconnect()" label="Disconnect" color="secondary"/>

      <div class="col-12 row q-gutter-md items-center">
        <q-icon name="circle" size="sm" :color="obs.connected ? 'green' : 'red'"/>
        <!-- <q-checkbox :model-value="obs.connected" label="Connecté"/> -->
        <q-checkbox v-model="obs.preview" label="Preview"/>
        <q-checkbox :model-value="obs.data.studioModeEnabled" @update:model-value="obs.setStudioMode(!obs.data.studioModeEnabled)" label="Studio"/>
        <q-select dense class="col" :options="obs.data.profiles" label="Profiles"
          :model-value="obs.data.currentProfileName" @update:model-value="value => obs.setProfile(value)" />
        <q-select dense class="col" :options="obs.data.sceneCollections" label="Collections"
          :model-value="obs.data.currentSceneCollectionName" @update:model-value="value => obs.setSceneCollection(value)" />
      </div>

      <!-- SCENES -->
      <div class="col-12 row items-start" v-if="obs.connected">
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
          <q-chip v-for="s in scenes_filtered" :key="s.sceneIndex" :label="s.sceneName" clickable
          :color="s.program ? 'green' : s.preview ? 'blue' : ''"
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

      <div class="col-12 row">
        <q-img class="col" :src="obs.preview_img" no-transition v-if="obs.data.studioModeEnabled" />
        <q-img class="col" :src="obs.program_img" no-transition />
      </div>

      <div class="col-12 row">
      </div>

      <div class="col-12 row items-center q-gutter-md">
        <div class="col-auto q-pa-md">
          Browser source in OBS to:
        </div>
        <q-input class="col" readonly v-model="peer.source_url" filled dense >
          <template v-slot:append>
            <q-btn @click="peer.copyURL" icon="content_copy"/>
          </template>
        </q-input>
        <q-btn v-if="!obs.data.botCreated" class="col-auto" :disable="!obs.connected" @click="obs.createOSCBotBrowserSource(peer.source_url)"
        label="Create" color="positive"/>
        <q-btn v-else class="col-auto" :disable="!obs.connected" @click="obs.removeOSCBotBrowserSource()"
        label="Remove" color="negative"/>
      </div>
      <div v-if="obs.data.botCreated">
        Connection status: <q-icon name="circle" size="md" :color="peer.connected ? 'green' : 'red'"/>
        <q-btn label="Send data" @click="peer.send" />
      </div>
      <div class="col-12">
        {{ twitch.access_token }} // {{ twitch.state }}
        <q-btn label="Login Twitch" icon="login" @click="twitch.login()" color="primary"/>
        <q-icon name="circle" size="sm" :color="twitch.chat_connected ? 'green' : 'red'"/> Connecté au chat
        <hr />
        <div v-if="twitch.user">
          Connecté en tant que: {{ twitch.user.name }}
          <q-avatar >
            <img :src="twitch.user.profilePictureUrl" />
          </q-avatar>
        </div>
        <q-list>
          <q-item v-for="r in twitch.rewards" :key="r.id" :disable="!r.isManagable">
            <q-item-section avatar>
              <q-img :src="r.getImageUrl(1)" />
            </q-item-section>
            <q-item-section>
              <q-item-label><q-badge>{{ r.cost }}</q-badge> {{ r.title }} </q-item-label>
              <q-item-label caption>{{ r.prompt }}</q-item-label>
            </q-item-section>
            <q-item-section>
              <q-checkbox label="active" :model-value="r.isEnabled"
                v-on:update:model-value="twitch.reward_set_enabled(r.id, !r.isEnabled)" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useOBS } from 'stores/obs'
import { useQuasar, copyToClipboard } from 'quasar'
import { usePeer } from 'stores/peer'
import { useIcons } from 'stores/material_icons'
import { useTwitch } from 'stores/twitch'
import _ from 'lodash'

const obs = useOBS()
const $q = useQuasar()
const peer = usePeer()
const icons = useIcons()
const twitch = useTwitch()

const ip = ref("192.168.1.56")
const port = ref("4455")
const password = ref("testing")

const url = computed(() => `ws://${ip.value}:${port.value}`)

const scenes_hide = ref($q.localStorage.getItem("scenes_hidden") || [])
const scenes_icon = ref($q.localStorage.getItem("scenes_icons") || {})
const scenes_icon_only = ref(false)

const scenes_filtered = computed(() => obs.data.scenes.filter(s => !scenes_hide.value.includes(s.sceneName)))

watch(scenes_hide, () => $q.localStorage.set("scenes_hidden", scenes_hide.value))
watch(scenes_icon, () => $q.localStorage.set("scenes_icons", scenes_icon.value), { deep: true })

const filter_scenes = ref("")

</script>
