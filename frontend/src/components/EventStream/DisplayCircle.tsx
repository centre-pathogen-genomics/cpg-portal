import {
    useRef,
    useState,
    useEffect,
  } from 'react';
  import { Container, Graphics, Text, Sprite, useTick } from '@pixi/react';
  import * as PIXI from 'pixi.js';
  
  // Helper to convert a numeric hex color to a CSS color string.
  function hexToCSS(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }
  
  // Create a vertical gradient texture.
  function createVerticalGradientTexture(
    bottomColor: string,
    topColor: string,
    quality: number = 256
  ): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = quality;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }
    const gradient = ctx.createLinearGradient(0, quality, 0, 0);
    gradient.addColorStop(0, bottomColor);
    gradient.addColorStop(0.5, topColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = PIXI.Texture.from(canvas);
    texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    return texture;
  }
  
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
    image?: string;
  };
  
  interface CircleDisplayProps {
    circle: Circle;
  }
  
  function CircleDisplay({ circle }: CircleDisplayProps) {
    const containerRef = useRef<PIXI.Container | null>(null);
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const maskRef = useRef<PIXI.Graphics | null>(null);
    const spriteRef = useRef<PIXI.Sprite | null>(null);
    const textRef = useRef<PIXI.Text | null>(null);
  
    // Ref to store the cached gradient texture.
    const gradientTextureRef = useRef<PIXI.Texture | null>(null);
    // A quality constant for texture height.
    const quality = 256;
  
    // Track hover status.
    const [isHovered, setIsHovered] = useState(false);
  
    // Create or update the gradient texture only when circle.radius or circle.color changes.
    useEffect(() => {
      if (circle.color && graphicsRef.current) {
        const bottomColor = '#ffffff';
        const topColor = hexToCSS(circle.color);
        const newTexture = createVerticalGradientTexture(
          bottomColor,
          topColor,
          circle.radius * 2 // Use circle's diameter as quality.
        );
        // Clean up previous texture if it exists.
        if (gradientTextureRef.current) {
          gradientTextureRef.current.destroy(true);
        }
        gradientTextureRef.current = newTexture;
      }
  
      // Cleanup when the component unmounts.
      return () => {
        if (gradientTextureRef.current) {
          gradientTextureRef.current.destroy(true);
          gradientTextureRef.current = null;
        }
      };
    }, [circle.radius, circle.color]);
  
    useTick(() => {
      // Update container position.
      if (containerRef.current) {
        containerRef.current.x = circle.x;
        containerRef.current.y = circle.y;
      }
  
      // Update image sprite and its mask if an image is provided.
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
  
      // Use the cached gradient texture.
      if (graphicsRef.current && circle.color && gradientTextureRef.current) {
        const g = graphicsRef.current;
        g.clear();
  
        // Set up the transformation matrix.
        const matrix = new PIXI.Matrix();
        matrix.a = 2 * circle.radius; // Scale x to circle's diameter.
        matrix.d = quality / (2 * circle.radius); // Scale y accordingly.
        // Adjust ty so that the top of the circle maps to the top of the texture.
        matrix.ty = circle.radius * (quality / (2 * circle.radius)); // equals quality/2
  
        // Begin the texture fill with the cached texture.
        g.beginTextureFill({ texture: gradientTextureRef.current, matrix });
        g.drawCircle(0, 0, circle.radius);
        g.endFill();
      }
    });
  
    // Define text style for the hover label.
    const style = new PIXI.TextStyle({
      fontFamily: 'Helvetica',
      fontSize: 14,
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
  
  export default CircleDisplay;
  