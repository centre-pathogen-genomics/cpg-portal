import {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';

// Extend the Circle type to include a color property.
export type Circle = {
  id: number;
  name: string;
  size: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
};

export interface EventStreamVisualizationRef {
  addEvent: (eventData: { name: string; size: number }) => void;
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
  const textRef = useRef<PIXI.Text | null>(null);

  useTick(() => {
    if (containerRef.current) {
      containerRef.current.x = circle.x;
      containerRef.current.y = circle.y;
    }
    if (graphicsRef.current) {
      const g = graphicsRef.current;
      g.clear();
      // Draw a white border.
      g.lineStyle(1, 0xffffff, 1);
      // Fill with the assigned event color.
      g.beginFill(circle.color, 1);
      g.drawCircle(0, 0, circle.radius);
      g.endFill();
    }
  });
  const style = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: 'bold',
    fill: "white",
    stroke: 'black',
    strokeThickness: 3,
    dropShadow: true,
});
  return (
    <Container ref={containerRef}>
      <Graphics ref={graphicsRef} />
      <Text
        ref={textRef}
        text={circle.name}
        anchor={{ x: 0.5, y: 0.5 }}
        style={style}
      />
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

  const circlesRef = useRef<Circle[]>([]);
  const [_, setVersion] = useState<number>(0);

  // List of 16 nice colors.
  const colorList = [
    0x1f77b4, // blue
    0xff7f0e, // orange
    0x2ca02c, // green
    0xd62728, // red
    0x9467bd, // purple
    0x8c564b, // brown
    0xe377c2, // pink
    0x7f7f7f, // gray
    0xbcbd22, // olive
    0x17becf, // cyan
    0x393b79, // dark blue
    0x637939, // dark green
    0x8c6d31, // dark orange
    0x843c39, // dark red
    0x7b4173, // dark purple
    0xa55194, // dark pink
  ];

  // Map to store color assignments for event types.
  const eventTypeColorsRef = useRef(new Map<string, number>());

  const addEvent = (eventData: { name: string; size: number }) => {
    if (!eventTypeColorsRef.current.has(eventData.name)) {
      const index = eventTypeColorsRef.current.size % colorList.length;
      eventTypeColorsRef.current.set(eventData.name, colorList[index]);
    }
    const color = eventTypeColorsRef.current.get(eventData.name)!;

    const spawnMargin = 50;
    const spawnRadius = Math.max(width, height) / 2 + spawnMargin;
    const angle = Math.random() * 2 * Math.PI;
    const spawnX = spawnRadius * Math.cos(angle);
    const spawnY = spawnRadius * Math.sin(angle);
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
    };
    circlesRef.current.push(newCircle);
    setVersion((v) => v + 1);
  };

  useImperativeHandle(ref, () => ({
    addEvent,
  }));

  // Handle pointer down on the interactive container to apply a repulsion force.
  const handlePointerDown = (e: any) => {
    if (!e.data || !e.data.global) return;
    // Global coordinates from the event.
    const globalPos = e.data.global;
    // Convert to stage coordinates relative to our centered container.
    const repulsionCenter = {
      x: globalPos.x - centerX,
      y: globalPos.y - centerY,
    };
    const clickForce = 4000; // Adjust the repulsion strength as needed.
    circlesRef.current.forEach((circle) => {
      const dx = circle.x - repulsionCenter.x;
      const dy = circle.y - repulsionCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = clickForce / dist;
      circle.vx += (dx / dist) * force;
      circle.vy += (dy / dist) * force;
    });
  };

  useTick((delta: number) => {
    const dt = delta / 60;
    const attractionStrength = 100;
    const damping = 0.98;
    const repulsionStrength = 50; // For overlapping different event types

    // Apply attraction toward center.
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

    // Collision detection: merge same types or repulse different types.
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
            // Merge circles of the same type.
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
            // Repel circles of different types.
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
  );
});

export default EventStreamVisualizationPixi;
