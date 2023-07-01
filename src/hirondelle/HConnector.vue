<template>
  <q-btn flat dense :icon="opt.multiple ? 'circle' : 'square'" :class="opt.classes"
      :color="opt.color" :size="opt.size" :style="opt.style"
      :data-port-type="portType" :data-port-class="portClass" :data-param-name="paramName"
      :data-port-condition="condition" :data-node-id="node.id" :data-param-type="param.type"
      :data-slot="slotName" :data-port-open="opt.multiple || !sources.length"
      @touchstart.stop
      @mousedown.stop="triggerConnection"
      :id="portId"
  >
    <q-tooltip v-if="param.type" :class="`bg-${H.paramTypes[param.type]?.color}-2 text-dark`">
      <span>{{ param.type }}</span>
      <span v-if="opt.multiple"> (multiple)</span>
      <span v-else> (unique)</span>
      <!-- <span>Connections: {{ sources.length }}</span> -->
      <!-- <span> [{{portId}}]</span> -->
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
  paramName: { type: String },
  condition: { type: Boolean },
  slotName: { type: String }
})

const node = computed(() => props.node)

const portId = computed(() => {
  var id = `port-${props.node.id}-${props.portType}-${props.portClass}`
  if (props.paramName) id += `-${props.paramName}`
  if (props.portClass == "condition") id += `-${props.condition}`
  if (props.slotName) id += `-${props.slotName}`
  return id
})

const param = computed(() => props.node[props.portType+"s"]?.[props.paramName] || {})

// La list des connections vers ce connector
const sources = computed(() => {
  return props.node.graph.connections.filter(c =>
  c[props.portType == "input" ? "to" : "from"].id == props.node.id &&
  c[props.portType] == props.paramName &&
  c.type == props.portClass &&
  c.slot == props.slotName)
})

const opt = computed(() => {
  var opt = {}
  // Slots
  if (props.portClass == "main" && props.slotName) {
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
    if (props.portType == "input") {
      opt.classes = "absolute-top-left"
      opt.style = "left:-12px; top: 5px;"
    }
  }
  // Main
  else if (props.portClass == "main") {
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
    if (props.portType == "input") {
      opt.classes = "absolute-top-left"
      opt.style = "left: -12px; top: 10px;"
    }
    else if (props.portType == "output" && props.portClass == "main") {
      opt.classes = "absolute-top-right"
      opt.style = "right: -11px; top: 12px;"
    }
  }
  // Group
  else if (props.portClass == "group") {
    opt.color = "green"
    opt.multiple = true
  }
  // Param
  else if (props.portClass == "param") {
    opt.color = H.paramTypes[param.value.type]?.color
    opt.size = "xs"
    if (props.portType == "input") {
      opt.classes = "absolute-top-left"
      opt.style = "left:-9px; top: 14px;"
      opt.multiple = param.value.array
    }
    else if (props.portType == "output") {
      opt.classes = "absolute-top-right"
      opt.style = "right:-10px; top: 12px"
      opt.multiple = true
    }
  }
  // Conditions
  else if (props.portType == "output" && props.portClass == "condition") {
    opt.classes = "absolute"
    opt.style = props.condition ? "right:-12px; top: 6px" : "right:-12px; top: 28px"
    opt.color = props.condition ? "green" : "red"
    opt.size = "sm"
    opt.multiple = true
  }
  return opt
})

const triggerConnection = e => {
  if (props.portType == "output")
    startConnection({
      type:props.portClass,
      condition:props.condition,
      paramFromName: props.paramName,
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

const startConnection = ({type="main", paramFromName=null, condition=null, event}) => {
  var startPos = { x: event.pageX, y: event.pageY}
  var paramType = param.value.type

  // On ajoute une connection temporaire
  var temporaryConnection = ref(node.value.graph.addConnection({
    from: { state: node.value.graph.view.to(startPos)},
    to: { state: node.value.graph.view.to(startPos)},
    type: "temporary"
  }))

  const updateConnection = (event) => {
    let view = node.value.graph.view
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
    else if (nodeId && nodeId == node.value.id) return false
    else if (portClass && portOpen == "false") return false
    else if (type != "condition" && portClass && portClass != type) return false
    else if (type == "condition" && portClass && portClass != "main") return false
    else if (type == "main" && portClass && portClass == type) return true
    else if (type == "condition" && portClass && portClass == "main") return true
    else if (type == "param" && toParamType) return (paramType == toParamType) || toParamType == "*"
    else return undefined
  }

  addEventListener("mousemove", updateConnection)

  addEventListener("mouseup", (event) => {
    var t = event.target
    var portType = findAttribute(t, "data-port-type")
    var portClass = findAttribute(t, "data-port-class")
    var paramToName = findAttribute(t, "data-param-name")
    var toParamType = findAttribute(t, "data-param-type")
    var nodeId = findAttribute(t, "data-node-id")
    var slot = findAttribute(t, "data-slot")
    var portOpen = findAttribute(t, "data-port-open")

    if (isValid(portType, portClass, toParamType, nodeId, portOpen)) {
      // Main
      if (type == "main") { // main connection

        console.log("CONNECTION", node.value.id, nodeId, slot)
        node.value.graph.addConnection({from: node.value.id, to: nodeId, slot: slot})
      }
      else if (type == "param" ) {
        node.value.graph.addConnection({type: type,
          from: node.value.id, output: paramFromName,
          to:nodeId, input: paramToName
        })
      }
      else if (type == "condition" ) {
        node.value.graph.addConnection({from: node.value.id, to: nodeId, type: type, condition: condition})
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
      else if (type == "group" ) {
        console.log(type, portType, portClass, paramToName)
        if (portClass == "main")
          node.value.graph.addConnection({from: node.value.id, to: nodeId})
        else if (portClass == "param")
          node.value.graph.addConnection({type: "param",
            from: node.value.id, output: paramToName,
            to:nodeId, input: paramToName
          })
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
    }
    removeEventListener("mousemove", updateConnection)
    node.value.graph.removeTemporaryConnection()
  }, { once: true});

}

</script>

<style lang="scss">


</style>
