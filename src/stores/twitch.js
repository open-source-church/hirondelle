import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _, { join } from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard, uid } from 'quasar'
import { StaticAuthProvider, getTokenInfo } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { EventSubWsListener } from '@twurple/eventsub-ws'
import { ChatClient } from '@twurple/chat'
import { useSettings } from './settings'

// import { useRouter } from 'vue-router'

const client_id = process.env.CLIENT_ID
// const access_token = process.env.ACCESS_TOKEN

export const useTwitch = defineStore('twitch', () => {

  const $q = useQuasar()
  const S = useSettings()
  // const router = useRouter()

  const access_token = ref(S.get("twitch.access_token") || "")
  const state = ref(S.get("twitch.state") || uid())

  /*
    AUTH
  */
  const logout = async () => {
    access_token.value = ""
    console.log("LOGOUT")
    authProvider = null
    apiClient = null
    await chatClient.quit()
    chat_connected.value = false
    chatClient = null
    await eventsub.stop()
    eventsub = null
    user.value = null
  }
  const login = () => {
    var scope = [
      "bits:read",
      "chat:read", "chat:edit",
      "channel:read:redemptions", "channel:manage:redemptions",
      "user:read:follows",
      "channel:read:subscriptions",
      "channel:read:polls", "channel:manage:polls",
      "moderator:read:chatters", "moderator:read:followers"
    ]
    var params = {
      client_id,
      redirect_uri: window.location.origin,
      response_type: "token",
      scope: scope.join(" "),
      state: state.value
    }
    var endpoint = "https://id.twitch.tv/oauth2/authorize?"
    var url = endpoint + Object.entries(params).map(kv => kv.map(encodeURIComponent).join("=")).join("&")
    // Save state
    S.set("twitch.state", state.value)
    // Save path for redirection
    S.set("twitch.redirect", window.location.pathname)
    // Redirect
    window.location.href = url
  }

  watch(access_token, () => S.set("twitch.access_token", access_token.value))

  var authProvider
  var apiClient
  var chatClient
  var eventsub
  var user = ref()
  var chat_connected = ref(false)

  watch(access_token, async () => {
    // Ca vaut même pas la peine d'essayer
    if (!access_token.value) return

    authProvider = new StaticAuthProvider(client_id, access_token.value)
    console.log("AUTH PROVIDER", authProvider)

    apiClient = new ApiClient({ authProvider })
    console.log("API CLIENT", apiClient)
    // console.log("USER ID", authProvider._userId)
    // console.log(user.value)
    try {
      var token_info = await getTokenInfo(access_token.value, client_id)
      user.value = await apiClient.users.getUserById(token_info.userId)
      console.log("USER", user.value)
    } catch (error) {
      console.error(error)
      return
    }

    chatClient = new ChatClient(
      { authProvider,
        channels: ['opensourcechurch'],
        // requestMembershipEvents: true
      });
    chatClient.connect()
    chatClient.onConnect(() => chat_connected.value = true)
    chatClient.onDisconnect(() => chat_connected.value = false)
    chatClient.onMessage((channel, user, text, msg) => console.log("MESSAGE", channel, user, text, msg))
    chatClient.onAnnouncement((channel, user, announcementInfo, msg) => console.log("ACCOUNCEMENT", channel, user, announcementInfo, msg))
    // chatClient.onSub((channel, user, subInfo, msg) => console.log("SUB", channel, user, subInfo, msg))
    // chatClient.onCommunitySub((channel, user, subInfo, msg) => console.log("COMMUNITY SUB", channel, user, subInfo, msg))
    // chatClient.onResub((channel, user, subInfo, msg) => console.log("RESUB", channel, user, subInfo, msg))
    // chatClient.onJoin((channel, user) => console.log("JOIN", channel, user))
    // chatClient.onRaid((channel, user, raidInfo, msg) => console.log("RAID", channel, user, raidInfo, msg))
    console.log("CHAT CLIENT", chatClient)

    // EventSub

    eventsub = new EventSubWsListener({ apiClient })
    eventsub.start()
    // eventsub.onRevoke(sub => subscriptions.value[sub.])
    eventsub.onUserSocketConnect(ev => console.log("CONNECT", ev))
    eventsub.onUserSocketDisconnect(ev => console.log("DISCONNECT", ev))
    eventsub.onChannelRedemptionAdd(user.value, event => console.log("REDEMPTION", event))
    eventsub.onChannelPollBegin(user.value, event => console.log("POLL BEGIN", event))
    eventsub.onChannelRewardUpdate(user.value, get_rewards)

    // Rewards si le user est au moins affilié
    if(user.value.broadcasterType)
      get_rewards()

  }, { immediate: true })

  const rewards = ref([])
  const get_rewards = async () => {
    // Get all rewards
    rewards.value = await apiClient.channelPoints.getCustomRewards(user.value)
    // Get those that are managable by the api
    var managable = await apiClient.channelPoints.getCustomRewards(user.value, true)
    managable.forEach(r => rewards.value.find(_r => _r.id == r.id).isManagable = true)
  }
  const reward_set_enabled = async (id, enabled = true) => {
    await apiClient.channelPoints.updateCustomReward(user.value, id, { isEnabled: enabled })
  }

  return {
    access_token, state,
    login, logout,
    chat_connected,
    user,
    rewards, reward_set_enabled,
    apiClient
  }

})
