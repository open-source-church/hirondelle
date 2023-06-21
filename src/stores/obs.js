import { defineStore } from 'pinia'
import OBSWebSocket from 'obs-websocket-js'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'

export const useOBS = defineStore('obs', () => {

  const obs_ws = new OBSWebSocket()
  const connected = ref(false)
  const loading = ref(false)

  const preview_img = ref()
  const program_img = ref()
  const preview = ref(false)

  const _data = ref({}) // all data we get from OBS

  var OSCBotBrowserName = "OSCBotBrowser[TEMP]"
  const OSCBotBrowserKeepOnAllScenes = ref(true)

  const connect = async (url, password) => {
    disconnect()
    try {
      var r = await obs_ws.connect(url, password)
      console.log(`Connecté à websocket version ${r.obsWebSocketVersion} (avec RCP ${r.rpcVersion})`)
      connected.value = true
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
      for (const s of d.scenes) {
        // On recherche le bot sur la scene, et on récupère son item
        r = await obs_ws.call("GetSceneItemList", { sceneName: s.sceneName})
        var item = r.sceneItems.find(i => i.sourceName == OSCBotBrowserName)
        // Si c'est la scene en cours, on ajoute
        if (s.sceneName == d.currentPreviewSceneName || s.sceneName == d.currentProgramSceneName) {
          if (!item)
            var r = await obs_ws.call("CreateSceneItem", { sceneName: s.sceneName, sourceName: OSCBotBrowserName })
        }
        // Sinon on enlève
        else {
          if (item)
            await obs_ws.call("RemoveSceneItem", { sceneName: s.sceneName, sceneItemId: item.sceneItemId})
        }
      }
    }

    _data.value = d

    loading.value = false
  }

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

  const createOSCBotBrowserSource = async () => {
    var r = await obs_ws.call("CreateInput", {
      sceneName: data.value.previewScene,
      inputName: OSCBotBrowserName,
      inputKind: "browser_source",
      inputSettings: {
            "css": "body { background-color: rgba(0, 0, 0, 0) !important; margin: 0px auto; overflow: hidden; }",
            "is_local_file": false,
            "reroute_audio": false,
            "restart_when_active": false,
            "url": "http://localhost:9000/source/d9fd797a-f845-4c67-b67a-2debedfd345d",
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

  // Events
  // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#events
  var events_lists_to_watch = [
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
  events_lists_to_watch.forEach(e => obs_ws.on(e, getInfo))

  watch(connected, async () => {
    if (connected.value) {
      getInfo()
    }
  })

  watch(preview, val => val ? getScreenshot() : null)

  return {
    connect, disconnect, connected,
    setPreviewScene, setProgramScene, setStudioMode, setProfile, setSceneCollection,
    createOSCBotBrowserSource, removeOSCBotBrowserSource, OSCBotBrowserKeepOnAllScenes,
    preview,
    preview_img, program_img,
    data
  }
})
