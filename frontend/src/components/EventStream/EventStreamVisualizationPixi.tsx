import { Application, extend, useTick } from "@pixi/react"
import { Container, Graphics, Sprite, Text } from "pixi.js"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import CircleDisplay, { type Circle } from "./DisplayCircle"

extend({ Container, Graphics, Sprite, Text })

export interface EventStreamVisualizationRef {
  // Update the addEvent signature to optionally accept an image.
  addEvent: (eventData: { size: number; name?: string; image?: string }) => void
}

interface EventStreamVisualizationPixiProps {
  width: number
  height: number
  targetX?: number
  targetY?: number
  maxCircles?: number
  mergeSameName?: boolean
  spawnMode?: "edges" | "view" | "target"
  targetMode?: "attract" | "repel"
}

const EventStreamContent = forwardRef<
  EventStreamVisualizationRef,
  EventStreamVisualizationPixiProps
>((props, ref) => {
  const { width, height } = props
  const targetX = props.targetX ?? width / 2
  const targetY = props.targetY ?? height / 2
  const mergeSameName = props.mergeSameName ?? true
  const spawnMode = props.spawnMode ?? "edges"
  const targetMode = props.targetMode ?? "attract"

  const circlesRef = useRef<Circle[]>([])
  const [_, setVersion] = useState<number>(0)

  const colorList = [
    0xe67e22, 0x2ecc71, 0xe74c3c, 0x9b59b6, 0x795548, 0xfd79a8, 0x3498db,
    0x95a5a6, 0xf1c40f, 0x1abc9c, 0x34495e, 0x27ae60, 0xd35400, 0xc0392b,
    0x8e44ad, 0xe84393,
  ]

  // Map for assigning colors based on event type.
  const eventTypeColorsRef = useRef(new Map<string, number>())

  // Updated addEvent to optionally accept an image.
  const addEvent = (eventData: {
    size: number
    name?: string
    image?: string
  }) => {
    let color: number | undefined
    if (eventData.name) {
      if (!eventTypeColorsRef.current.has(eventData.name)) {
        const index = eventTypeColorsRef.current.size % colorList.length
        eventTypeColorsRef.current.set(eventData.name, colorList[index])
      }
      color = eventTypeColorsRef.current.get(eventData.name)!
    }

    const radius = Math.sqrt(eventData.size) * 10
    const viewSpawnMinX = Math.min(radius, width / 2)
    const viewSpawnMaxX = Math.max(viewSpawnMinX, width - radius)
    const viewSpawnMinY = Math.min(radius, height / 2)
    const viewSpawnMaxY = Math.max(viewSpawnMinY, height - radius)
    let spawnX =
      viewSpawnMinX + Math.random() * (viewSpawnMaxX - viewSpawnMinX)
    let spawnY =
      viewSpawnMinY + Math.random() * (viewSpawnMaxY - viewSpawnMinY)

    if (spawnMode === "edges") {
      const spawnPadding = radius + 40
      const side = Math.floor(Math.random() * 4)
      spawnX =
        side === 0
          ? -spawnPadding
          : side === 1
            ? width + spawnPadding
            : Math.random() * width
      spawnY =
        side === 2
          ? -spawnPadding
          : side === 3
            ? height + spawnPadding
            : Math.random() * height
    } else if (spawnMode === "target") {
      const angle = Math.random() * Math.PI * 2
      const targetSpawnDistance = Math.max(radius * 0.35, 8)
      spawnX = targetX + Math.cos(angle) * targetSpawnDistance
      spawnY = targetY + Math.sin(angle) * targetSpawnDistance
    }

    // Create new circle.
    const newCircle: Circle = {
      id: Date.now() + Math.random(),
      name: eventData.name,
      size: eventData.size,
      radius,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      color,
      image: eventData.image,
    }
    circlesRef.current.push(newCircle)
    if (props.maxCircles && circlesRef.current.length > props.maxCircles) {
      circlesRef.current = circlesRef.current.slice(-props.maxCircles)
    }
    setVersion((v) => v + 1)
  }

  useImperativeHandle(ref, () => ({
    addEvent,
  }))

  // Handle pointer down events to apply a repulsion force.
  const handlePointerDown = (e: any) => {
    if (!e.global) return
    const globalPos = e.global
    const clickForce = 4000
    circlesRef.current.forEach((circle) => {
      const dx = circle.x - globalPos.x
      const dy = circle.y - globalPos.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = clickForce / dist
      circle.vx += (dx / dist) * force
      circle.vy += (dy / dist) * force
    })
  }

  // Animate circles: update positions, attraction/repulsion, and handle collisions.
  useTick((ticker) => {
    const dt = ticker.deltaTime / 60
    const attractionStrength = targetMode === "repel" ? -5.2 : 2.8
    const damping = 0.96
    const repulsionStrength = 50

    circlesRef.current.forEach((circle) => {
      let dx = targetX - circle.x
      let dy = targetY - circle.y
      if (targetMode === "repel" && dx === 0 && dy === 0) {
        const angle = Math.random() * Math.PI * 2
        dx = Math.cos(angle)
        dy = Math.sin(angle)
      }
      const ax = dx * attractionStrength
      const ay = dy * attractionStrength
      circle.vx = (circle.vx + ax * dt) * damping
      circle.vy = (circle.vy + ay * dt) * damping
      circle.x += circle.vx * dt
      circle.y += circle.vy * dt
    })

    // Collision detection: merge circles if the same type or repel if different.
    const mergedIds = new Set<number>()
    for (let i = 0; i < circlesRef.current.length; i++) {
      const circleA = circlesRef.current[i]
      for (let j = i + 1; j < circlesRef.current.length; j++) {
        const circleB = circlesRef.current[j]
        if (mergedIds.has(circleA.id) || mergedIds.has(circleB.id)) continue
        const dx = circleA.x - circleB.x
        const dy = circleA.y - circleB.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const minDist = circleA.radius + circleB.radius
        if (distance < minDist) {
          if (mergeSameName && circleA.name === circleB.name) {
            const newSize = circleA.size + circleB.size
            const newRadius = Math.sqrt(newSize) * 10
            const newX =
              (circleA.x * circleA.size + circleB.x * circleB.size) / newSize
            const newY =
              (circleA.y * circleA.size + circleB.y * circleB.size) / newSize
            const newVx =
              (circleA.vx * circleA.size + circleB.vx * circleB.size) / newSize
            const newVy =
              (circleA.vy * circleA.size + circleB.vy * circleB.size) / newSize
            circleA.size = newSize
            circleA.radius = newRadius
            circleA.x = newX
            circleA.y = newY
            circleA.vx = newVx
            circleA.vy = newVy
            mergedIds.add(circleB.id)
          } else {
            const overlap = minDist - distance
            const ux = dx / (distance || 1)
            const uy = dy / (distance || 1)
            circleA.vx += ux * repulsionStrength * overlap * dt
            circleA.vy += uy * repulsionStrength * overlap * dt
            circleB.vx -= ux * repulsionStrength * overlap * dt
            circleB.vy -= uy * repulsionStrength * overlap * dt
          }
        }
      }
    }

    if (mergedIds.size > 0) {
      // Remove merged circles.
      circlesRef.current = circlesRef.current.filter(
        (circle) => !mergedIds.has(circle.id),
      )
      setVersion((v) => v + 1)
    }
  })

  return (
    <pixiContainer
      eventMode="static"
      onPointerDown={handlePointerDown}
    >
      {circlesRef.current.map((circle) => (
        <CircleDisplay key={circle.id} circle={circle} />
      ))}
    </pixiContainer>
  )
})

const EventStreamVisualizationPixi = forwardRef<
  EventStreamVisualizationRef,
  EventStreamVisualizationPixiProps
>((props, ref) => (
  <Application
    width={props.width}
    height={props.height}
    backgroundAlpha={0}
    resolution={1}
  >
    <EventStreamContent ref={ref} {...props} />
  </Application>
))

export default EventStreamVisualizationPixi
