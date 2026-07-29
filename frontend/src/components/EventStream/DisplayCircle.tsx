import { useTick } from "@pixi/react"
import * as PIXI from "pixi.js"
import { useCallback, useMemo, useRef, useState } from "react"

export type Circle = {
  id: number
  name?: string
  size: number
  radius: number
  x: number
  y: number
  vx: number
  vy: number
  color?: number
  image?: string
}

interface CircleDisplayProps {
  circle: Circle
}

function CircleDisplay({ circle }: CircleDisplayProps) {
  const containerRef = useRef<PIXI.Container | null>(null)
  const maskRef = useRef<PIXI.Graphics | null>(null)
  const spriteRef = useRef<PIXI.Sprite | null>(null)
  const textRef = useRef<PIXI.Text | null>(null)

  const [isHovered, setIsHovered] = useState(false)
  const imageTexture = useMemo(
    () => (circle.image ? PIXI.Texture.from(circle.image) : null),
    [circle.image],
  )
  const drawCircle = useCallback(
    (graphics: PIXI.Graphics) => {
      graphics
        .clear()
        .circle(0, 0, circle.radius)
        .fill(circle.color ?? 0x3498db)
    },
    [circle.color, circle.radius],
  )
  const drawMask = useCallback(
    (graphics: PIXI.Graphics) => {
      graphics.clear().circle(0, 0, circle.radius).fill(0xffffff)
    },
    [circle.radius],
  )

  useTick(() => {
    // Update container position.
    if (containerRef.current) {
      containerRef.current.x = circle.x
      containerRef.current.y = circle.y
    }

    // Update image sprite and its mask if an image is provided.
    if (circle.image && spriteRef.current && maskRef.current) {
      spriteRef.current.width = circle.radius * 2
      spriteRef.current.height = circle.radius * 2
      spriteRef.current.anchor.set(0.5)
      spriteRef.current.mask = maskRef.current
    }
  })

  // Define text style for the hover label.
  const style = new PIXI.TextStyle({
    fontFamily: "Helvetica",
    fontSize: 14,
    fontStyle: "italic",
    fontWeight: "bold",
    fill: "white",
    stroke: { color: "black", width: 3 },
  })

  return (
    <pixiContainer
      ref={containerRef}
      eventMode="static"
      onPointerOver={() => setIsHovered(true)}
      onPointerOut={() => setIsHovered(false)}
    >
      <pixiGraphics draw={drawCircle} />
      {imageTexture && (
        <>
          <pixiSprite ref={spriteRef} texture={imageTexture} />
          <pixiGraphics ref={maskRef} draw={drawMask} />
        </>
      )}
      {isHovered && circle.name && (
        <pixiText
          ref={textRef}
          text={circle.name}
          anchor={{ x: 0.5, y: 0.5 }}
          style={style}
        />
      )}
    </pixiContainer>
  )
}

export default CircleDisplay
