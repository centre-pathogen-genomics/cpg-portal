import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { Stage, Container, Graphics, Text, Sprite, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';

// 1. Extend the Circle type to include an optional image property.
export type Circle = {
  id: number;
  name?: string;
  size: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color?: number;
  image?: string; // Optional image URL.
};

export interface EventStreamVisualizationRef {
  // Update the addEvent signature to optionally accept an image.
  addEvent: (eventData: { size: number; name?: string; image?: string }) => void;
}

interface EventStreamVisualizationPixiProps {
  width: number;
  height: number;
}

interface CircleDisplayProps {
  circle: Circle;
}

function CircleDisplay({ circle }: CircleDisplayProps) {
  const containerRef = useRef<PIXI.Container | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const maskRef = useRef<PIXI.Graphics | null>(null);
  const spriteRef = useRef<PIXI.Sprite | null>(null);
  const textRef = useRef<PIXI.Text | null>(null);

  // New state to track hover status.
  const [isHovered, setIsHovered] = useState(false);

  useTick(() => {
    if (containerRef.current) {
      containerRef.current.x = circle.x;
      containerRef.current.y = circle.y;
    }
    if (circle.image && spriteRef.current && maskRef.current) {
      maskRef.current.clear();
      maskRef.current.beginFill(0xffffff);
      maskRef.current.drawCircle(0, 0, circle.radius);
      maskRef.current.endFill();

      spriteRef.current.width = circle.radius * 2;
      spriteRef.current.height = circle.radius * 2;
      spriteRef.current.anchor.set(0.5);
      spriteRef.current.mask = maskRef.current;
    }
    if (graphicsRef.current && circle.color) {
      const g = graphicsRef.current;
      g.clear();
      g.beginFill(circle.color, 1);
      g.drawCircle(0, 0, circle.radius);
      g.endFill();
    }
  });

  // Text style.
  const style = new PIXI.TextStyle({
    fontFamily: 'Helvetica',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: 'bold',
    fill: 'white',
    stroke: 'black',
    strokeThickness: 3,
    dropShadow: true,
  });

  return (
    <Container
      ref={containerRef}
      interactive={true}
      pointerover={() => setIsHovered(true)}
      pointerout={() => setIsHovered(false)}
    >
      <Graphics ref={graphicsRef} />
      {circle.image && (
        <>
          <Sprite ref={spriteRef} image={circle.image} />
          <Graphics ref={maskRef} />
        </>
      )}
      {isHovered && (
        <Text
          ref={textRef}
          text={circle.name}
          anchor={{ x: 0.5, y: 0.5 }}
          style={style}
        />
      )}
    </Container>
  );
}

const EventStreamVisualizationPixi = forwardRef<
  EventStreamVisualizationRef,
  EventStreamVisualizationPixiProps
>((props, ref) => {
  const { width, height } = props;
  const centerX = width / 2;
  const centerY = height / 2;

  // Create a ref for the wrapper div.
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Listen for the "f" key press to enter full screen mode.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        if (wrapperRef.current && wrapperRef.current.requestFullscreen) {
          wrapperRef.current.requestFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const circlesRef = useRef<Circle[]>([]);
  const [_, setVersion] = useState<number>(0);

  const colorList = [
    0x3498db, 0xe67e22, 0x2ecc71, 0xe74c3c, 0x9b59b6,
    0x795548, 0xfd79a8, 0x95a5a6, 0xf1c40f, 0x1abc9c,
    0x34495e, 0x27ae60, 0xd35400, 0xc0392b, 0x8e44ad,
    0xe84393,
  ];

  // Map for assigning colors based on event type.
  const eventTypeColorsRef = useRef(new Map<string, number>());

  // Updated addEvent to optionally accept an image.
  const addEvent = (eventData: { size: number; name?: string; image?: string }) => {
    eventData.name = eventData.name?.toUpperCase();
    let color = undefined;
    if (eventData.name) {
      if (!eventTypeColorsRef.current.has(eventData.name)) {
        const index = eventTypeColorsRef.current.size % colorList.length;
        eventTypeColorsRef.current.set(eventData.name, colorList[index]);
      }
      color = eventTypeColorsRef.current.get(eventData.name)!;
    }

    // Calculate spawn location.
    const spawnMargin = 50;
    const spawnRadius = Math.max(width, height) / 2 + spawnMargin;
    const angle = Math.random() * 2 * Math.PI;
    const spawnX = spawnRadius * Math.cos(angle);
    const spawnY = spawnRadius * Math.sin(angle);

    // Create new circle.
    const newCircle: Circle = {
      id: Date.now() + Math.random(),
      name: eventData.name,
      size: eventData.size,
      radius: Math.sqrt(eventData.size) * 10,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      color,
      image: eventData.image,
    };
    circlesRef.current.push(newCircle);
    setVersion((v) => v + 1);
  };

  useImperativeHandle(ref, () => ({
    addEvent,
  }));

  // Handle pointer down events to apply a repulsion force.
  const handlePointerDown = (e: any) => {
    if (!e.data || !e.data.global) return;
    const globalPos = e.data.global;
    const repulsionCenter = {
      x: globalPos.x - centerX,
      y: globalPos.y - centerY,
    };
    const clickForce = 4000;
    circlesRef.current.forEach((circle) => {
      const dx = circle.x - repulsionCenter.x;
      const dy = circle.y - repulsionCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = clickForce / dist;
      circle.vx += (dx / dist) * force;
      circle.vy += (dy / dist) * force;
    });
  };

  // Animate circles: update positions, attraction/repulsion, and handle collisions.
  useTick((delta: number) => {
    const dt = delta / 60;
    const attractionStrength = 100;
    const damping = 0.98;
    const repulsionStrength = 50;

    circlesRef.current.forEach((circle) => {
      const dx = -circle.x;
      const dy = -circle.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ax = (dx / dist) * attractionStrength;
      const ay = (dy / dist) * attractionStrength;
      circle.vx = (circle.vx + ax * dt) * damping;
      circle.vy = (circle.vy + ay * dt) * damping;
      circle.x += circle.vx * dt;
      circle.y += circle.vy * dt;
    });

    // Collision detection: merge circles if the same type or repel if different.
    const mergedIds = new Set<number>();
    for (let i = 0; i < circlesRef.current.length; i++) {
      const circleA = circlesRef.current[i];
      for (let j = i + 1; j < circlesRef.current.length; j++) {
        const circleB = circlesRef.current[j];
        if (mergedIds.has(circleA.id) || mergedIds.has(circleB.id)) continue;
        const dx = circleA.x - circleB.x;
        const dy = circleA.y - circleB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = circleA.radius + circleB.radius;
        if (distance < minDist) {
          if (circleA.name === circleB.name) {
            const newSize = circleA.size + circleB.size;
            const newRadius = Math.sqrt(newSize) * 10;
            const newX = (circleA.x * circleA.size + circleB.x * circleB.size) / newSize;
            const newY = (circleA.y * circleA.size + circleB.y * circleB.size) / newSize;
            const newVx = (circleA.vx * circleA.size + circleB.vx * circleB.size) / newSize;
            const newVy = (circleA.vy * circleA.size + circleB.vy * circleB.size) / newSize;
            circleA.size = newSize;
            circleA.radius = newRadius;
            circleA.x = newX;
            circleA.y = newY;
            circleA.vx = newVx;
            circleA.vy = newVy;
            mergedIds.add(circleB.id);
          } else {
            const overlap = minDist - distance;
            const ux = dx / (distance || 1);
            const uy = dy / (distance || 1);
            circleA.vx += ux * repulsionStrength * overlap * dt;
            circleA.vy += uy * repulsionStrength * overlap * dt;
            circleB.vx -= ux * repulsionStrength * overlap * dt;
            circleB.vy -= uy * repulsionStrength * overlap * dt;
          }
        }
      }
    }
    if (mergedIds.size > 0) {
      circlesRef.current = circlesRef.current.filter(
        (circle) => !mergedIds.has(circle.id)
      );
      setVersion((v) => v + 1);
    }
  });

  return (
    // Wrapper div for full screen support.
    <div
      ref={wrapperRef}
      style={{ width, height, outline: 'none' }}
      tabIndex={0}
    >
      <Stage width={width} height={height} options={{ backgroundAlpha: 0 }}>
        <Container
          x={centerX}
          y={centerY}
          interactive={true}
          pointerdown={handlePointerDown}
        >
          {circlesRef.current.map((circle) => (
            <CircleDisplay key={circle.id} circle={circle} />
          ))}
        </Container>
      </Stage>
    </div>
  );
});

export default EventStreamVisualizationPixi;
