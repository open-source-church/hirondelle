<template>
  <q-btn flat dense :icon="opt.multiple ? 'circle' : 'square'" :class="opt.classes"
      :color="opt.color" :size="opt.size" :style="opt.style"
      :data-port-type="portType" :data-port-class="portClass" :data-param-name="paramName"
      :data-port-condition="condition" :data-node-id="node.id" :data-param-type="param.type"
      @touchstart.stop
      @mousedown.stop="triggerConnection"
      :id="portId"
  >
    <q-tooltip v-if="param.type" :class="`bg-${H.paramTypes[param.type]?.color}-2 text-dark`">
      {{ param.type }}
      <span v-if="param.array"> (Multiple)</span>
    </q-tooltip>
  </q-btn>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useHirondelle } from './hirondelle';

const H = useHirondelle()

const props = defineProps({
  portType: { type: String, required: true },
  portClass: { type: String, required: true },
  node: { type: Object, required: true },
  paramName: { type: String },
  condition: { type: Boolean },
})

const node = computed(() => props.node)

const portId = computed(() => {
  var id = `port-${props.node.id}-${props.portType}-${props.portClass}`
  if (props.paramName) id += `-${props.paramName}`
  if (props.condition) id += `-${props.condition}`
  return id
})

const param = computed(() => props.node[props.portType+"s"]?.[props.paramName] || {})

const opt = computed(() => {
  var opt = {}
  if (props.portType == "input" && props.portClass == "main") {
    opt.classes = "absolute-top-left"
    opt.style = "left: -12px; top: 10px;"
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
  }
  else if (props.portType == "output" && props.portClass == "main") {
    opt.classes = "absolute-top-right"
    opt.style = "right: -11px; top: 12px;"
    opt.color = "green"
    opt.size = "sm"
    opt.multiple = true
  }
  if (props.portType == "input" && props.portClass == "group") {
    opt.color = "green"
    opt.multiple = true
  }
  else if (props.portType == "output" && props.portClass == "group") {
    opt.color = "green"
    opt.multiple = true
  }
  else if (props.portType == "input" && props.portClass == "param") {
    opt.classes = "absolute-top-left"
    opt.style = "left:-9px; top: 20px;"
    opt.color = H.paramTypes[param.value.type]?.color
    opt.size = "xs"
    opt.multiple = param.value.array
  }
  else if (props.portType == "output" && props.portClass == "param") {
    opt.classes = "absolute-top-right"
    opt.style = "right:-10px; top: 20px"
    opt.color = H.paramTypes[param.value.type]?.color
    opt.size = "xs"
    opt.multiple = true
  }
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

    var valid = isValid(portType, portClass, toParamType, nodeId)
    if (valid == undefined) delete temporaryConnection.value.valid
    else temporaryConnection.value.valid = valid
  }

  const isValid = (portType, portClass, toParamType, nodeId) => {
    if (portType && portType != "input") return false
    else if (nodeId && nodeId == node.value.id) return false
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

    if (isValid(portType, portClass, toParamType, nodeId)) {
      // Main
      if (type == "main") { // main connection
        console.log("CONNECTION", node.value.id, nodeId)
        node.value.graph.addConnection({from: node.value.id, to: nodeId})
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
