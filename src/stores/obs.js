import { defineStore } from 'pinia'
import OBSWebSocket, {EventSubscription} from 'obs-websocket-js'
import { ref, computed, watch, toRef, onMounted, reactive } from 'vue'
import _ from 'lodash'
import { useSettings } from './settings'
import { useHirondelle } from 'src/hirondelle/hirondelle.js'
import { usePeer } from './peer'
import { useQuasar } from 'quasar'

export const useOBS = defineStore('obs', () => {

  const S = useSettings()
  const H = useHirondelle()
  const peer = usePeer()
  const $q = useQuasar()

  const obsWS = new OBSWebSocket()
  const connected = ref(false)
  const loading = ref(false)

  const preview_img = ref()
  const program_img = ref()
  const preview = ref(S.get("obs.preview.enabled"))
  watch(preview, (val) => {
    S.set("obs.preview.enabled", val)
    getScreenshot()
  })

  const _data = ref({}) // all data we get from OBS

  var OSCBotBrowserName = "HirondelleBrowser[Bot]"
  const OSCBotBrowserKeepOnAllScenes = ref(true)

  const connect = async (ip, port, password) => {
    var protocol = location.protocol == "https" ? "wss" : "ws"
    var url = `${protocol}://${ip}:${port}`
    disconnect()
    try {
      var r = await obsWS.connect(url, password, {
        eventSubscriptions: EventSubscription.All | EventSubscription.InputVolumeMeters | EventSubscription.SceneItemTransformChanged
        ,
      })
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

  obsWS.on("ConnectionClosed", (v) => {
    console.log("ConnectionClosed", v)
    connected.value = false
  })

  const disconnect = async () => {
    await obsWS.disconnect()
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
      var r = await obsWS.call(q)
      d = { ...d, ...r}
    }

    // Bot browser stuff
    d.botCreated = d.inputs.find(i => i.inputName == OSCBotBrowserName) != undefined

    // On mets le bot sur la scene en cours
    if (OSCBotBrowserKeepOnAllScenes.value && d.botCreated) {
      // On rajoute le bot sur la scene
      for (const s of d.scenes) {
        // On recherche le bot sur la scene, et on récupère son item
        r = await obsWS.call("GetSceneItemList", { sceneName: s.sceneName})
        var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
        // Si c'est la scene en cours, on ajoute
        if (s.sceneName == d.currentPreviewSceneName || s.sceneName == d.currentProgramSceneName) {
          if (!item) {
            try {
              console.log({ sceneName: s.sceneName, sourceName: OSCBotBrowserName })
              var { sceneItemId } = await obsWS.call("CreateSceneItem", { sceneName: s.sceneName, sourceName: OSCBotBrowserName })
              await obsWS.call("SetSceneItemLocked", { sceneName: s.sceneName, sceneItemId, sceneItemLocked: true })
            } catch (err) {console.error(err)}
          }
        }
      }
      // On enlève le bot des scènes ou il doit pas y etre
      // On doit faire ça après coup, sinon suivant comment ça supprime la source, et c'est triste
      for (const s of d.scenes) {
        // On recherche le bot sur la scene, et on récupère son item
        r = await obsWS.call("GetSceneItemList", { sceneName: s.sceneName})
        var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
        // Si c'est pas la scene en cours, on ajoute
        if (s.sceneName != d.currentPreviewSceneName && s.sceneName != d.currentProgramSceneName) {
          if (item)
            await obsWS.call("RemoveSceneItem", { sceneName: s.sceneName, sceneItemId: item.sceneItemId})
        }
      }
    }

    _data.value = d

    getScreenshot()

    loading.value = false
  }

  // On connect
  watch(connected, async () => {
    if (!connected.value) return
    await getInfo()
    await getStats()
    _.assign(_data.value, await obsWS.call("GetVersion"))
  })

  const data = computed(() => {

    if (!connected.value) return {}

    var d = _data.value

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
    if (!d.record) d.record = {}
    if (!d.stream) d.stream = {}

    // Stats
    // if (d.stats)

    return d
  })

  const _screenshotOptions = {
    imageWidth: 600,
    imageHeight: 600 / data.value.ratio,
    imageFormat: "jpg",
    imageCompressionQuality: 40,
    imagePerSecond: 24
  }
  const screenshotOptions = ref( S.get("obs.preview.options") || _.cloneDeep(_screenshotOptions))
  const restaureScreenshotOptions = () => screenshotOptions.value = _.cloneDeep(_screenshotOptions)
  const getScreenshot = async () => {
    if (!connected.value) return

    var opt = screenshotOptions.value
    if (data.value.studioModeEnabled) {
      var r = await obsWS.call("GetSourceScreenshot", {
        sourceName: data.value.previewScene, ...opt,
        imageHeight: opt.imageWidth / data.value.ratio
      })
      if (r.imageData)
        preview_img.value = r.imageData
    }
    var r = await obsWS.call("GetSourceScreenshot", {
      sourceName: data.value.programScene, ...opt,
      imageHeight: opt.imageWidth / data.value.ratio
    })
    program_img.value = r.imageData
    if (preview.value) setTimeout(getScreenshot, 1000 / opt.imagePerSecond)
  }
  watch(screenshotOptions, () => {
    S.set("obs.preview.options", screenshotOptions.value)
    getScreenshot()
  }, { deep: true})

  const getStats = async () => {
    if (!connected.value) return
    var r = await obsWS.call("GetStats")
    _.assign(data.value, r)
    var r = await obsWS.call("GetRecordStatus")
    if (!data.value.record) data.value.record = {}
    _.assign(data.value.record, r)
    var r = await obsWS.call("GetStreamStatus")
    if (!data.value.stream) data.value.stream = {}
    _.assign(data.value.stream, r)
    setTimeout(getStats, 1000)
  }

  // Input levels
  const inputVolumeMeters = ref([])
  // See https://github.com/obsproject/obs-websocket/commit/d48ddef0318af1e370a4d0b77751afc14ac6b140
  // [magnitude, peak, input_peak]
  // Also https://obsproject.com/wiki/Understanding-the-Mixer
  const setInputVolumeMeters = _.throttle(data => {
    var input = data.inputs
    .filter(i => i.inputLevelsMul.length)
    input.forEach((i, k) => {
      var l = i.inputLevelsMul[0].map(v => v ? 20 * Math.log10(v) : -100)
      var r = i.inputLevelsMul[1].map(v => v ? 20 * Math.log10(v) : -100)
      input[k].inputLevelsDB = [l, r]
      // Si ça descent on fait la moyenne, comme ça ça smoothe
      if (l < inputVolumeMeters.value[k]?.inputLevelsDB?.at(0)) l = (l - 60) / 10
      if (r < inputVolumeMeters.value[k]?.inputLevelsDB?.at(1)) r = (r - 60) / 10
    })
    inputVolumeMeters.value = input

  }, 0)
  obsWS.on("InputVolumeMeters", setInputVolumeMeters)

  const setPreviewScene = async (name) => {
    if (!data.value.studioModeEnabled) return setProgramScene(name)
    obsWS.call("SetCurrentPreviewScene", { sceneName: name })
  }

  const setProgramScene = async (name) => {
    obsWS.call("SetCurrentProgramScene", { sceneName: name })
  }
  const setStudioMode = async (val = true) => {
    obsWS.call("SetStudioModeEnabled", { studioModeEnabled: val })
  }
  const setProfile = async (val) => {
    obsWS.call("SetCurrentProfile", { profileName: val })
  }
  const setSceneCollection = async (val) => {
    obsWS.call("SetCurrentSceneCollection", { sceneCollectionName: val })
  }
  const setRecordingState = async (val) => {
    if (val)
      await obsWS.call("StartRecord")
    else {
      var r = await obsWS.call("StopRecord")
      $q.notify(`Recording saved to '${r.outputPath}'.`)
    }
  }
  const setStreamState = async (val) => {
    if (val)
      await obsWS.call("StartStream")
    else
      await obsWS.call("StopStream")
  }
  // Scenes transitions
  const currentSceneTransitions = ref([])
  watch(() => data.value.currentPreviewSceneName, async () => {
    if (connected.value)
      currentSceneTransitions.value = await obsWS.call("GetSceneTransitionList")
  })
  const TriggerStudioModeTransition = async (swap) => {
    var sceneName = data.value.programScene
    await obsWS.call("TriggerStudioModeTransition")
    if (swap) obsWS.call("SetCurrentPreviewScene", { sceneName })
  }

  const createOSCBotBrowserSource = async (url) => {
    var r = await obsWS.call("CreateInput", {
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
      var r = await obsWS.call("RemoveInput", {
        inputName: OSCBotBrowserName,
      })
    } catch {
      console.log(r)
    }
    // Remove from program
    if (data.value.programScene) {
      r = await obsWS.call("GetSceneItemList", { sceneName: data.value.programScene})
      var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
      if (item) {
        try {
          await obsWS.call("RemoveSceneItem", { sceneName: data.value.programScene, sceneItemId: item.sceneItemId })
        } catch {}
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
  obs_update_info.forEach(e => obsWS.on(e, getInfo))

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
        { name: "outputActive", type:"boolean", description: "Whether the output is active" },
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
      outputs: Object.fromEntries(e.params.map(e => [e.name, { type: e.type || "string", description: e.description, options: e.options }])),
    })
    obsWS.on(e.obsname, (p) => H.graph.startNodeType(`OBS:${e.obsname}`, p))
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
        obsWS.call("SetCurrentProgramScene", { sceneName: values.input.sceneName.val })
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
        obsWS.call("SetCurrentPreviewScene", { sceneName: values.input.sceneName.val })
      return {}
    }
  })

  H.registerNodeType({
    id: "OBS:SetStreamState",
    type: "action",
    title: "Start Streaming",
    category: "OBS",
    active: connected,
    accepts_input: false,
    accepts_output: false,
    slots: {
      start: async () => await obsWS.call("StartStream"),
      stop: async () => await obsWS.call("StopStream"),
    },
    action () {

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
      console.log(d.transition_in, d.transition_out)
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

  H.registerNodeType({
    id: "OBSSource:showImage",
    type: "action",
    title: "Image",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      src: { type: "string" },
      rect: { type: "rect", default: {x: 0, y: 0, width: 1920, height: 20} },
      visible: { type: "boolean" },
      random: { type: "boolean", default: false, description: "Random transitions"},
      transition_in: { type: "string", default: "circle:hesitate", options: transitions },
      transition_out: { type: "string", default: "wipe:up", options: transitions },
      style: { type: "string", description: "Additional styles, like 'opacity:.5'..." },
    },
    slots: {
      show: (values, node) => {
        values.input.visible.val = true
        node.compute()
      },
      hide: (values, node) => {
        values.input.visible.val = false
        node.compute()
      },
    },
    _update: _.throttle(d => peer.send(d), 100),
    compute: function (values, node) {
      if (!peer_connected.value) return
      var d = {
        action: "showImage",
        src: values.input.src.val,
        rect: values.input.rect.val,
        visible: values.input.visible.val,
        id: node.id,
        style: values.input.style.val,
        random: values.input.random.val,
        transition_in: values.input.transition_in.val,
        transition_out: values.input.transition_out.val,
      }
      if (d.random) {
        d.transition_in = _.sample(transitions)
        d.transition_out = _.sample(transitions)
      }
      console.log(d.transition_in, d.transition_out)
      this._update(d)
    },
    accepts_output: false,
    accepts_input: false,
  })

  // Get scene item rect
  const getSceneItemRecs = async (sceneName) => {
    var r = await obsWS.call("GetSceneItemList", { sceneName })
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
      var sceneItems = await getSceneItemRecs(values.input.sceneName.val)
      if (!_.isEqual(sceneItems, node.inputs.value["sceneItemId"].options))
        node.inputs.value["sceneItemId"].options = sceneItems
      var rect = sceneItems.find(i => i.id == values.input.sceneItemId.val)?.rect
      if (rect && !_.isEqual(rect, values.output.rect.val)) values.output.rect.val = rect
    },
  })

  // var events = [
  //   // "SceneItemSelected",
  //   "SceneItemTransformChanged",
  //   // "SceneItemChanged",
  //   "InputVolumeMeters",
  //   // "InputAudioMonitorTypeChanged",
  //   // "InputMuteStateChanged"
  // ]
  // events.forEach(e => obsWS.on(e, data => console.log(e, data)))

  // FIXME: trigger pas :(
  obsWS.on("SceneItemTransformChanged", (p) => {
    console.error("SCENE ITEM TRANSFORMED")
    H.graph.computeNodesForTypes("OBS:GetSceneItemRect")
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

  const synth = window.speechSynthesis
  H.registerNodeType({
    id: "OBSSource:speechSynthesis",
    type: "action",
    title: "TTS: Read text",
    category: "OBSSource",
    active: peer_connected,
    inputs: {
      text: { type: "string" },
      voice: { type: "string", options: () => synth.getVoices().map(v => `${v.name} (${v.lang})`) },
      volume: { type: "number", default: 1, slider: {min: 0, max: 1, step: 0.1} },
      rate: { type: "number", default: 1, slider: {min: 0.1, max: 2, step: 0.1, label: true } },
      pitch: { type: "number", default: 1,  slider: {min: 0.1, max: 2, step: 0.1, label: true } },
    },
    signals: {
      done: null
    },
    action: function (values, node) {
      var text = values.input.text.val.substring(0, 200)
      const utterThis = new SpeechSynthesisUtterance(text)
      utterThis.pitch = values.input.pitch.val
      utterThis.rate = values.input.rate.val
      utterThis.volume = values.input.volume.val
      utterThis.voice = synth.getVoices().find(v => `${v.name} (${v.lang})` == values.input.voice.val )
      utterThis.onend = e => node.emit("done")
      window.speechSynthesis.speak(utterThis)
      // if (!peer_connected.value) return
      // var d = {
      //   action: "readText",
      //   text: text,
      //   rate: values.input.rate.val,
      //   pitch: values.input.pitch.val,
      //   volume: values.input.volume.val,
      //   voice: values.input.voice.val
      // }
      // peer.send(d)
    },
    accepts_output: false,
    accepts_input: true,
  })

  return {
    connect, disconnect, connected,
    setPreviewScene, setProgramScene, setStudioMode, setProfile, setSceneCollection,
    createOSCBotBrowserSource, removeOSCBotBrowserSource, OSCBotBrowserKeepOnAllScenes,
    preview, screenshotOptions, restaureScreenshotOptions,
    setRecordingState, setStreamState,
    TriggerStudioModeTransition, currentSceneTransitions,
    preview_img, program_img,
    data, obsWS, inputVolumeMeters
  }
})
