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
import { useActions } from './actions'
import { useHirondelle } from 'src/hirondelle/hirondelle.js'

// import { useRouter } from 'vue-router'

// Default clientId for osc bot
var CLIENT_ID = process.env.CLIENT_ID
var client_id = CLIENT_ID

export const useTwitch = defineStore('twitch', () => {

  const $q = useQuasar()
  const S = useSettings()
  const A = useActions()
  const H = useHirondelle()
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
    await chatClient.value.quit()
    chat_connected.value = false
    chatClient.value = null
    await eventsub.stop()
    eventsub = null
    user.value = null
  }

  /*
    Login with OAuth flow.
  */
  const login = () => {
    client_id = CLIENT_ID
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

  /*
    Login by pasting access_token
  */
  const login_with_access_token = (token, clientId) => {
    client_id = clientId
    access_token.value = token
  }

  watch(access_token, () => S.set("twitch.access_token", access_token.value))

  var authProvider
  var apiClient
  const chatClient = ref()
  var eventsub
  const user = ref()
  const channel = ref()
  const chat_connected = ref(false)
  const eventsub_started = ref(false)
  const channel_name = ref("")

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

    channel_name.value = S.get("twitch.channel") || user.value.name
    chatClient.value = new ChatClient(
      { authProvider,
        channels: [channel_name.value],
        // requestMembershipEvents: true
      });
      chatClient.value.connect()
      chatClient.value.onConnect(() => chat_connected.value = true)
      chatClient.value.onDisconnect(() => chat_connected.value = false)
      chatClient.value.onMessage(messageEvent)
      chatClient.value.onAnnouncement((channel, user, announcementInfo, msg) => console.log("ACCOUNCEMENT", channel, user, announcementInfo, msg))
    // chatClient.onSub((channel, user, subInfo, msg) => console.log("SUB", channel, user, subInfo, msg))
    // chatClient.onCommunitySub((channel, user, subInfo, msg) => console.log("COMMUNITY SUB", channel, user, subInfo, msg))
    // chatClient.onResub((channel, user, subInfo, msg) => console.log("RESUB", channel, user, subInfo, msg))
    // chatClient.onJoin((channel, user) => console.log("JOIN", channel, user))
    // chatClient.onRaid((channel, user, raidInfo, msg) => console.log("RAID", channel, user, raidInfo, msg))
    console.log("CHAT CLIENT", chatClient.value)

    // EventSub
    eventsub = new EventSubWsListener({ apiClient })
    eventsub.start()
    // eventsub.onRevoke(sub => subscriptions.value[sub.])
    eventsub.onUserSocketConnect(ev => eventsub_started.value = true)
    eventsub.onUserSocketDisconnect(ev => eventsub_started.value = false)
    eventsub.onChannelRedemptionAdd(user.value, channelRedemptionEvent)
    eventsub.onChannelPollBegin(user.value, event => console.log("POLL BEGIN", event))
    eventsub.onChannelRewardUpdate(user.value, get_rewards)
    eventsub.onChannelRewardAdd(user.value, get_rewards)
    eventsub.onChannelRewardRemove(user.value, get_rewards)

    // Rewards si le user est au moins affilié
    if(user.value.broadcasterType)
      get_rewards()

  }, { immediate: true })
  watch(channel_name, async (val, old) => {
    // Chat
    if(old) chatClient.value.part(old)
    if(!val) return channel_name.value = user.value.name
    chatClient.value.join(val)
    // User
    channel.value = await apiClient.users.getUserByName(val)
    S.set("twitch.channel", val)
  })

  /*
    Rewards
  */
  const rewards = ref([])
  const get_rewards = async () => {
    // Get all rewards
    rewards.value = await apiClient.channelPoints.getCustomRewards(user.value)
    // Get those that are managable by the api
    var managable = await apiClient.channelPoints.getCustomRewards(user.value, true)
    managable.forEach(r => rewards.value.find(_r => _r.id == r.id).isManagable = true)
  }

  const rewards_title = computed(() => rewards.value.map(r => r.title))
  // Reward event
  var reward_action = A.register_action({
    name:"Reward", source:"Twitch", description:"Une récompense a été récupérée",
    active: eventsub_started,
    params: [
    { name: "userName", description: "Le nom de l'utilisateurice" },
    { name: "rewardId", description: "L'id de la reward" },
    { name: "rewardTitle", description: "Le titre de la récompense", options: rewards_title },
    { name: "rewardCost", description: "Le coût de la récompense" },
    { name: "input", description: "L'input de la récompense" },
  ]})

  H.registerNodeType({
    id: "Twitch:onReward",
    title: "Une récompense a été récupérée",
    category: "Twitch",
    active: eventsub_started,
    outputs: {
      userName: { type: "string" },
      rewardId: { type: "number" },
      rewardTitle: { type: "string", options: rewards_title },
      rewardCost: { type: "number" },
      input: { type: "string" },
    },
    type: "trigger"
  })

  H.registerNodeType({
    id: "Twitch:onMessage",
    type: "trigger",
    title: "Un message est envoyé dans le chat",
    category: "Twitch",
    active: chat_connected,
    outputs: {
      channel: { type: "string" },
      user: { type: "string" },
      text: { type: "string" },
      isFirst: { type: "boolean" }
    },
  })

  const messageEvent = (channel, user, text, msg) => {
    console.log(channel, user, text, msg)
    H.graph.startNodeType("Twitch:onMessage", {channel, user, text,
      isFirst: msg.isFirst})
  }

  const channelRedemptionEvent = event => {
    console.log("REDEMPTION", event)
    var opt = {
      userName: event.userName,
      rewardId: event.rewardId,
      rewardTitle: event.rewardTitle,
      rewardCost: event.rewardCost,
      input: event.input
    }
    reward_action.start(opt)
    H.graph.startNodeType("Twitch:onReward", opt)
    /*
    broadcasterDisplayName
    broadcasterId
    broadcasterName
    id
    input
    redemptionDate
    rewardCost
    rewardId
    rewardPrompt
    rewardTitle
    status
    userDisplayName
    userId
    userName
    */
  }

  return {
    access_token, state,
    login, logout, login_with_access_token,
    chat_connected,
    user, channel_name, channel,
    rewards,
    apiClient, chatClient
  }

})
