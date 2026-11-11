import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToolSidebar } from "./components/ToolSidebar";
import { filePathOf } from "./lib/desktop";

type ToolEntry = {
	id: string;
	name: string;
	version: string;
	description: string | null;
};

const PACK_EXTENSION = ".cpgpack";

function packPaths(files: FileList | File[]): string[] {
	return Array.from(files)
		.filter((file) => file.name.toLowerCase().endsWith(PACK_EXTENSION))
		.map(filePathOf)
		.filter((target) => target.length > 0);
}

/**
 * What the window shows before a tool is open. Choosing one happens in the
 * sidebar; this page is the place to add another.
 */
export function ToolsPage() {
	const bridge = window.cpgRunner;
	const [tools, setTools] = useState<ToolEntry[]>([]);
	const [busy, setBusy] = useState(false);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		void bridge?.tools().then(setTools);
	}, [bridge]);

	const importPacks = async (load: () => Promise<ToolEntry[]>) => {
		if (!bridge) return;
		setBusy(true);
		try {
			const added = await load();
			if (added.length > 0) setTools(await bridge.tools());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};

	const importDropped = (files: FileList) => {
		const paths = packPaths(files);
		if (paths.length === 0) {
			toast.error("Drop a .cpgpack file exported from a tool page");
			return;
		}
		if (bridge) void importPacks(() => bridge.importPackPaths(paths));
	};

	return (
		<div className="flex h-full">
			<ToolSidebar activeToolId={null} />

			<main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-8">
				<div className="grid max-w-md gap-4 text-center">
					<div>
						<h1 className="text-xl font-semibold">
							{tools.length > 0 ? "Choose a tool" : "Add a tool"}
						</h1>
						<p className="text-muted-foreground mt-1 text-sm">
							{tools.length > 0
								? "Pick a tool on the left to run it on this computer."
								: "Download a tool pack from a tool page on the portal and open it here."}
						</p>
					</div>

					<div
						className={`rounded-lg border border-dashed p-6 text-sm ${dragging ? "border-primary bg-muted" : "text-muted-foreground"}`}
						onDragOver={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={(event) => {
							event.preventDefault();
							setDragging(false);
							importDropped(event.dataTransfer.files);
						}}
					>
						<p>Drop a .cpgpack here to add or update a tool.</p>
						<Button
							type="button"
							variant="outline"
							className="mt-3"
							disabled={busy || !bridge}
							onClick={() =>
								bridge && void importPacks(() => bridge.importPacks())
							}
						>
							Import tool pack
						</Button>
					</div>
				</div>
			</main>
		</div>
	);
}
