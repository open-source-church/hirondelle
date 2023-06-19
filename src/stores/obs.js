import { defineStore } from 'pinia'
import OBSWebSocket from 'obs-websocket-js'
import { ref, computed, watch } from 'vue'

export const useOBS = defineStore('obs', () => {

  const obs = new OBSWebSocket()
  const connected = ref(false)

  const scenes = ref([])

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

  const getSceneList = async () => {
    var r = await obs.call("GetSceneList")
    console.log(r)

    scenes.value = r.scenes
    scenes.value.forEach(s => {
      if (s.sceneName == r.currentPreviewSceneName) s.preview = true
      if (s.sceneName == r.currentProgramSceneName) s.program = true
    })
    scenes.value = scenes.value.sort((a, b) => b.sceneIndex - a.sceneIndex)
  }

  const setPreviewScene = async (name) => {
    obs.call("SetCurrentPreviewScene", { sceneName: name })
  }

  const setProgramScene = async (name) => {
    obs.call("SetCurrentProgramScene", { sceneName: name })
  }

  // Events
  // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#events
  obs.on("CurrentPreviewSceneChanged", getSceneList)
  obs.on("CurrentProgramSceneChanged", getSceneList)
  obs.on("SceneListChanged", (v) => console.log("SceneListChanged", v))
  obs.on("StreamStateChanged", getSceneList)

  watch(connected, async () => {
    if (connected.value) {
      getSceneList()

      var r = await obs.call("GetOutputList")
      console.log(r)

    }
  })

  return {
    connect, disconnect, connected,
    scenes,
    setPreviewScene, setProgramScene
  }
})
