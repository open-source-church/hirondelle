import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useHirondelle } from './hirondelle'

export const useMovePanZoom = defineStore('movePanZoom', () => {

  const H = useHirondelle()

  const throttleDelay = 40

  const setScaling = (view, pos, newScale) => {
    const point = [ pos.x / view.scaling - view.panning.x, pos.y / view.scaling - view.panning.y ]
    view.scaling = newScale
    const point2 = [ pos.x / view.scaling - view.panning.x, pos.y / view.scaling - view.panning.y ]
    view.panning.x += ~~(point2[0] - point[0])
    view.panning.y += ~~(point2[1] - point[1])
    view.lastPost = pos
  }

  const mouseWheel = (event, view) => {
    var speed = 1.5
    const p = { x: event.pageX, y: event.pageY }
    if(event.deltaY < 0) setScaling(view, p, view.scaling * speed)
    else setScaling(view, p, view.scaling / speed)
  }

  var pointersStart = []
  var pointersLast = []
  var pointerDistance
  var viewState
  var selecting = false
  const isMoving = ref(false)
  const _onPointerMove = (event, view) => {
    // Store mouse positions
    H.view.mouse = {x: event.pageX, y: event.pageY}

    if (pointersStart.length) isMoving.value = true
    pointersLast = pointersLast.filter(p => p.pointerId != event.pointerId)
    pointersLast.push(event)

    if (selecting && pointersStart.length == 1) {
      var left = Math.min(pointersStart[0].pageX, event.pageX)
      var top = Math.min(pointersStart[0].pageY, event.pageY)
      var right = Math.max(pointersStart[0].pageX, event.pageX)
      var bottom = Math.max(pointersStart[0].pageY, event.pageY)
      var width = Math.abs(pointersStart[0].pageX - event.pageX)
      var height = Math.abs(pointersStart[0].pageY - event.pageY)

      view.selection = {
        topLeft: view.to({ x: left, y: top - view.dimensions.top}),
        bottomRight: view.to({x: right, y: bottom - view.dimensions.top}),
        width: width / view.scaling,
        height: height / view.scaling
      }
      return
    } else if (selecting) {
      selecting = false
      view.selection = {}
    }

    // Mouse or one finger
    if (pointersStart.length == 1) {
      view.panning.x = ~~(viewState.panning.x - (pointersStart[0].pageX - event.pageX) / view.scaling)
      view.panning.y = ~~(viewState.panning.y - (pointersStart[0].pageY - event.pageY) / view.scaling)
    }
    // Two fingers
    if (pointersStart.length == 2) {
      // Pan
      view.panning.x = ~~(viewState.panning.x - (midPoint(...pointersStart).x - midPoint(...pointersLast).x) / view.scaling)
      view.panning.y = ~~(viewState.panning.y - (midPoint(...pointersStart).y - midPoint(...pointersLast).y) / view.scaling)
      // Zoom
      setScaling(view, midPoint(...pointersLast), viewState.scaling * distance(...pointersLast) / pointerDistance)
    }
  }
  const onPointerMove = _.throttle(_onPointerMove, throttleDelay)

  const midPoint = (event1, event2) => ({
    x: (event1.pageX + event2.pageX) / 2,
    y: (event1.pageY + event2.pageY) / 2
  })
  const distance = (event1, event2) => Math.sqrt((event1.pageX - event2.pageX)**2 + (event1.pageY - event2.pageY)**2 )

  const onPointerDown = (event, view) => {
    if (event.ctrlKey || event.shiftKey) selecting = true
    pointersStart.push(event)
    pointersLast.push(event)
    viewState = _.cloneDeep(view)
    if (pointersLast.length == 2) pointerDistance = distance(...pointersLast)
  }

  const onPointerUp = (event, view) => {
    // Clear stored positions
    pointersStart = pointersStart.filter(p => p.pointerId != event.pointerId)
    pointersLast = pointersLast.filter(p => p.pointerId != event.pointerId)
    // Clear selection
    selecting = false
    view.selection = {}
    // Return if mouse has moved
    var m = isMoving.value
    isMoving.value = false
    return m
  }

  // Moving objects
  var startingPos
  var movingObject
  var snap = 1
  const _move = (event, objs) => {
    if (!objs.length) return
    if (event.isFirst) startingPos = objs.map(obj => _.cloneDeep(obj.state))
    objs.forEach((obj, i) => {
      obj.state.x = ~~((startingPos[i].x + event.offset.x / H.view.scaling) / snap) * snap
      obj.state.y = ~~((startingPos[i].y + event.offset.y / H.view.scaling) / snap) * snap
    })
  }
  const move = _.throttle(_move, throttleDelay)

  return {
    mouseWheel, onPointerMove, onPointerDown, onPointerUp,
    move, isMoving
  }
})
