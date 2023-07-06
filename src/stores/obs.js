import { defineStore } from 'pinia'
import OBSWebSocket from 'obs-websocket-js'
import { ref, computed, watch, toRef, onMounted, reactive } from 'vue'
import _ from 'lodash'
import { useSettings } from './settings'
import { useHirondelle } from 'src/hirondelle/hirondelle.js'
import { usePeer } from './peer'

export const useOBS = defineStore('obs', () => {

  const S = useSettings()
  const H = useHirondelle()
  const peer = usePeer()

  const obs_ws = new OBSWebSocket()
  const connected = ref(false)
  const loading = ref(false)

  const preview_img = ref()
  const program_img = ref()
  const preview = ref(S.get("obs.preview"))
  watch(preview, (val) => {
    S.set("obs.preview", val)
    getScreenshot()
  })

  const _data = ref({}) // all data we get from OBS

  var OSCBotBrowserName = "OSCBotBrowser[TEMP]"
  const OSCBotBrowserKeepOnAllScenes = ref(true)

  const connect = async (ip, port, password) => {
    var url = `ws://${ip}:${port}`
    disconnect()
    try {
      var r = await obs_ws.connect(url, password)
      console.log(`Connecté à websocket version ${r.obsWebSocketVersion} (avec RCP ${r.rpcVersion})`)
      connected.value = true
      S.set("obs.ip", ip)
      S.set("obs.port", port)
      S.set("obs.password", password)
    }
    catch(error) {
      console.log(error)
      connected.value = false
    }
  }

  // Auto connect
  onMounted(() => {
    console.log("AUTO CONNECT?")
    if (S.get("obs.ip") && S.get("obs.port") && S.get("obs.password"))
      connect(S.get("obs.ip"), S.get("obs.port"), S.get("obs.password"))
  })

  obs_ws.on("ConnectionClosed", (v) => {
    console.log("ConnectionClosed", v)
    connected.value = false
  })

  const disconnect = async () => {
    await obs_ws.disconnect()
    connected.value = false
  }

  const getInfo = async () => {
    loading.value = true

    var d = { ..._data.value}

    var requests = [
      "GetProfileList",
      "GetSceneCollectionList",
      "GetSceneList",
      "GetVideoSettings",
      "GetStudioModeEnabled",
      "GetInputList",
      "GetInputKindList"
    ]
    for (const q of requests) {
      var r = await obs_ws.call(q)
      d = { ...d, ...r}
    }

    // Bot browser stuff
    d.botCreated = d.inputs.find(i => i.inputName == OSCBotBrowserName) != undefined

    // On mets le bot sur la scene en cours
    if (OSCBotBrowserKeepOnAllScenes.value && d.botCreated) {
      // On rajoute le bot sur la scene
      for (const s of d.scenes) {
        // On recherche le bot sur la scene, et on récupère son item
        r = await obs_ws.call("GetSceneItemList", { sceneName: s.sceneName})
        var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
        // Si c'est la scene en cours, on ajoute
        if (s.sceneName == d.currentPreviewSceneName || s.sceneName == d.currentProgramSceneName) {
          if (!item) {
            var { sceneItemId } = await obs_ws.call("CreateSceneItem", { sceneName: s.sceneName, sourceName: OSCBotBrowserName })
            await obs_ws.call("SetSceneItemLocked", { sceneName: s.sceneName, sceneItemId, sceneItemLocked: true })
          }
        }
      }
      // On enlève le bot des scènes ou il doit pas y etre
      // On doit faire ça après coup, sinon suivant comment ça supprime la source, et c'est triste
      for (const s of d.scenes) {
        // On recherche le bot sur la scene, et on récupère son item
        r = await obs_ws.call("GetSceneItemList", { sceneName: s.sceneName})
        var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
        // Si c'est pas la scene en cours, on ajoute
        if (s.sceneName != d.currentPreviewSceneName && s.sceneName != d.currentProgramSceneName) {
          if (item)
            await obs_ws.call("RemoveSceneItem", { sceneName: s.sceneName, sceneItemId: item.sceneItemId})
        }
      }
    }

    _data.value = d

    getScreenshot()

    loading.value = false
  }

  watch(connected, async () => {
    if (connected.value) getInfo()
  })

  const data = computed(() => {

    if (!connected.value) return {}

    var d = _.cloneDeep(_data.value)

    // Scenes
    if(d.scenes && d.scenes.length) {
      d.scenes.forEach(s => {
        if (s.sceneName == d.currentPreviewSceneName) s.preview = true
        if (s.sceneName == d.currentProgramSceneName) s.program = true
      })
      d.scenes = d.scenes.sort((a, b) => b.sceneIndex - a.sceneIndex)
      d.previewScene = d.currentPreviewSceneName
      d.programScene = d.currentProgramSceneName
    } else d.scenes = []

    // Video settings
    if (d.baseHeight) {
      d.ratio = d.baseWidth / d.baseHeight
    }

    // Inputs
    if (!d.inputs) d.inputs = []

    return d
  })

  const getScreenshot = async () => {
    if (!connected.value) return

    var opt = {
      imageWidth: 600,
      imageHeight: 600 / data.value.ratio,
      imageFormat: "jpg",
      imageCompressionQuality: 50
    }
    if (data.value.studioModeEnabled) {
      var r = await obs_ws.call("GetSourceScreenshot", {
        sourceName: data.value.previewScene, ...opt
      })
      preview_img.value = r.imageData
    }
    var r = await obs_ws.call("GetSourceScreenshot", {
      sourceName: data.value.programScene, ...opt
    })
    program_img.value = r.imageData
    if (preview.value) setTimeout(getScreenshot, 50)
  }

  const setPreviewScene = async (name) => {
    if (!data.value.studioModeEnabled) return setProgramScene(name)
    obs_ws.call("SetCurrentPreviewScene", { sceneName: name })
  }

  const setProgramScene = async (name) => {
    obs_ws.call("SetCurrentProgramScene", { sceneName: name })
  }
  const setStudioMode = async (val = true) => {
    obs_ws.call("SetStudioModeEnabled", { studioModeEnabled: val })
  }
  const setProfile = async (val) => {
    obs_ws.call("SetCurrentProfile", { profileName: val })
  }
  const setSceneCollection = async (val) => {
    obs_ws.call("SetCurrentSceneCollection", { sceneCollectionName: val })
  }

  const createOSCBotBrowserSource = async (url) => {
    var r = await obs_ws.call("CreateInput", {
      sceneName: data.value.programScene,
      inputName: OSCBotBrowserName,
      inputKind: "browser_source",
      inputSettings: {
            "css": "body { background-color: rgba(0, 0, 0, 0) !important; margin: 0px auto; overflow: hidden; }",
            "is_local_file": false,
            "reroute_audio": false,
            "restart_when_active": false,
            "url": url,
            "webpage_control_level": 1,
            "width": data.value.baseWidth,
            "height": data.value.baseHeight,
      }
    })
    getInfo()
  }

  const removeOSCBotBrowserSource = async () => {
    // loading.value = true
    try {
      var r = await obs_ws.call("RemoveInput", {
        inputName: OSCBotBrowserName,
      })
    } catch {
      console.log(r)
    }
    // Remove from program
    if (data.value.programScene) {
      r = await obs_ws.call("GetSceneItemList", { sceneName: data.value.programScene})
      var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
      if (item) {
        await obs_ws.call("RemoveSceneItem", { sceneName: data.value.programScene, sceneItemId: item.sceneItemId })
        // Sais pas pourquoi, mais ça supprime pas complètement la source (qui est utilisée dans program)
        // Mais si on recall ici, ça fonctionne. Sympa.
        await removeOSCBotBrowserSource()
      }
    }
    getInfo()
  }

  /*
    Events
  */
  const scene_names = computed(() => data.value.scenes ? data.value.scenes.map(s => s.sceneName) : null)

  // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#events
  var obs_update_info = [
    "CurrentPreviewSceneChanged",
    "CurrentProgramSceneChanged",
    "StudioModeStateChanged",
    "SceneListChanged",
    "StreamStateChanged",
    "CurrentProfileChanged",
    "ProfileListChanged",
    "CurrentSceneCollectionChanged",
    "SceneCollectionListChanged"
  ]
  obs_update_info.forEach(e => obs_ws.on(e, getInfo))

  // Register events
  var events_lists_to_watch = [
    {
      name: "Scene Changed", obsname: "CurrentProgramSceneChanged", description: "La scène OBS change",
      params: [ { name: "sceneName", description: "Nom de la nouvelle scène", options: () => scene_names } ]
    },
    {
      name: "Preview Scene Changed", obsname: "CurrentPreviewSceneChanged", description: "La scène d'apperçu OBS change",
      params: [ { name: "sceneName", description: "Nom de la nouvelle scène", options: () => scene_names } ]
    },
    {
      name: "Studio Mode Changed", obsname: "StudioModeStateChanged", description: "Le mode studio a été activé ou désactivé",
      params: [ { name: "studioModeEnabled", description: "Valeur" } ]
    },
    {
      name: "Stream State Changed", obsname: "StreamStateChanged", description: "The state of the stream output has changed.",
      params: [
        { name: "outputActive", description: "Whether the output is active" },
        { name: "outputState", description: "The specific state of the output" },
      ]
    },
    {
      name: "Profile Changed", obsname: "CurrentProfileChanged", description: "Le profile a changé",
      params: [ { name: "profileName", description: "Le nom du nouveau profile" } ]
    },
    {
      name: "Scene Collection Changed", obsname: "CurrentSceneCollectionChanged", description: "La collection de scènes a changé",
      params: [ { name: "sceneCollectionName", description: "Nom de la nouvelle collection" } ]
    }
  ]

  // Events
  events_lists_to_watch.forEach(e => {
    H.registerNodeType({
      id: `OBS:${e.obsname}`,
      title: e.name,
      type: "trigger",
      category: "OBS",
      active: connected,
      outputs: Object.fromEntries(e.params.map(e => [e.name, { type: "string", description: e.description, options: e.options }])),
    })
    obs_ws.on(e.obsname, (p) => H.graph.startNodeType(`OBS:${e.obsname}`, p))
  })

  // Actions
  H.registerNodeType({
    id: "OBS:SetCurrentProgramScene",
    type: "action",
    title: "Set Program Scene",
    category: "OBS",
    active: connected,
    inputs: {
      sceneName: { type: "string", options: () => scene_names }
    },
    // outputs: { sceneName: "string" },
    action: (values) => {
      console.log("SETTING SCENE NAME", values)
      if (values.input.sceneName.val)
        obs_ws.call("SetCurrentProgramScene", { sceneName: values.input.sceneName.val })
      return {}
    }
  })

  H.registerNodeType({
    id: "OBS:SetCurrentPreviewScene",
    type: "action",
    title: "Set Preview Scene",
    category: "OBS",
    active: connected,
    inputs: { sceneName: { type: "string", options: () => scene_names } },
    action: (values) => {
      if (values.input.sceneName.val)
        obs_ws.call("SetCurrentPreviewScene", { sceneName: values.input.sceneName.val })
      return {}
    }
  })
  const peer_connected = computed(() => peer.connected)
  H.registerNodeType({
    id: "OBSSource:Confettis",
    type: "action",
    title: "Confettis",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      bursts: { type: "number", default: 10 },
      duration: { type: "number", default: 5000 },
      number: { type: "number", default: 30 },
      radius: { type: "number", default: 10 },
      colors: { type: "string", default: "#ffd400, #00ffdd, #d700d7" },
      useEmojis: { type: "boolean", default: false, description: "Use emojis" },
      emojiSize: { type: "number", default: 30 },
      emojis: { type: "string", default: "🌈, ⚡️, 💥, ✨, 💫, 🌸, ❤️, 💚, 🩵, 💙, 💜, 💛, 🤍, 🤎" },
    },
    action: (values) => {
      console.log(values)

      var d = {
        action: "confettis",
        bursts: values.input.bursts.val,
        duration: values.input.duration.val,
        confettiNumber: values.input.number.val,
      }
      if (values.input.useEmojis.val) {
        d.emojis = values.input.emojis.val.split(",").map(c => encodeURI(c.trim()))
        d.emojiSize = values.input.emojiSize.val
      } else {
        d.confettiRadius = values.input.radius.val
        d.confettiColors = values.input.colors.val.split(",").map(c => c.trim())
      }
      console.log(d)
      peer.send(d)
    },
  accepts_output: false,
  })

  // From https://www.transition.style/
  var transitions = [
    "circle:hesitate", "circle:center", "circle:top-right", "circle:top-left", "circle:bottom-right", "circle:bottom-left",
    "square:center", "square:hesitate", "square:top-right", "square:top-left", "square:bottom-right", "square:bottom-left",
    "wipe:right", "wipe:left", "wipe:up", "wipe:down",
    "wipe:top-right", "wipe:top-left", "wipe:bottom-right", "wipe:bottom-left", "wipe:cinematic",
    "diamond:center", "diamond:hesitate",
    "polygon:opposing-corners", "custom:circle-swoop"
  ]

  H.registerNodeType({
    id: "OBSSource:MessageBox",
    type: "action",
    title: "MessageBox",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      message: { type: "string", textarea: true, default: "Coucou." },
      duration: { type: "number", default: 5000 },
      random: { type: "boolean", default: false, description: "Random transitions"},
      transition_in: { type: "string", default: "circle:hesitate", options: transitions },
      transition_out: { type: "string", default: "wipe:up", options: transitions },
      rect: { type: "rect", default: {x: 20, y: 20, width: 200, height: 75} },
      background: { type: "color", default: "#d700d799" },
      style: { type: "string", default: "font-size: 50px;" },
    },
    action: (values) => {
      var d = { action: "messageBox" }
      _.assign(d, _.mapValues(values.input, v => v.val))
      if (d.random) {
        d.transition_in = _.sample(transitions)
        d.transition_out = _.sample(transitions)
      }
      peer.send(d)
    },
  accepts_output: false,
  })

  H.registerNodeType({
    id: "OBSSource:progressbar",
    type: "action",
    title: "Progress Bar",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      percentage: { type: "number", default: 50, slider: { min: 0, max: 100, color: "primary" } },
      rect: { type: "rect", default: {x: 0, y: 0, width: 1920, height: 20} },
      color: { type: "color", default: "#d700d799" },
      background: { type: "color", default: "#d700d799" },
      visible: { type: "boolean" },
      style: { type: "string", description: "Additional styles, like 'opacity:.5'..." },
    },
    slots: {
      show: (values) => values.input.visible.val = true,
      hide: (values) => values.input.visible.val = false,
    },
    _update: _.throttle(d => peer.send(d), 100),
    compute: function (values, node) {
      if (!peer_connected.value) return
      var d = {
        action: "progressBar",
        rect: values.input.rect.val,
        visible: values.input.visible.val,
        value: values.input.percentage.val / 100,
        id: node.id,
        color: values.input.background.val,
        background: values.input.background.val,
        style: values.input.style.val,
      }
      this._update(d)
    },
    accepts_output: false,
    accepts_input: false,
  })

  // Get scene item rect
  const getSceneItemRecs = async (sceneName) => {
    var r = await obs_ws.call("GetSceneItemList", { sceneName })
    return r.sceneItems.map(i => ({
      id: i.sceneItemId,
      name: i.sourceName,
      rect: {
        x: i.sceneItemTransform.positionX,
        y: i.sceneItemTransform.positionY,
        width: i.sceneItemTransform.width - (i.sceneItemTransform.cropLeft + i.sceneItemTransform.cropRight) * i.sceneItemTransform.scaleX,
        height: i.sceneItemTransform.height - (i.sceneItemTransform.cropTop + i.sceneItemTransform.cropBottom) * i.sceneItemTransform.scaleY,
      }
    }))
  }
  H.registerNodeType({
    id: `OBS:GetSceneItemRect`,
    title: "Get scene item rect",
    type: "param",
    category: "OBS",
    active: connected,
    inputs: {
      sceneName: { type: "string", options: () => scene_names },
      sceneItemId: { type: "number", optionLabel: "name", optionValue: "id" }
    },
    outputs: {
      rect: { type: "rect" },
    },
    async compute (values, node) {
      if (!connected.value) return
      console.log("Before:", values)
      var sceneItems = await getSceneItemRecs(values.input.sceneName.val)
      if (!_.isEqual(sceneItems, node.inputs.value["sceneItemId"].options))
        node.inputs.value["sceneItemId"].options = sceneItems
      var rect = sceneItems.find(i => i.id == values.input.sceneItemId.val)?.rect
      if (rect && !_.isEqual(rect, values.output.rect.val)) values.output.rect.val = rect
      console.log("After:", values)
    },
  })
  // FIXME: trigger pas :(
  obs_ws.on("SceneItemTransformChanged", (p) => {
    console.log("SCENE ITEM TRANSFORMED")
    H.graph.updateValuesFoNodeTypes("OBS:GetSceneItemRect")
  })

  // Play sound

  H.registerNodeType({
    id: "OBSSource:playSound",
    type: "action",
    title: "Play Sound",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      name: { type: "string", default: "My Sound" },
      src: { type: "string", default: "https://www.myinstants.com/media/sounds/kaamelott-paladin.mp3" },
      volume: { type: "number", default: 100, slider: { min: 0, max: 100}}
    },
    action: function (values, node) {
      if (!peer_connected.value) return
      var d = {
        action: "playSound",
        src: values.input.src.val,
        volume: values.input.volume.val / 100,
      }
      peer.send(d)
    },
    compute: function (values, node) {
      node.title = "Play sound: " + values.input.name.val
    },
    accepts_output: false,
    accepts_input: true,
  })
  return {
    connect, disconnect, connected,
    setPreviewScene, setProgramScene, setStudioMode, setProfile, setSceneCollection,
    createOSCBotBrowserSource, removeOSCBotBrowserSource, OSCBotBrowserKeepOnAllScenes,
    preview,
    preview_img, program_img,
    data,
  }
})
