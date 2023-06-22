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
      <div v-else>
        <q-btn label="Login Twitch" icon="login" @click="twitch.login()" color="primary" text-color="dark"/>
      </div>
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
      <div class="col-6">
        <q-card class="q-ma-md">
          <q-card-section class="bg-secondary text-dark text-subtitle1">Info</q-card-section>
          <q-card-section class="q-pa-none">
            <q-tabs v-model="tab_info">
              <q-tab name="chatters" label="Chatters" >
                <q-badge v-if="chatters.total" floating color="accent">{{ chatters.total }}</q-badge>
              </q-tab>
            </q-tabs>
          </q-card-section>
          <q-card-section>
            <q-btn flat icon="refresh" @click="get_chatters" class="float-right" color="accent"/>
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

// Tabs
const tab_info = ref("chatters")

// Chatters
const chatters = ref({})
const get_chatters = async () => {
  chatters.value = await twitch.apiClient.chat.getChatters(twitch.user, twitch.user)
  console.log(chatters.value)
}
const user_info = ref({})
const get_user_info = async (userId) => {
  user_info.value = await twitch.apiClient.users.getUserById(userId)
  // user_info.value = await twitch.apiClient.channels.getChannelFollowers(twitch.user, twitch.user, userId)
  console.log(user_info.value)
  console.log(user_info.value)
}

</script>
