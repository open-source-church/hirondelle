<template>
  <q-btn flat dense :icon="opt.multiple ? 'circle' : 'square'" :class="opt.classes"
      :color="opt.color" :size="opt.size" :style="opt.style"
      :data-port-type="portType" :data-port-class="portClass" :data-param-id="paramId"
      :data-node-id="node.id" :data-param-type="param?.type"
      :data-slot="slotName" :data-signal="signal"
      :data-port-open="opt.multiple || sources.length == 0"
      @touchstart.stop
      @mousedown.stop="triggerConnection"
      :id="id"
  >
  <!-- v-if="param?.type" -->
    <q-tooltip  :class="`bg-${H.varTypes[param?.type]?.color}-2 text-dark`">
      <span>{{ param?.type }}</span>
      <span v-if="opt.multiple"> (multiple)</span>
      <span v-else> (unique)</span>
      <!-- <span>Connections: {{ sources.length }}</span> -->
      <span> [{{id}}]</span> {{ sources.length }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useHirondelle } from './hirondelle'
import _ from "lodash"

const H = useHirondelle()

const props = defineProps({
  portType: { type: String, required: true },
  portClass: { type: String, required: true },
  node: { type: Object, required: true },
  paramId: { type: String },
  slotName: { type: String },
  signal: { type: String }
})

const node = computed(() => props.node)

const id = computed(() => {
  var id = `port-${props.node.id}-${props.portType}-${props.portClass}`
  if (props.paramId) id += `-${props.paramId}`
  if (props.slotName) id += `-${props.slotName}`
  if (props.signal) id += `-${props.signal}`
  return id
})

const param = computed(() => props.node.findParam(props.paramId))

// La list des connections vers ce connector
const sources = computed(() => {
  if (props.portType == "input")
    return props.node.connectionsTo.filter(c => c.type == "param" && c.input?.id == props.paramId)
  else
    return props.node.connectionsFrom.filter(c => c.type == "param" && c.output?.id == props.paramId)
  return props.node.graph.connections.filter(c => c.input?.id == props.paramId && c.type != "clone")
})

const opt = computed(() => {
  var opt = {}
  opt.classes = "q-pa-sm "
  // Slots
  if (props.portClass == "flow" && props.slotName) {
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
    if (props.portType == "input") {
      opt.classes += "absolute-top-left"
      opt.style = "left:-16px; top: 0px;"
    }
  }
  // Signals
  else if (props.portClass == "flow" && props.signal) {
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
    if (props.portType == "output") {
      opt.classes += "absolute-top-right"
      opt.style = "right:-16px; top: 0px;"
    }
  }
  // Main
  else if (props.portClass == "flow") {
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
    if (props.portType == "input") {
      opt.classes += "absolute-top-left"
      opt.style = "left: -17px; top: 4px;"
    }
    else if (props.portType == "output" && props.portClass == "flow") {
      opt.classes += "absolute-top-right"
      opt.style = "right: -16px; top: 4px;"
    }
  }
  // Group
  else if (props.portClass == "group") {
    opt.color = "green"
    opt.multiple = true
  }
  // Param
  else if (props.portClass == "param") {
    opt.color = H.varTypes[param.value?.type]?.color
    opt.size = "xs"
    if (props.portType == "input") {
      opt.classes += "absolute-top-left"
      opt.style = "left:-15px; top: 9px;"
      opt.multiple = param.value.array
    }
    else if (props.portType == "output") {
      opt.classes += "absolute-top-right"
      opt.style = "right:-15px; top: 9px"
      opt.multiple = true
    }
  }
  return opt
})

const triggerConnection = e => {
  if (props.portType == "output")
    startConnection({
      type:props.portClass,
      fromParamId: props.paramId,
      event: e})
}

const findAttribute = (n, attr) => {
  while(n) {
    try {
      if(n.getAttribute(attr)) return n.getAttribute(attr)
    } catch {}
    n = n.parentNode
  }
}

const startConnection = ({type="flow", fromParamId=null, event}) => {
  var startPos = { x: event.pageX, y: event.pageY}
  var paramType = param.value?.type

  // On ajoute une connection temporaire
  var temporaryConnection = ref(node.value.graph.addConnection({
    from: { state: H.view.to(startPos)},
    to: { state: H.view.to(startPos)},
    type: "temporary"
  }))

  const updateConnection = (event) => {
    let view = H.view
    temporaryConnection.value.to.state = view.to({x: event.pageX, y: event.pageY})
    var portType = findAttribute(event.target, "data-port-type")
    var toParamType = findAttribute(event.target, "data-param-type")
    var portClass = findAttribute(event.target, "data-port-class")
    var nodeId = findAttribute(event.target, "data-node-id")
    var portOpen = findAttribute(event.target, "data-port-open")

    var valid = isValid(portType, portClass, toParamType, nodeId, portOpen)
    if (valid == undefined) delete temporaryConnection.value.valid
    else temporaryConnection.value.valid = valid
  }

  const isValid = (portType, portClass, toParamType, nodeId, portOpen) => {
    if (portType && portType != "input") return false
    else if (portClass && nodeId && nodeId == node.value.id) return false
    else if (portClass && portOpen == "false" && type != "group") return false
    else if (portClass && (type == "group" || portClass == "group")) return true
    else if (portClass && portClass != type) return false
    else if (type == "flow" && portClass && portClass == type) return true
    else if (type == "param" && toParamType) return (paramType == toParamType) || toParamType == "*"
    else return undefined
  }

  addEventListener("mousemove", updateConnection)

  addEventListener("mouseup", (event) => {
    var t = event.target
    var portType = findAttribute(t, "data-port-type")
    var portClass = findAttribute(t, "data-port-class")
    var toParamId = findAttribute(t, "data-param-id")
    var toParamType = findAttribute(t, "data-param-type")
    var nodeId = findAttribute(t, "data-node-id")
    var slot = findAttribute(t, "data-slot")
    var portOpen = findAttribute(t, "data-port-open")

    if (isValid(portType, portClass, toParamType, nodeId, portOpen)) {
      // Main
      if (type == "flow") { // main connection
        console.log("CONNECTION", node.value.id, nodeId, slot, props.signal)
        node.value.graph.addConnection({from: node.value.id, to: nodeId, slot, signal: props.signal})
      }
      else if (type == "group") {
        console.log(type, portType, portClass, toParamId)
        if (portClass == "flow")
          node.value.graph.addConnection({from: node.value.id, to: nodeId, slot})
        else if (portClass == "param")
          node.value.graph.addConnection({
            type: "clone",
            from: node.value.id,
            to:nodeId, input: toParamId
        })
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
      else if (type == "param" ) {
        if (portClass == "group") {
          node.value.graph.addConnection({
            type: "clone",
            from: node.value.id, output: fromParamId,
            to:nodeId
          })
        }
        else {
          node.value.graph.addConnection({
            type: type,
            from: node.value.id, output: fromParamId,
            to:nodeId, input: toParamId
          })
        }
      }
    }
    removeEventListener("mousemove", updateConnection)
    node.value.graph.removeTemporaryConnection()
  }, { once: true});

}

</script>

<style lang="scss">


</style>
