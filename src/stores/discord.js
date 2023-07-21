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
import { useHirondelle } from 'src/hirondelle/hirondelle.js'

export const useDiscord = defineStore('discord', () => {

  const $q = useQuasar()
  const S = useSettings()
  const H = useHirondelle()
  // const router = useRouter()

  const access_token = ref(S.get("discord.access_token") || "")
  const connected = ref(false)

  var temp_token
  var ws
  const connect = token => {
    console.log("Setting acces token")
    temp_token = token
    ws = new WebSocket("wss://gateway.discord.gg/?v=6&encoding=json")
    ws.addEventListener("open", onOpen)
    ws.addEventListener("close", onClose)
    ws.addEventListener("error", onError)
    ws.addEventListener("message", onMessage)
  }

  const disconnect = () => {
    console.log("Discord: disconnecting")
    ws.close()
    connected.value = false
    clearInterval(heartbeatInterval)
    // voiceDisconnect()
  }

  const onOpen = data => {
    console.log("DISCORD OPEN", data)
    ws.send(JSON.stringify({
      op: 2,
      d: {
         token: temp_token,
         intents: 34304,  // https://discord-intents-calculator.vercel.app/
         properties: { $os: "linux", $browser: "chrome", $device: "chrome", }
      }
   }))
  }
  const onClose = data => {
    console.log("DISCORD CLOSE", data)
    $q.notify(`Discord: ${data.code}: ${data.reason}`)
    disconnect()
  }
  const onError = data => {
    console.error("DISCORD ERROR", data)
  }


  const _guilds = ref([])
  const user = ref({})

  var last_s
  var heartbeatInterval
  var cache = {}
  const onMessage = data => {
    var payload = JSON.parse(data.data)
    console.log("DISCORD MESSAGE", payload)

    // Store last use to use for different events
    if (payload.s) last_s = payload.s

    if (!payload.t)
    switch (payload.op) {
      // Heartbeats
      // https://discord.com/developers/docs/topics/gateway#sending-heartbeats
      case 1:
        ws.send(JSON.stringify({ op: 1, d: last_s }))
        break
       // OPCODE 10 GIVES the HEARTBEAT INTERVAL, SO YOU CAN KEEP THE CONNECTION ALIVE
       case 10:  // Hello
        console.log(payload.d.heartbeat_interval)
        heartbeatInterval = setInterval(() => {
          console.log("Discord: sending heartbeat", last_s)
            ws.send(JSON.stringify({ op: 1, d: last_s }))
        }, payload.d.heartbeat_interval)
        break
    }

    else
    switch (payload.t) {
      case "READY":
        connected.value = true
        S.set("discord.access_token", temp_token)
        access_token.value = temp_token
        cache.session_id = payload.d.session_id
        cache.resume_gateway_url = payload.d.resume_gateway_url
        _guilds.value = payload.d.guilds
        user.value = payload.d.user
        break

      case "MESSAGE_CREATE":
        messageEvent(payload.d)
        break

      case "MESSAGE_REACTION_ADD":
        reactionEvent(payload.d, true)
        break

      case "MESSAGE_REACTION_REMOVE":
        reactionEvent(payload.d, false)
        break

      // case "VOICE_STATE_UPDATE":
      //   if (voiceSessionId == -1) {
      //     voiceSessionId = payload.d.session_id
      //     console.log("DISCORD: receiving session_id", voiceSessionId)
      //     voiceHello()
      //   }
      //   break

      // case "VOICE_SERVER_UPDATE":
      //   if (voiceToken == -1) {
      //     voiceToken = payload.d.token
      //     voiceEndpoint = payload.d.endpoint
      //     console.log("DISCORD: receiving token and endpoint", voiceToken, voiceEndpoint)
      //     voiceHello()
      //   }
      //   break
    }
  }

  /*
    Computed
  */

  const guilds = computed(() => {
    return _guilds.value.map(g => ({
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      channels: g.channels.map(c => ({
        name: c.name,
        id: c.id,
        type: c.type
      }))
    }))
  })

  /*
    Avatars
  */
  const guildIcon = guildId => {
    var guild = _guilds.value.find(g => g.id == guildId)
    if (!guild || !guild.icon) return ""
    else if (guild.icon.substring(0, 2) == "a_")
      return `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.gif`
    else return
      return `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png`
  }
  const userGuildAvatar = (userId, guildId) => {
    var guild = _guilds.value.find(g => g.id == guildId)
    var avatarId = guild.members.find(m => m.user.id == userId)?.user.avatar
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarId}.png`
  }
  const userAvatar = (userId, avatarId) => {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarId}.png`
  }
  const emoji = (emojiId, animated=false) => {
    if (!emojiId) return ""
    return `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}`
  }


  /*
    Message
  */

  H.registerNodeType({
    id: "Discord:onMessage",
    type: "trigger",
    title: "Discord message",
    category: "Discord",
    active: connected,
    outputs: {
      guild: { type: "string", options: () => computed(() => guilds.value.map(g => g.name) )},
      guildId: { type: "string" },
      guildIcon: { type: "string" },
      channel: { type: "string" },
      channelId: { type: "string" },
      userName: { type: "string" },
      userAvatar: { type: "string" },
      bot: { type: "boolean" },
      content: { type: "string" },
      id: { type: "string" },
      response: { type: "boolean" },
      responseId: { type: "string" }
    },
  })

  const messageEvent = (payload) => {
    var guild = _guilds.value.find(g => g.id == payload.guild_id)
    H.graph.startNodeType("Discord:onMessage", {
      guild: guild.name,
      guildId: guild.id,
      guildIcon: guildIcon(guild.id),
      channel: guild.channels.find(c => c.id == payload.channel_id)?.name,
      channelId: payload.channel_id,
      userName: payload.member.nick || payload.author.username,
      userAvatar: userGuildAvatar(payload.author.id, payload.guild_id),
      bot: payload.author.bot == true,
      content: payload.content,
      id: payload.id,
      response: payload.message_reference != null,
      responseId: payload.message_reference?.message_id
    })
  }

  H.registerNodeType({
    id: "Discord:Message",
    type: "action",
    title: "Discord message",
    category: "Discord",
    active: connected,
    inputs: {
      guild: { type: "string", options: () => computed(() => guilds.value.map(g => g.name) ) },
      channel: { type: "string" },
      content: { type: "string" }
    },
    compute: function(values, node) {
      var guildName = values.input.guild.val
      console.log("Guildname", guildName)
      node.inputs.value.channel.options = guilds.value.find(g => g.name == guildName)?.channels.filter(c => c.type == 0).map(c => c.name) || []
    },
    action: async function(values, node) {
      // Webhook test: https://discord.com/api/webhooks/1131840318988357683/rH3eYeY9EgL0VN0m1OdoG45oQcL_41IrS_hTaFIfO0lGB7GCCMQ0JzgN7nrdzLXq9L1t
      // https://discord.com/developers/docs/resources/channel#create-message
      var r = new XMLHttpRequest()
      var guildName = values.input.guild.val
      var channelName = values.input.channel.val
      var message = values.input.content.val
      console.log("Sending discord message", message, "to", guildName, "in", channelName)
      var channel = guilds.value.find(g => g.name == guildName)?.channels.find(c => c.name == channelName)
      var url = `https://discord.com/api/channels/${channel.id}/messages`
      r.open("POST", url, true)
      r.setRequestHeader("Content-type", "application/json")
      r.setRequestHeader("authorization", access_token.value)
      var msg = {
        "content": message
      }
      var result = await r.send(JSON.stringify(msg))
    }
  })

  /*
    Reaction
  */

  H.registerNodeType({
    id: "Discord:onReaction",
    type: "trigger",
    title: "Discord reaction",
    category: "Discord",
    active: connected,
    outputs: {
      guild: { type: "string", options: () => computed(() => guilds.value.map(g => g.name) ) },
      guildId: { type: "string" },
      guildIcon: { type: "string" },
      channel: { type: "string" },
      channelId: { type: "string" },
      userName: { type: "string" },
      userAvatar: { type: "string" },
      emoji: { type: "string" },
      emojiUrl: { type: "string" },
      removed: { type: "boolean" }
    },
  })

  const reactionEvent = (payload, added) => {
    var guild = _guilds.value.find(g => g.id == payload.guild_id)
    // user might be empty on large guilds
    var user = guild.members.find(m => m.user.id == payload.user_id)
    H.graph.startNodeType("Discord:onReaction", {
      guild: guild.name,
      guildId: guild.id,
      guildIcon: guildIcon(guild.id),
      channel: guild.channels.find(c => c.id == payload.channel_id)?.name,
      channelId: payload.channel_id,
      userName: user?.nick || user?.user.username || "",
      userAvatar: userGuildAvatar(payload.user_id, payload.guild_id),
      emoji: payload.emoji.name,
      emojiUrl: payload.emoji.id ? emoji(payload.emoji.id, payload.emoji.animated) : "",
      removed: !added
    })
  }

  // Autoconnect
  if (access_token.value) connect(access_token.value)


  /*
    VOICE
    Try to connect to voice channel to listen to TALKING events, but that creates a new sessions that disconnects the user.
    So it seems impossible.
    https://discord.com/developers/docs/topics/voice-connections#voice
  */

  // var guildId = "772809551081897994"
  // var channelId = "772809551258583065"

  // var voiceSessionId
  // var voiceToken
  // var voiceEndpoint
  // var wsVoice
  // var voiceHeartbeatInterval
  // const voiceConnected = ref(false)
  // const voiceConnect = () => {
  //   console.log("Discord Voice connect")
  //   voiceSessionId = -1
  //   voiceToken = -1
  //   ws.send(JSON.stringify({
  //     "op": 4,
  //     "d": {
  //       "guild_id": guildId,
  //       "channel_id": channelId,
  //       "self_mute": true,
  //       "self_deaf": false
  //     }
  //   }))
  // }

  // const voiceDisconnect = () => {
  //   console.log("Discord Voice: disconnecting")
  //   wsVoice.close()
  //   voiceConnected.value = false
  //   clearInterval(voiceHeartbeatInterval)
  // }

  // const voiceHello = () => {
  //   console.log("DISCORD VOICE:", voiceSessionId, voiceToken)
  //   if (voiceSessionId == -1 || voiceToken == -1) return
  //   console.log("DISCORD VOICE: Connecting")
  //   wsVoice = new WebSocket("wss://" + voiceEndpoint)
  //   wsVoice.addEventListener("open", onVoiceOpen)
  //   wsVoice.addEventListener("close", onVoiceClose)
  //   wsVoice.addEventListener("error", onVoiceError)
  //   wsVoice.addEventListener("message", onVoiceMessage)
  // }


  // const onVoiceOpen = data => {
  //   console.log("DISCORD VOICE OPEN", data, "sending Identify")
  //   wsVoice.send(JSON.stringify({
  //     op: 0,
  //     d: {
  //       "server_id": guildId,
  //       "user_id": user.value.id,
  //       "session_id": voiceSessionId,
  //       "token": "my_token"
  //     }
  //  }))
  // }
  // const onVoiceClose = data => {
  //   console.log("DISCORD VOICE CLOSE", data)
  //   $q.notify(`Discord: ${data.code}: ${data.reason}`)
  //   voiceDisconnect()
  // }
  // const onVoiceError = data => {
  //   console.error("DISCORD VOICE ERROR", data)
  // }
  // const onVoiceMessage = data => {
  //   var payload = JSON.parse(data.data)
  //   console.log("DISCORD VOICE MESSAGE", payload)

  //   switch (payload.op) {
  //     case 2: // Ready
  //       voiceConnected.value = true
  //       break
  //     case 8: // Heartbeats
  //       voiceHeartbeatInterval = setInterval(() => {
  //         console.log("Discord voice: sending voice heartbeat", last_s)
  //         wsVoice.send(JSON.stringify({ op: 3, d: $q.uid() }))
  //       }, payload.d.heartbeat_interval)
  //       break
  //   }
  // }


  return {
    connect, disconnect, connected,
    _guilds, user,
    userAvatar, userGuildAvatar, guildIcon
  }

})
