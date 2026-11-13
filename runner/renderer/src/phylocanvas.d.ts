// @phylocanvas/phylocanvas.gl ships no type declarations. This is the surface
// NewickFile uses, so the runner can typecheck the portal's tree renderer
// under `strict` instead of turning strict mode off for the whole project.
declare module "@phylocanvas/phylocanvas.gl" {
  /** Tree layout codes, as the library's own `TreeTypes` object. */
  export const TreeTypes: {
    Circular: string
    Diagonal: string
    Hierarchical: string
    Radial: string
    Rectangular: string
  }

  export class PhylocanvasGL {
    constructor(element: HTMLElement, props: Record<string, unknown>)
    setProps(props: Record<string, unknown>): void
    destroy(): void
  }
}
