import {
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddToolDialog } from "./AddToolDialog";
import { PortalToolDialog } from "./PortalToolDialog";
import { ToolImage, useToolImages } from "./ToolImage";

type ToolEntry = {
  id: string;
  name: string;
  version: string;
  description: string | null;
  image: string | null;
  problem: string | null;
};

const COLLAPSED_KEY = "cpg-runner.sidebar";
const WIDTH_KEY = "cpg-runner.sidebar-width";
const MIN_WIDTH = 192;
const MAX_WIDTH = 384;
const DEFAULT_WIDTH = 224;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function readWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw !== null && raw !== "") {
      const value = Number(raw);
      if (Number.isFinite(value))
        return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDTH;
}

/**
 * The tools this computer has. Adding one — from the portal or from a pack —
 * goes through the Add tool dialog. It folds to an icon bar, which is
 * remembered for the window and across launches.
 */
export function ToolSidebar({
  activeToolId,
  beforeOpen,
}: {
  activeToolId?: string | null;
  /** Asked before a tool is opened; false leaves the click to the caller. */
  beforeOpen?: (toolId: string) => boolean | Promise<boolean>;
}) {
  const bridge = window.cpgRunner;
  const images = useToolImages();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [width, setWidth] = useState(readWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = (event: React.PointerEvent) => {
    if (collapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const move = (ev: PointerEvent) => {
      setWidth(
        Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(WIDTH_KEY, String(widthRef.current));
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<{
    name: string;
    version: string;
  } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    // The bridge is fixed for the window's lifetime.
    void window.cpgRunner?.tools().then(setTools);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      // A window that refuses storage simply forgets the choice.
    }
  }, [collapsed]);

  useEffect(() => {
    // A tool removed elsewhere must leave this list too.
    return window.cpgRunner?.onToolsChanged?.(() => {
      void window.cpgRunner?.tools().then(setTools);
    });
  }, []);

  useEffect(() => {
    // A tool added before its picture was kept still has its URL: save it now.
    for (const tool of tools) {
      if (tool.image && !images[tool.id]) {
        void window.cpgRunner?.cacheToolImage?.(tool.id, tool.image);
      }
    }
  }, [tools, images]);

  async function refreshTools() {
    if (!bridge) return;
    setTools(await bridge.tools());
  }

  async function openTool(toolId: string) {
    if (!bridge || openingId) return;
    if (beforeOpen && !(await beforeOpen(toolId))) return;
    setOpeningId(toolId);
    try {
      // Resolves once the tool's page has loaded; the row spins meanwhile.
      await bridge.openTool(toolId);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <aside
      className={cn(
        "bg-muted/40 relative flex shrink-0 flex-col border-r",
        collapsed ? "w-14" : "w-56",
      )}
      style={collapsed ? undefined : { width }}
    >
      {!collapsed && (
        <div
          aria-hidden
          onPointerDown={startResize}
          className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
        />
      )}
      <div
        className={cn(
          "flex items-center gap-2 py-4",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              CPG Runner
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {bridge?.appVersion
                ? `Runs on this computer · v${bridge.appVersion}`
                : "Runs on this computer"}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 shrink-0"
          aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav
        aria-label="Tools"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2"
      >
        {!collapsed && (
          <p className="text-muted-foreground px-2 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
            My tools
          </p>
        )}
        {tools.length === 0 ? (
          !collapsed && (
            <div className="text-muted-foreground flex h-24 items-center justify-center rounded-md border px-2 text-center text-xs">
              No tools yet. Add one below.
            </div>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-0.5">
            {tools.map((tool) => {
              const active = tool.id === activeToolId;
              return (
                <li key={tool.id} className="min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void openTool(tool.id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? tool.name : undefined}
                    disabled={openingId !== null}
                    title={tool.problem ?? tool.description ?? tool.name}
                    className={cn(
                      "relative h-auto w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      collapsed ? "justify-center" : "justify-between",
                      active
                        ? "bg-cyan-100 text-cyan-900 font-medium dark:bg-sidebar-accent dark:text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        className="bg-cyan-600 dark:bg-primary-foreground absolute inset-y-1.5 left-0 w-0.5 rounded-full"
                      />
                    )}
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-2",
                        !collapsed && "flex-1",
                      )}
                    >
                      {collapsed && openingId === tool.id ? (
                        <LoaderCircle className="text-muted-foreground size-4 shrink-0 animate-spin" />
                      ) : tool.problem ? (
                        <TriangleAlert
                          className="size-5 shrink-0 text-amber-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <ToolImage
                          id={tool.id}
                          name={tool.name}
                          images={images}
                          src={tool.image}
                          className="size-5"
                        />
                      )}
                      {!collapsed && (
                        <span className="truncate">{tool.name}</span>
                      )}
                    </span>
                    {!collapsed &&
                      (openingId === tool.id ? (
                        <LoaderCircle className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
                      ) : (
                        tool.version && (
                          <span className="dark:text-muted-foreground shrink-0 text-xs">
                            {tool.version}
                          </span>
                        )
                      ))}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="grid gap-1 border-t p-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "w-full",
            collapsed ? "justify-center" : "justify-start",
          )}
          disabled={openingId !== null || !bridge}
          title={collapsed ? "Add tool" : undefined}
          aria-label={collapsed ? "Add tool" : undefined}
          onClick={() => setAddOpen(true)}
        >
          <Plus />
          {!collapsed && "Add tool"}
        </Button>
      </div>

      <AddToolDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onPick={(target) => {
          setAddOpen(false);
          setPortalTarget(target);
        }}
        onAdded={() => void refreshTools()}
      />

      <PortalToolDialog
        target={portalTarget}
        installed={tools}
        onOpenChange={(open) => {
          if (!open) setPortalTarget(null);
        }}
        onAdded={() => void refreshTools()}
      />
    </aside>
  );
}
