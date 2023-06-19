import { defineStore } from 'pinia'
import OBSWebSocket from 'obs-websocket-js'
import { ref, computed, watch } from 'vue'

export const useOBS = defineStore('obs', () => {

  const obs = new OBSWebSocket()
  const connected = ref(false)

  const scenes = ref([])
  const video = ref({})
  const preview_name = computed(() => (scenes.value.find(s => s.preview) || {}).sceneName)
  const program_name = computed(() => (scenes.value.find(s => s.program) || {}).sceneName)
  const preview_img = ref()
  const program_img = ref()
  const preview = ref(false)
  const studio = ref()

  const connect = async (url, password) => {
    disconnect()
    try {
      var r = await obs.connect(url, password)
      console.log(`Connecté à websocket version ${r.obsWebSocketVersion} (avec RCP ${r.rpcVersion})`)
      connected.value = true
    }
    catch(error) {
      console.log(error)
      connected.value = false
    }
  }

  obs.on("ConnectionClosed", (v) => {
    console.log("ConnectionClosed", v)
    connected.value = false
  })

  const disconnect = async () => {
    await obs.disconnect()
    connected.value = false
  }

  const getInfo = async () => {
    // Scenes
    var r = await obs.call("GetSceneList")
    scenes.value = r.scenes
    scenes.value.forEach(s => {
      if (s.sceneName == r.currentPreviewSceneName) s.preview = true
      if (s.sceneName == r.currentProgramSceneName) s.program = true
    })
    scenes.value = scenes.value.sort((a, b) => b.sceneIndex - a.sceneIndex)

    // Video settings
    var r = await obs.call("GetVideoSettings")
    video.value = r
    video.value.ratio = r.baseWidth / r.baseHeight

    // Studio mode
    var r = await obs.call("GetStudioModeEnabled")
    studio.value = r.studioModeEnabled
  }

  const getScreenshot = async () => {
    var opt = {
      imageWidth: 600,
      imageHeight: 600 / video.value.ratio,
      imageFormat: "jpg",
      imageCompressionQuality: 50
    }
    if (studio.value) {
      var r = await obs.call("GetSourceScreenshot", {
        sourceName: preview_name.value, ...opt
      })
      preview_img.value = r.imageData
    }
    var r = await obs.call("GetSourceScreenshot", {
      sourceName: program_name.value, ...opt
    })
    program_img.value = r.imageData
    if (preview.value) setTimeout(getScreenshot, 50)
  }

  const setPreviewScene = async (name) => {
    obs.call("SetCurrentPreviewScene", { sceneName: name })
  }

  const setProgramScene = async (name) => {
    obs.call("SetCurrentProgramScene", { sceneName: name })
  }
  const setStudioMode = async (val = true) => {
    console.log("Setting studio mode", val)
    obs.call("SetStudioModeEnabled", { studioModeEnabled: val })
  }

  // Events
  // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#events
  obs.on("CurrentPreviewSceneChanged", getInfo)
  obs.on("CurrentProgramSceneChanged", getInfo)
  obs.on("StudioModeStateChanged", getInfo)
  obs.on("SceneListChanged", getInfo)
  obs.on("StreamStateChanged", getInfo)

  watch(connected, async () => {
    if (connected.value) {
      getInfo()
    }
  })

  watch(preview, val => val ? getScreenshot() : null)

  return {
    connect, disconnect, connected,
    scenes,
    setPreviewScene, setProgramScene, setStudioMode,
    preview_img, program_img, video, preview, studio
  }
})
