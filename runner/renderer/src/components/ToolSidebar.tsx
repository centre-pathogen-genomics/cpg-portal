import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolEntry = {
	id: string;
	name: string;
	version: string;
	description: string | null;
};

/**
 * The installed tools, the way a desktop app lists its workspaces: one entry
 * per tool, the current one highlighted, and a way to add another at the
 * bottom.
 */
export function ToolSidebar({
	activeToolId,
}: {
	activeToolId?: string | null;
}) {
	const bridge = window.cpgRunner;
	const [tools, setTools] = useState<ToolEntry[]>([]);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void bridge?.tools().then(setTools);
	}, [bridge]);

	async function addTool() {
		if (!bridge) return;
		setBusy(true);
		try {
			const added = await bridge.importPacks();
			if (added.length > 0) setTools(await bridge.tools());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	}

	return (
		<aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
			<div className="px-4 py-4">
				<p className="text-sm font-semibold tracking-tight">CPG Runner</p>
				<p className="text-muted-foreground text-xs">Runs on this computer</p>
			</div>

			<nav aria-label="Tools" className="min-h-0 flex-1 overflow-y-auto px-2">
				{tools.length === 0 ? (
					<p className="text-muted-foreground px-2 py-2 text-xs">
						No tools yet. Add one below, or drop a .cpgpack on the window.
					</p>
				) : (
					<ul className="grid gap-0.5">
						{tools.map((tool) => {
							const active = tool.id === activeToolId;
							return (
								<li key={tool.id}>
									<button
										type="button"
										onClick={() => void bridge?.openTool(tool.id)}
										aria-current={active ? "page" : undefined}
										title={tool.description ?? tool.name}
										className={cn(
											"flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
											active
												? "bg-background font-medium shadow-sm"
												: "hover:bg-background/70",
										)}
									>
										<span className="truncate">{tool.name}</span>
										{tool.version && (
											<span className="text-muted-foreground shrink-0 text-xs">
												{tool.version}
											</span>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</nav>

			<div className="border-t p-2">
				<Button
					type="button"
					variant="ghost"
					className="w-full justify-start"
					disabled={busy || !bridge}
					onClick={() => void addTool()}
				>
					<Plus />
					Add tool
				</Button>
			</div>
		</aside>
	);
}
