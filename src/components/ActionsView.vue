<template>
  <div class="row q-col-gutter-md">
    <div class="col-4">
      <q-card >
        <q-card-section class="bg-secondary text-dark">
          Actions List
          <q-btn flat icon="tune" class="absolute-right" @click="show_filters = !show_filters"/>
        </q-card-section>
        <q-card-section class="row q-col-gutter-md q-pa-sm" v-if="show_filters">
          <q-select class="col" dense filled label="Source" clearable v-model="filter_source" :options="_.uniq(A.actions.map(a => a.source))" />
          <q-select class="col" dense filled label="Type" clearable v-model="filter_type" :options="['Triggers', 'Actions']" />
          <q-input class="col-12" dense filled label="txt" clearable v-model="filter_txt" />
        </q-card-section>
        <q-list bordered separator class="col-4">
          <q-expansion-item v-for="a in filtered_actions" :key="a.signature()" switch-toggle-side
            :draggable="a.callback != null || a.triggers.length != 0"  @dragstart="onDragStart" :id="a.signature()">
            <template v-slot:header>
              <q-item-section>
                <q-item-label>
                  <q-chip size="sm" square class="q-pa-xs bg-accent">
                    <q-badge v-if="!a.active" floating color="red" />
                    {{ a.source }}
                  </q-chip>
                  {{ a.name }}
                  <q-chip v-if="!a.callback && !a.triggers.length" size="sm" square class="q-pa-xs bg-secondary text-dark" >Trigger</q-chip>
                  <q-chip v-if="a.triggers.length" size="sm" square class="q-pa-xs bg-primary text-dark" >{{ a.triggers.length }}</q-chip>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat dense icon="edit" @click.stop="action = A.actions.find(act => act.signature() == a.signature())"/>
              </q-item-section>
            </template>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ a.description }}</q-item-label>
                <q-item-label caption v-if="a.params"> Paramètres:
                  <q-chip size="sm" square v-for="p in a.params" :key="p.name" class="bg-grey-9">
                    {{ p.name }}
                    <q-tooltip>{{ p.description }}
                      <span v-if="p.options">Parmis: {{ p.options.join(", ") }}</span>
                    </q-tooltip>
                  </q-chip>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-expansion-item>
        </q-list>
      </q-card>
    </div>
    <div class="col-8">
      <q-card >
        <q-card-section class="bg-secondary text-dark">
          Créer des actions
          <q-btn icon="add" class="absolute-right" color="accent" @click="create_action()" />
        </q-card-section>
        <q-card-section class="row q-pa-sm q-gutter-sm" v-if="action" >
          <q-input class="col-10" :readonly="action.source != 'User'" filled dense label="Nom" v-model="action.name"/>
          <q-btn class="col" v-if="action.source == 'User'" icon="delete" color="negative"
            @click = "A.actions = A.actions.filter(a => a!= action)" />

          <q-input class="col-10" :readonly="action.source != 'User'" filled dense label="Description" v-model="action.description"/>
          <q-btn class="col" v-if="action.source == 'User'" icon="play_circle_filled" color="positive"
            @click = "action.start()" />

          <div class="col-12 text-subtitle2">Params</div>

          <q-chip square v-for="p in action.params" :key="p.name" class="bg-grey-9">
            {{ p.name }}
            <q-tooltip>{{ p.description }}
              <span v-if="p.options">Parmi: {{ p.options.join(", ") }}</span>
            </q-tooltip>
          </q-chip>

          <div class="col-12" v-if="action.source == 'User'"  >
            <q-list >
              <q-item v-for="p in action.params" :key="p.name">
                <q-item-section>
                  <q-item-label>
                    <q-input dense filled label="Name" v-model="p.name" />
                  </q-item-label>
                  <q-item-label>
                    <q-input dense filled label="description" v-model="p.description" />
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <q-btn flat color="accent" icon="add" label="Ajouter un paramètre"
              @click="action.params.push({ name: 'param' })"/>
          </div>

          <!-- Sequence -->
          <div class="col-12 text-subtitle2">Séquence</div>
          <div class="col-12">
            <q-list bordered separator
              @dragenter="onDragEnter" @dragleave="onDragLeave" @dragover="onDragOver" @drop="onDrop" >
              <q-item class="text-center" v-if="!action.triggers || !action.triggers.length">
                <q-item-section>Drag and drop depuis la liste des actions</q-item-section>
              </q-item>
              <q-expansion-item v-for="(t, i) in action.triggers" :key="i">
                <template v-slot:header>
                  <q-item-section>
                    <q-item-label>
                      <q-chip size="sm" square class="q-pa-xs bg-accent">
                        <q-badge v-if="!t.target.active" floating color="red" />
                        {{ t.target.source }}
                      </q-chip>
                      {{ t.target.name }}
                    </q-item-label>
                  </q-item-section>
                  <q-btn icon="delete" color="negative" flat
                  @click.stop="action.triggers = action.triggers.filter(_t => _t != t)"/>
                </template>
                <div class="">
                  <q-list >
                    <q-item v-for="p in t.target.params" :key="p.name">
                      <q-item-section>
                        <q-item-label>{{ p.name }}</q-item-label>
                        <q-item-label caption>{{ p.description }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <div class="row">
                          <q-input filled dense v-model="t.params[p.name]" />
                          <q-btn-dropdown v-if="p.options" >
                            <q-list>
                              <q-item clickable v-for="(o, i) in p.options" :key="o+i"
                                @click="t.params[p.name] = o" v-close-popup
                              >{{ o }}</q-item>
                            </q-list>
                          </q-btn-dropdown>
                        </div>
                      </q-item-section>
                    </q-item>
                  </q-list>
                  </div>
              </q-expansion-item>
            </q-list>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import { usePeer } from 'stores/peer'
import { useIcons } from 'stores/material_icons'
import { useTwitch } from 'stores/twitch'
import _ from 'lodash'
import { useActions } from 'stores/actions'

const $q = useQuasar()
const A = useActions()

// Edit actions
const action = ref()
const create_action = () => {
  var a = A.register_action({
    name: "Action sans nom",
    source: "User"
  })
  action.value = a
}

const onDragStart = (e) => {
  e.dataTransfer.setData('signature', e.target.id)
  e.dataTransfer.dropEffect = 'move'
}
const onDragEnter = (e) => e.target.classList.add("drag-enter")
const onDragLeave = (e) => e.target.classList.remove("drag-enter")
const onDragOver = (e) => e.preventDefault()
const onDrop = (e) => {
  e.target.classList.remove('drag-enter')
  var s = e.dataTransfer.getData('signature')
  var act = A.actions.find(a => a.signature() == s)
  action.value.triggers.push({
    target: act,
    params: {}
  })
}



// Filter actions
const filter_source = ref("")
const filter_type = ref("")
const filter_txt = ref("")
const show_filters = ref(false)

const filtered_actions = computed(() => {
  var actions = A.actions
  if (filter_source.value) actions = actions.filter(a => a.source == filter_source.value)
  if (filter_type.value == "Triggers") actions = actions.filter(a => !a.callback)
  if (filter_type.value == "Actions") actions = actions.filter(a => a.callback)
  if (filter_txt.value) {
    var f_txt = filter_txt.value.toLowerCase()
    actions = actions.filter(a => JSON.stringify(a).toLowerCase().includes(f_txt))
  }
  return actions
})

</script>

<style scoped>
.drag-enter {
  outline-style: dashed
}
</style>
