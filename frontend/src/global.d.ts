declare module "@phylocanvas/phylocanvas.gl" {
  export const TreeTypes: {
    Circular: string;
    Diagonal: string;
    Hierarchical: string;
    Radial: string;
    Rectangular: string;
  };

  export interface PhylocanvasProps {
    source?: string;
    size?: { width: number; height: number };
    type?: string;
    interactive?: boolean;
    showLabels?: boolean;
    showLeafLabels?: boolean;
    fontColour?: number[];
    fillColour?: number[];
    [key: string]: unknown;
  }

  export default class PhylocanvasGL {
    constructor(view?: HTMLElement | null, props?: PhylocanvasProps);
    setProps(props: PhylocanvasProps): void;
    destroy(): void;
  }
}

declare module "remark-gfm" {
  import { Plugin } from "unified";

  const remarkGfm: Plugin;
  export default remarkGfm;
}
