import { defineStore } from 'pinia'
import OBSWebSocket from 'obs-websocket-js'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useSettings } from './settings'
import { useActions } from './actions'
import { useNodesBaklava } from './nodes_baklava'
import { useHirondelle } from 'src/hirondelle/hirondelle.js'

export const useOBS = defineStore('obs', () => {

  const S = useSettings()
  const A = useActions()
  const NBaklava = useNodesBaklava()
  const H = useHirondelle()

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
          if (!item)
            var r = await obs_ws.call("CreateSceneItem", { sceneName: s.sceneName, sourceName: OSCBotBrowserName })
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
            "webpage_control_level": 1
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
      params: [ { name: "sceneName", description: "Nom de la nouvelle scène", options: scene_names } ]
    },
    {
      name: "Preview Scene Changed", obsname: "CurrentPreviewSceneChanged", description: "La scène d'apperçu OBS change",
      params: [ { name: "sceneName", description: "Nom de la nouvelle scène", options: scene_names } ]
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

  events_lists_to_watch.forEach(e => {
    var action = A.register_action({
      name: e.name, source: "OBS", description: e.description, params: e.params, active: connected})
    obs_ws.on(e.obsname, (p) => action.start(p))
  })

  // Hirondelle
  events_lists_to_watch.forEach(e => {
    H.registerNodeType({
      type: `OBS:${e.obsname}`,
      title: e.name,
      accepts_input: false,
      category: "OBS",
      active: connected,
      outputs: Object.fromEntries(e.params.map(e => [e.name, { type: "string", description: e.description, options: e.options }])),
      callback: (opt) => {
        console.log("SETTING SCENE NAME", opt)
        if (opt.sceneName)
          obs_ws.call("SetCurrentProgramScene", { sceneName: opt.sceneName })
        return {}
      }
    })

    A.register_action({
      name: e.name, source: "OBS", description: e.description, params: e.params, active: connected})
    obs_ws.on(e.obsname, (p) => action.start(p))
  })

  // Baklava
  NBaklava.registerNode("OBS", {
    type: "OBS:CurrentPreviewSceneChanged",
    title: "Preview Scene Changed",
    outputs: { sceneName: "string" },
  })



  /*
    Actions
  */
  A.register_action({
    name: "Set scene", source: "OBS",
    description: "Change la scène en cours sur OBS",
    params: [ { name: "sceneName", description: "Nom de la scene" }],
    active: connected,
    callback: (opt) => {
      console.log("OBS CHANGE SCENE", opt)
      obs_ws.call("SetCurrentProgramScene", { sceneName: opt.sceneName })
    }
  })

  A.register_action({
    name: "Set preview scene", source: "OBS",
    description: "Change la scène apperçu sur OBS",
    params: [ { name: "sceneName", description: "Nom de la scene" }],
    active: connected,
    callback: (opt) => obs_ws.call("SetCurrentPreviewScene", { sceneName: opt.sceneName })
  })

  // Hirondelle

  H.registerNodeType({
    type: "OBS:SetCurrentProgramScene",
    title: "Set Program Scene",
    category: "OBS",
    inputs: {
      sceneName: {
        type: "string",
        options: toRef(scene_names)
     } },
    // outputs: { sceneName: "string" },
    callback: (opt) => {
      console.log("SETTING SCENE NAME", opt)
      if (opt.sceneName)
        obs_ws.call("SetCurrentProgramScene", { sceneName: opt.sceneName })
      return {}
    }
  })

  H.registerNodeType({
    type: "OBS:SetCurrentPreviewScene",
    title: "Set Preview Scene",
    category: "OBS",
    inputs: { sceneName: { type: "string", options: toRef(scene_names) } },
    callback: (opt) => {
      if (opt.sceneName)
        obs_ws.call("SetCurrentPreviewScene", { sceneName: opt.sceneName })
      return {}
    }
  })

  // Baklava

  NBaklava.registerNode("OBS", {
    type: "OBS:SetCurrentProgramScene",
    title: "Set Program Scene",
    inputs: { sceneName: { type: "string" } },
    // outputs: { sceneName: "string" },
    calculate: (opt) => {
      console.log("SETTING SCENE NAME", opt)
      if (opt.sceneName)
        obs_ws.call("SetCurrentProgramScene", { sceneName: opt.sceneName })
      return {}
    }
  })

  NBaklava.registerNode("OBS", {
    type: "OBS:SetCurrentPreviewScene",
    title: "Set Preview Scene",
    inputs: { sceneName: { type: "string" } },
    // outputs: { sceneName: "string" },
    calculate: (opt) => {
      if (opt.sceneName)
        obs_ws.call("SetCurrentPreviewScene", { sceneName: opt.sceneName })
      return {}
    }
  })

  return {
    connect, disconnect, connected,
    setPreviewScene, setProgramScene, setStudioMode, setProfile, setSceneCollection,
    createOSCBotBrowserSource, removeOSCBotBrowserSource, OSCBotBrowserKeepOnAllScenes,
    preview,
    preview_img, program_img,
    data
  }
})
