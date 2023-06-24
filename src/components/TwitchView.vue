<template>
  <div class="row">
    <div class="col-12 row">
      <div v-if="twitch.user" class="col-12 row items-center justify-center">
        Connecté en tant que:
        <q-chip class="bg-grey-9">
          <q-avatar size="32px">
            <img :src="twitch.user.profilePictureUrl" />
          </q-avatar>
          {{ twitch.user.name }}
        </q-chip>
        <q-btn label="Logout" icon="power_off" flat color="negative" @click="twitch.logout"/>
      </div>
      <div v-else class="col-12 row justify-center q-gutter-md">
        <q-btn label="Login Twitch" icon="login" @click="twitch.login()" color="secondary" text-color="dark" />
        <q-btn flat label="Access token" icon="content_paste" @click="twitch.login_with_access_token()" color="secondary">
          <q-popup-proxy>
            <div class="q-pa-md row q-gutter-md justify-center">
              <q-input class="col-12" v-model="token" label="Access Token" />
              <q-input class="col-12" v-model="client_id" label="Client ID" />
              <q-btn class="col-auto" icon="check" @click="twitch.login_with_access_token(token, client_id)" color="accent"/>
            </div>
          </q-popup-proxy>
        </q-btn>
      </div>
    </div>
    <div class="col-12 row" v-if="twitch.user">
      <!-- Rewards -->
      <div class="col-6">
        <q-card class="q-ma-md">
          <q-card-section class="bg-secondary text-dark text-subtitle1">Rewards</q-card-section>
          <q-card-section>
            <q-list>
              <q-item v-for="r in twitch.rewards" :key="r.id" :disable="!r.isManagable">
                <q-item-section avatar>
                  <q-img :src="r.getImageUrl(1)" />
                </q-item-section>
                <q-item-section>
                  <q-item-label><q-badge color="accent">{{ r.cost }}</q-badge> {{ r.title }} </q-item-label>
                  <q-item-label caption>{{ r.prompt }}</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-checkbox label="active" :model-value="r.isEnabled"
                    v-on:update:model-value="twitch.reward_set_enabled(r.id, !r.isEnabled)" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
      <!-- Chat client -->
      <div class="col-6">
        <q-card class="q-ma-md">
          <q-card-section class="bg-secondary text-dark text-subtitle1">
            Chat <span v-if="twitch.channel_name">
              <q-chip square class="bg-primary text-dark" >{{ twitch.channel_name }}</q-chip>
              <q-btn flat size="sm" color="accent" icon="edit" >
                <q-popup-proxy>
                  <div class="q-pa-md row q-gutter-md justify-center">
                    <q-input class="col-12" v-model="channel" label="Chaîne à rejoindre" />
                    <q-btn class="col-auto" icon="check" color="accent"
                      @click="twitch.channel_name = channel" v-close-popup/>
                  </div>
                </q-popup-proxy>
              </q-btn>
            </span>
          </q-card-section>
          <q-card-section class="q-pa-none">
            <q-tabs v-model="tab_info">
              <q-tab name="chatters" label="Chatters" >
                <q-badge v-if="chatters.total" floating color="accent">{{ chatters.total }}</q-badge>
              </q-tab>
            </q-tabs>
          </q-card-section>
          <q-card-section>
            <q-tab-panels v-model="tab_info">
              <q-tab-panel name="chatters">
                <q-list dense v-if="chatters.data">
                  <q-item clickable v-for="c in chatters.data" :key="c"
                    @click="get_user_info(c.userId)">
                    <q-item-section>{{ c.userDisplayName }}</q-item-section>
                  </q-item>
                </q-list>
              </q-tab-panel>
            </q-tab-panels>
            <q-btn flat icon="refresh" @click="get_chatters" class="absolute-top-right" color="accent"/>
          </q-card-section>
          <q-separator />
          <q-card-section v-if="user_info.id">
            <q-list dense>
              <q-item>
                <q-item-section avatar>
                  <q-avatar><img :src="user_info.profilePictureUrl" /></q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ user_info.displayName }}</q-item-label>
                  <q-item-label v-if="user_info.displayName != user_info.name" caption>({{ user_info.name }})</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="user_info.description">{{ user_info.description }}</q-item>
              <q-item v-if="user_info.broadcasterType">Broadcaster type: {{ user_info.broadcasterType }}</q-item>
              <q-item class="text-caption">Crée le: {{ user_info.creationDate }}</q-item>
              <q-item v-if="user_info.type">Type: {{ user_info.type }}</q-item>

            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import { usePeer } from 'stores/peer'
import { useIcons } from 'stores/material_icons'
import { useTwitch } from 'stores/twitch'
import _ from 'lodash'

const twitch = useTwitch()
const $q = useQuasar()

// Tabs
const tab_info = ref("chatters")

// Login
const token = ref("")
const client_id = ref("")
const channel = ref("")

// Chatters
const chatters = ref({})
const get_chatters = async () => {
  $q.loadingBar.start()
  try {
    chatters.value = await twitch.apiClient.chat.getChatters(twitch.channel || twitch.user, twitch.user)
  } catch (err) {
    $q.notify(err.message)
  }
  $q.loadingBar.stop()
  console.log(chatters.value)
}
const user_info = ref({})
const get_user_info = async (userId) => {
  $q.loadingBar.start()
  user_info.value = await twitch.apiClient.users.getUserById(userId)
  $q.loadingBar.stop()
  // user_info.value = await twitch.apiClient.channels.getChannelFollowers(twitch.user, twitch.user, userId)
  console.log(user_info.value)
}

</script>