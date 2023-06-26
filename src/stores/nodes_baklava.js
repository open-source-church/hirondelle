import { defineStore } from 'pinia'
import { ref, computed, watch, markRaw } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard } from 'quasar'

import { defineNode, NodeInterface, TextInputInterface, CheckboxInterface, IntegerInterface, SelectInterface } from "baklavajs";
import DisplayInterface from "../components/nodes/interfaces/DisplayInterface.vue"
import InputInterface from "../components/nodes/interfaces/InputInterface.vue"

export const useNodesBaklava = defineStore('nodes', () => {

  const $q = useQuasar()

  const nodes = ref([])

  const registerNode = (source, opt) => {

    // On map les interfaces
    if (!opt.inputs) opt.inputs = []
    if (!opt.outputs) opt.outputs = []
    var both = ["inputs", "outputs"]
    both.forEach(type =>
      Object.keys(opt[type]).forEach(k => {
        let intf = opt[type][k]
        // console.log(" * ", k, typeof(intf), typeof(intf) == "object" ? intf.type : intf)
        // String nodes
        if (typeof(intf) == "string" && intf == "string")
          opt[type][k] = () => new NodeInterface(k).setComponent(markRaw(InputInterface))
        else if (typeof(intf) == "object" && intf.type == "string") {
          opt[type][k] = () => new NodeInterface(intf.title || k, intf.default).setComponent(markRaw(InputInterface)).setPort(!(intf.port == false))
          opt.customData = intf.options
        }
        // Integer
        else if (typeof(intf) == "string" && intf == "integer")
          opt[type][k] = () => new IntegerInterface(k)
        else if (typeof(intf) == "object" && intf.type == "integer") {
          opt[type][k] = () => new IntegerInterface(intf.title || k, intf.default).setPort(!(intf.port == false))
          opt.customData = intf.options
        }

        // Display node
        else if (typeof(intf) == "object" && intf.type == "display") {
          opt[type][k] = () => new NodeInterface(intf.title || k, intf.default).setComponent(markRaw(DisplayInterface)).setPort(!(intf.port == false))
          opt.customData = intf.options
        }
        // Dans le doute
        else {
          opt[type][k] = () => new NodeInterface(k)
        }

      })
    )
    // opt.inputs.start = () => new CheckboxInterface("start")
    const n = defineNode(opt)
    n.start = () => console.log("Coucou, je suis rajouté")
    var category = nodes.value.find(c => c.source == source)
    if (category) category.nodes.push(n)
    else nodes.value.push({
      source: source,
      nodes: [n]
    })
  }

  const engine = {
    editor: null,
    setEditor(editor) {
      this.editor = editor
    },
    connections_from(nodeId) {
      return this.editor.graph._connections.filter(c => c.from.nodeId == nodeId)
    },
    connections_to(nodeId) {
      return this.editor.graph._connections.filter(c => c.to.nodeId == nodeId)
    },
    nodes() {
      return this.editor.graph._nodes
    },
    node(nodeId) {
      return this.nodes().find(n => n.id == nodeId)
    },
    async run() {
      console.log("NODES", this.editor.graph._nodes)
      console.log("CONNECTIONS", this.editor.graph._connections)
      this.nodes().forEach(n => {
        console.log(n.title)
        console.log(" * Connections from:", this.connections_from(n.id).map(c => this.node(c.from.nodeId)))
        console.log("   Connections to:", this.connections_to(n.id).map(c => this.node(c.to.nodeId)))
      })
    }
  }


  return {
    nodes, registerNode, engine
  }
})


const myNode = defineNode({
  type: "MyNode",
  inputs: {
      number1: () => new IntegerInterface("Number", 1),
      number2: () => new IntegerInterface("Number", 10),
      operation: () => new SelectInterface("Operation", "Add", ["Add", "Subtract"]).setPort(false),
  },
  outputs: {
      output: () => new NodeInterface("Output", 0),
  },
  calculate: ({ number1, number2, operation }) => {
      let output;
      if (operation === "Add") {
          output = number1 + number2;
      } else if (operation === "Subtract") {
          output = number1 - number2;
      } else {
          throw new Error("Unknown operation: " + operation);
      }
      return { output };
  },
})
