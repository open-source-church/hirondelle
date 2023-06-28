<template>
  <q-item :disable="disable" >
    <q-item-section avatar>
      <q-img :src="reward.getImageUrl(1)" />
    </q-item-section>
    <q-item-section>
      <q-item-label>
        <q-badge color="accent">{{ reward.cost }}</q-badge>
        <q-icon v-if="reward.isPaused" name="pause" size="sm"/>
        {{ reward.title }}
      </q-item-label>
      <q-item-label caption>{{ reward.prompt }}</q-item-label>
    </q-item-section>
    <q-item-section side>
      <div class="row q-gutter-md">
        <q-btn v-if="reward.isManagable" flat dense icon="edit" @click="editing = true" />
        <q-btn v-if="reward.isManagable" flat dense icon="delete" color="negative" @click="remove" />
        <q-checkbox :model-value="reward.isEnabled"
        v-on:update:model-value="toggleEnabled()" />
      </div>
    </q-item-section>
  </q-item>
  <q-dialog v-model="editing">
      <q-card>
        <q-card-section>
          <div class="text-h6">Reward editing</div>
        </q-card-section>

        <q-card-section class="q-pt-none row q-col-gutter-md items-center ">
          <q-input class="col-10" dense filled label="Title" v-model="reward_editing.title" />
          <div class="col-2">
            <q-btn  :style="`background-color: ${reward_editing.backgroundColor}`" icon="edit" >
              <q-popup-proxy transition-show="scale" transition-hide="scale">
                <q-color v-model="reward_editing.backgroundColor" no-header default-view="palette" v-close-popup/>
              </q-popup-proxy>
            </q-btn>
          </div>
          <q-input class="col-4" dense filled label="Cost" v-model="reward_editing.cost" type="number" />
          <q-toggle class="col-4" label="Enabled" v-model="reward_editing.isEnabled" hint="" />
          <q-toggle class="col-4" label="Paused" v-model="reward_editing.isPaused" hint="" />
          <q-input class="col-12" dense filled label="Prompt" v-model="reward_editing.prompt" hint="The prompt shown to users when redeeming the reward."/>
          <q-toggle class="col-6" label="User Input" v-model="reward_editing.userInputRequired" hint="Whether the reward requires user input to be redeemed." />
          <q-toggle class="col-6" label="Auto Fulfill" v-model="reward_editing.autoFulfill" hint="Whether the redemption should automatically set its status to fulfilled." />
          <q-input class="col-4" dense filled label="Cooldown" v-model="reward_editing.globalCooldown" type="number" hint="The cooldown between two redemptions of the reward, in seconds. 0 or `null` means no cooldown." />
          <q-input class="col-4" dense filled label="Max per stream" v-model="reward_editing.maxRedemptionsPerStream" type="number" hint="The maximum number of redemptions of the reward per stream. 0 or `null` means no limit." />
          <q-input class="col-4" dense filled label="Max per user per stream" v-model="reward_editing.maxRedemptionsPerUserPerStream" type="number" hint="The maximum number of redemptions of the reward per stream for each user. 0 or `null` means no limit." />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useTwitch } from 'stores/twitch'
import { useQuasar } from 'quasar';

const T = useTwitch()
const $q = useQuasar()

const props = defineProps({
  reward: { type: Object, required: true },
  disable: { type: Boolean }
})

// Editing

const editing = ref(false)
const reward_editing = ref({})

watch(editing, val => {
  if (val) reward_editing.value = {
    title: props.reward.title,
    cost: props.reward.cost,
    isEnabled: props.reward.isEnabled,
    isPaused: props.reward.isPaused,
    autoFulfill: props.reward.autoFulfill,
    prompt: props.reward.prompt,
    userInputRequired: props.reward.userInputRequired,
    backgroundColor: props.reward.backgroundColor,
    globalCooldown: props.reward.globalCooldown,
    maxRedemptionsPerStream: props.reward.maxRedemptionsPerStream,
    maxRedemptionsPerUserPerStream: props.reward.maxRedemptionsPerUserPerStream,
  }
})

const save = async () => {
  $q.loadingBar.start()
  var r = await T.apiClient.channelPoints.updateCustomReward(T.user, props.reward.id, reward_editing.value )
  $q.loadingBar.stop()
  editing.value = false
}


// API Calls

const toggleEnabled = async () => {
  $q.loadingBar.start()
  var r = await T.apiClient.channelPoints.updateCustomReward(T.user, props.reward.id,
    { isEnabled: !props.reward.isEnabled }
  )
  $q.loadingBar.stop()
}


const remove = async () => {
  $q.loadingBar.start()
  $q.loading.show()
  var r = await T.apiClient.channelPoints.deleteCustomReward(T.user, props.reward.id)
  $q.loading.hide()
  $q.loadingBar.stop()
}


</script>

<style lang="scss">


</style>
