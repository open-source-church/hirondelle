<template>
  <q-btn flat round dense icon="circle" :class="opt.classes"
      :color="opt.color" :size="opt.size" :style="opt.style"
      :data-port-type="portType" :data-port-class="portClass" :data-param-name="param"
      :data-port-condition="condition" :data-node-id="node.id"
      @touchstart.stop
      @mousedown.stop="triggerConnection"
      :id="portId"
  >
  </q-btn>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'

const props = defineProps({
  portType: { type: String, required: true },
  portClass: { type: String, required: true },
  node: { type: Object, required: true },
  param: { type: String },
  condition: { type: Boolean },
})

const node = computed(() => props.node)

const portId = computed(() => {
  var id = `port-${props.node.id}-${props.portType}-${props.portClass}`
  if (props.param) id += `-${props.param}`
  if (props.condition) id += `-${props.condition}`
  return id
})

const opt = computed(() => {
  var opt = {}
  if (props.portType == "input" && props.portClass == "main") {
    opt.classes = "absolute-top-left"
    opt.style = "left: -12px; top: 10px;"
    opt.color = "green"
    opt.size = "sm"
  }
  else if (props.portType == "output" && props.portClass == "main") {
    opt.classes = "absolute-top-right"
    opt.style = "right: -11px; top: 12px;"
    opt.color = "green"
    opt.size = "sm"
  }
  if (props.portType == "input" && props.portClass == "group") {
    opt.color = "green"
  }
  else if (props.portType == "output" && props.portClass == "group") {
    opt.color = "green"
  }
  else if (props.portType == "input" && props.portClass == "param") {
    opt.classes = "absolute-top-left"
    opt.style = "left:-9px; top: 20px;"
    opt.color = "grey"
    opt.size = "xs"
  }
  else if (props.portType == "output" && props.portClass == "param") {
    opt.classes = "absolute-top-right"
    opt.style = "right:-10px; top: 20px"
    opt.color = "grey"
    opt.size = "xs"
  }
  else if (props.portType == "output" && props.portClass == "condition") {
    opt.classes = "absolute"
    opt.style = props.condition ? "right:-12px; top: 6px" : "right:-12px; top: 28px"
    opt.color = props.condition ? "green" : "red"
    opt.size = "sm"
  }
  return opt
})

const triggerConnection = e => {
  if (props.portType == "output")
    startConnection({type:props.portClass, condition:props.condition, param: props.param, event: e})
}

const findAttribute = (n, attr) => {
  while(n) {
    try {
      if(n.getAttribute(attr)) return n.getAttribute(attr)
    } catch {}
    n = n.parentNode
  }
}

var temporaryConnection = ref()
const updateConnection = (event) => {
  let view = node.value.graph.view
  temporaryConnection.value.to.state = view.to({x: event.pageX, y: event.pageY - 88})
}
var startPos = {}
const startConnection = ({type="main", param=null, condition=null, event}) => {
  startPos = { x: event.pageX, y: event.pageY - 88}

  // On ajoute une connection temporaire
  temporaryConnection.value = node.value.graph.addConnection({
    from: { state: node.value.graph.view.to(startPos)},
    to: { state: node.value.graph.view.to(startPos)},
    type: "temporary"
  })
  addEventListener("mousemove", updateConnection)

  addEventListener("mouseup", (event) => {
    var t = event.target
    var portType = findAttribute(t, "data-port-type")
    var portClass = findAttribute(t, "data-port-class")
    var paramName = findAttribute(t, "data-param-name")
    var nodeId = findAttribute(t, "data-node-id")
    if (nodeId && nodeId != node.value.id) {
      if (type == "main") { // main connection
        console.log("CONNECTION", node.value.id, nodeId)
        node.value.graph.addConnection({from: node.value.id, to: nodeId})
      }
      else if (type == "param" ) {
        node.value.graph.addConnection({type: type,
          from: node.value.id, output: param,
          to:nodeId, input: paramName
        })
      }
      else if (type == "condition" ) {
        node.value.graph.addConnection({from: node.value.id, to: nodeId, type: type, condition: condition})
        // node.value.graph.addParamConnection(node.value.id, param, nodeId, param_name)
      }
      else if (type == "group" ) {
        console.log(type, portType, portClass, paramName)
        if (portClass == "main")
          node.value.graph.addConnection({from: node.value.id, to: nodeId})
        else if (portClass == "param")
          node.value.graph.addConnection({type: "param",
            from: node.value.id, output: paramName,
            to:nodeId, input: paramName
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
