import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import OutputAccordion from "@/components/Runs/OutputAccordion";
import RunTime from "@/components/Runs/RunTime";
import StatusBadge from "@/components/Runs/StatusBadge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "./api";
import { RunOutputs } from "./components/RunOutputs";
import { ToolSidebar } from "./components/ToolSidebar";
import {
	isRunActive,
	type RunLogMessage,
	type RunRecord,
	type ToolConfig,
	toRunPublic,
} from "./contracts";
import { openPath } from "./lib/desktop";
import { navigate } from "./router";

export function RunPage({ id }: { id: string }) {
	const [record, setRecord] = useState<RunRecord | null>(null);
	const [tool, setTool] = useState<ToolConfig | null>(null);
	const [environment, setEnvironment] = useState<string | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const next = await api.get<RunRecord>(`/runs/${id}`);
		setRecord(next);
		return next;
	}, [id]);

	useEffect(() => {
		void refresh().catch((error) => setLoadError(errorMessage(error)));
		void api
			.get<ToolConfig>("/tool")
			.then(setTool)
			.catch(() => {});
		void api
			.get<{ yml: string | null }>("/environment")
			.then((payload) => setEnvironment(payload.yml))
			.catch(() => {});
	}, [refresh]);

	const active = isRunActive(record?.status);

	useEffect(() => {
		if (!active) return;
		const interval = setInterval(() => {
			void refresh().catch(() => {});
		}, 1000);
		return () => clearInterval(interval);
	}, [active, refresh]);

	useEffect(() => {
		const socket = new WebSocket(api.wsUrl(`/runs/${id}/logs`));
		socket.onmessage = (event) => {
			let message: RunLogMessage;
			try {
				message = JSON.parse(String(event.data)) as RunLogMessage;
			} catch {
				return;
			}
			if (message.type === "log") {
				setLogs((previous) => [...previous, message.line].slice(-2000));
				return;
			}
			if (message.type === "status") {
				setRecord((previous) =>
					previous
						? {
								...previous,
								status: message.status,
								exit_code: message.exit_code ?? previous.exit_code,
							}
						: previous,
				);
				if (!isRunActive(message.status)) void refresh();
			}
		};
		return () => socket.close();
	}, [id, refresh]);

	async function cancel() {
		try {
			await api.post(`/runs/${id}/cancel`);
			await refresh();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	}

	const stdoutTail = record?.stdout
		? record.stdout.trimEnd().split("\n").slice(-30).join("\n")
		: "";
	const run = record && tool ? toRunPublic(record, tool, environment) : null;

	return (
		<div className="flex h-full">
			<ToolSidebar activeToolId={tool?.id ?? null} />

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="shrink-0 border-b px-8 py-6">
					<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
						<div className="flex flex-wrap items-center gap-3">
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => navigate("/tool")}
							>
								New run
							</Button>
							<h1 className="text-xl font-semibold">
								Run {record?.id ? record.id.slice(0, 8) : id.slice(0, 8)}
							</h1>
							{record && <StatusBadge status={record.status} />}
							{record && (
								<span className="text-muted-foreground text-sm">
									<RunTime
										started_at={record.started_at ?? null}
										finished_at={record.finished_at ?? null}
										status={record.status}
									/>
								</span>
							)}
						</div>
						<div className="flex gap-2">
							{active && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => void cancel()}
								>
									Cancel
								</Button>
							)}
							{record?.output_dir && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => openPath(record.output_dir as string)}
								>
									Open output folder
								</Button>
							)}
						</div>
					</div>
				</header>

				<main className="min-h-0 flex-1 overflow-auto px-8 py-6">
					<div className="mx-auto grid max-w-4xl gap-6">
						{loadError && (
							<p className="text-destructive text-sm">{loadError}</p>
						)}

						{run && (
							<OutputAccordion
								run={run}
								logStream={{ lines: logs, status: record?.status }}
							/>
						)}

						{record?.status === "failed" && (
							<section className="grid gap-2">
								<h2 className="text-lg font-semibold">Failure</h2>
								{record.error && (
									<p className="text-destructive text-sm">{record.error}</p>
								)}
								{stdoutTail && (
									<pre className="bg-muted overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
										{stdoutTail}
									</pre>
								)}
							</section>
						)}

						<section className="grid gap-2">
							<h2 className="text-lg font-semibold">Outputs</h2>
							<RunOutputs runId={id} files={record?.files ?? []} />
						</section>
					</div>
				</main>
			</div>
		</div>
	);
}
