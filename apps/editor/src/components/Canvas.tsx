import { UpdateElementCommand, UpdateElementsCommand, type ElementNode } from '@ppht/core'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { SLIDE_HEIGHT, SLIDE_WIDTH, SlideView, type SlideElementFrame } from './SlideView'

type DragState = {
  elements: Array<{
    elementId: string
    originX: number
    originY: number
  }>
  pointerX: number
  pointerY: number
  deltaX: number
  deltaY: number
}

type MarqueeState = {
  originX: number
  originY: number
  currentX: number
  currentY: number
}

type MarqueeRect = {
  left: number
  top: number
  width: number
  height: number
}

function marqueeRect(marquee: MarqueeState): MarqueeRect {
  const left = Math.min(marquee.originX, marquee.currentX)
  const top = Math.min(marquee.originY, marquee.currentY)

  return {
    left,
    top,
    width: Math.abs(marquee.currentX - marquee.originX),
    height: Math.abs(marquee.currentY - marquee.originY)
  }
}

function elementIntersectsRect(element: ElementNode, rect: MarqueeRect): boolean {
  const elementRight = element.x + element.width
  const elementBottom = element.y + element.height
  const rectRight = rect.left + rect.width
  const rectBottom = rect.top + rect.height

  return element.x < rectRight && elementRight > rect.left && element.y < rectBottom && elementBottom > rect.top
}

export function Canvas() {
  const slide = useEditorStore((state) => state.currentSlide())
  const zoom = useEditorStore((state) => state.zoom)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectElement = useEditorStore((state) => state.selectElement)
  const selectElements = useEditorStore((state) => state.selectElements)
  const runCommand = useEditorStore((state) => state.runCommand)
  const [drag, setDrag] = useState<DragState>()
  const [marquee, setMarquee] = useState<MarqueeState>()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(zoom)

  useEffect(() => {
    const viewport = viewportRef.current

    if (viewport === null || typeof ResizeObserver === 'undefined') {
      setFitScale(zoom)
      return
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect

      if (rect === undefined || rect.width <= 0 || rect.height <= 0) {
        return
      }

      setFitScale(Math.min(rect.width / SLIDE_WIDTH, rect.height / SLIDE_HEIGHT))
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [zoom])

  if (slide === undefined) {
    return (
      <div className="canvas-empty" role="status">
        No slide selected
      </div>
    )
  }

  const activeSlide = slide
  const safeScale = fitScale > 0 ? fitScale : 1

  function slidePoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()

    return {
      x: Math.round((event.clientX - rect.left) / safeScale),
      y: Math.round((event.clientY - rect.top) / safeScale)
    }
  }

  function handleElementPointerDown(event: PointerEvent<HTMLDivElement>, element: ElementNode) {
    event.stopPropagation()
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    const wasSelected = selectedElementIds.includes(element.id)
    const currentSelection = additive
      ? wasSelected
        ? selectedElementIds.filter((selectedId) => selectedId !== element.id)
        : [...selectedElementIds, element.id]
      : wasSelected
        ? selectedElementIds
        : [element.id]

    selectElement(element.id, { additive })

    if (element.locked || (additive && wasSelected)) {
      return
    }

    const draggableElements = activeSlide.elements.filter((item) => currentSelection.includes(item.id) && !item.locked)

    if (draggableElements.length === 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      elements: draggableElements.map((item) => ({
        elementId: item.id,
        originX: item.x,
        originY: item.y
      })),
      pointerX: event.clientX,
      pointerY: event.clientY,
      deltaX: 0,
      deltaY: 0
    })
  }

  function handleElementPointerMove(event: PointerEvent<HTMLDivElement>) {
    setDrag((current) => {
      if (current === undefined) {
        return current
      }

      const safeZoom = fitScale > 0 ? fitScale : 1
      return {
        ...current,
        deltaX: Math.round((event.clientX - current.pointerX) / safeZoom),
        deltaY: Math.round((event.clientY - current.pointerY) / safeZoom)
      }
    })
  }

  function handleSlidePointerDown(event: PointerEvent<HTMLDivElement>) {
    const point = slidePoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    selectElements([])
    setMarquee({
      originX: point.x,
      originY: point.y,
      currentX: point.x,
      currentY: point.y
    })
  }

  function handleSlidePointerMove(event: PointerEvent<HTMLDivElement>) {
    const point = slidePoint(event)
    setMarquee((current) => {
      if (current === undefined) {
        return current
      }

      return {
        ...current,
        currentX: point.x,
        currentY: point.y
      }
    })
  }

  function handleSlidePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (marquee === undefined) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    const point = slidePoint(event)
    const finalRect = marqueeRect({ ...marquee, currentX: point.x, currentY: point.y })
    const selectedIds = activeSlide.elements
      .filter((element) => element.visible && elementIntersectsRect(element, finalRect))
      .map((element) => element.id)
    setMarquee(undefined)
    selectElements(selectedIds)
  }

  function handleElementPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    const safeZoom = fitScale > 0 ? fitScale : 1
    const deltaX = Math.round((event.clientX - drag.pointerX) / safeZoom)
    const deltaY = Math.round((event.clientY - drag.pointerY) / safeZoom)
    setDrag(undefined)

    if (deltaX !== 0 || deltaY !== 0) {
      if (drag.elements.length === 1) {
        const item = drag.elements[0]!
        runCommand(new UpdateElementCommand(item.elementId, { x: item.originX + deltaX, y: item.originY + deltaY }))
        return
      }

      runCommand(new UpdateElementsCommand(drag.elements.map((item) => ({
        elementId: item.elementId,
        patch: { x: item.originX + deltaX, y: item.originY + deltaY }
      })), 'Move selected elements'))
    }
  }

  const frameOverrides: Record<string, SlideElementFrame> = drag === undefined
    ? {}
    : Object.fromEntries(drag.elements.map((item) => [
        item.elementId,
        {
          x: item.originX + drag.deltaX,
          y: item.originY + drag.deltaY
        }
      ]))

  const marqueeOverlay = marquee === undefined ? undefined : (
    <div
      className="canvas-marquee"
      aria-hidden="true"
      style={{
        left: marqueeRect(marquee).left,
        top: marqueeRect(marquee).top,
        width: marqueeRect(marquee).width,
        height: marqueeRect(marquee).height
      }}
    />
  )

  return (
    <div className="canvas-viewport" ref={viewportRef}>
      <SlideView
        slide={slide}
        scale={fitScale}
        selectedElementIds={selectedElementIds}
        frameOverrides={frameOverrides}
        overlay={marqueeOverlay}
        onSlidePointerDown={handleSlidePointerDown}
        onSlidePointerMove={handleSlidePointerMove}
        onSlidePointerUp={handleSlidePointerUp}
        onElementPointerDown={handleElementPointerDown}
        onElementPointerMove={handleElementPointerMove}
        onElementPointerUp={handleElementPointerUp}
      />
    </div>
  )
}
