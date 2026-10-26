import { useCallback, useMemo, useRef, useState } from "react";
import { HiOutlineCpuChip } from "react-icons/hi2";
import { VegaEmbed } from "react-vega";
import { useTheme } from "@/components/theme-provider";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { RunPublic } from "../../client";
import { humanReadableFileSize } from "../../utils";

/** One profiler reading the worker took while the run worked. */
interface Sample {
  t: number;
  cpu: number;
  rss: number;
  procs: number;
  threads: number;
  read: number;
  write: number;
}

/** The readings, with anything malformed left out. */
function readSamples(run: RunPublic): Sample[] {
  const number = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return (run.metrics ?? [])
    .filter((entry): entry is Record<string, unknown> => !!entry)
    .filter((entry) => typeof entry.t === "number")
    .map((entry) => ({
      t: number(entry.t),
      cpu: number(entry.cpu),
      rss: number(entry.rss),
      procs: number(entry.procs),
      threads: number(entry.threads),
      read: number(entry.read),
      write: number(entry.write),
    }));
}

function lineSpec({
  values,
  field,
  title,
  axis,
  width,
}: {
  values: Record<string, number>[];
  field: string;
  title: string;
  axis: string;
  width: number;
}) {
  return {
    width,
    height: 200,
    data: { values },
    mark: { type: "line", interpolate: "monotone" },
    encoding: {
      x: {
        field: "t",
        type: "quantitative",
        title: "seconds",
        axis: { grid: false },
      },
      y: { field, type: "quantitative", title: axis },
      tooltip: [
        { field: "t", type: "quantitative", title: "seconds" },
        { field, type: "quantitative", title: axis },
      ],
    },
    title: { text: title, fontSize: 12, anchor: "start" },
  };
}

/**
 * What a run used while it worked, from the readings the worker takes of its
 * process tree. Runs from before the profiler have no readings and show no
 * section at all.
 */
export default function RunProfiler({ run }: { run: RunPublic }) {
  const { resolvedTheme } = useTheme();
  const readings = useMemo(() => readSamples(run), [run]);
  const [width, setWidth] = useState(460);
  const observer = useRef<ResizeObserver | null>(null);

  // A callback ref, because the accordion only mounts the charts when it opens.
  const measure = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    observer.current = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.current.observe(node);
  }, []);

  const running = run.status === "running" || run.status === "pending";
  if (!readings.length && !running) return null;

  const peakCpu = readings.length
    ? Math.max(...readings.map((reading) => reading.cpu))
    : 0;
  const peakMemory = readings.length
    ? Math.max(...readings.map((reading) => reading.rss))
    : 0;
  const processes = readings.length
    ? Math.max(...readings.map((reading) => reading.procs))
    : 0;
  const threads = readings.length
    ? Math.max(...readings.map((reading) => reading.threads))
    : 0;
  const last = readings[readings.length - 1];
  // Never ask for a chart wider than the panel, or it would grow to fit.
  const half = Math.max(180, Math.floor((Math.min(width, 1000) - 24) / 2));
  const theme = resolvedTheme === "dark" ? "dark" : undefined;

  const stats = [
    {
      label: "Peak CPU",
      value: `${Math.round(peakCpu)}%${
        run.cpus
          ? ` of ${run.cpus} reserved CPU${run.cpus === 1 ? "" : "s"}`
          : ""
      }`,
    },
    { label: "Peak memory", value: humanReadableFileSize(peakMemory) },
    { label: "Processes", value: String(processes) },
    // The threads of the command's tree, which is not the same thing as the
    // CPUs the run reserved: a command that has to go through a shell to
    // start something has one of those too.
    { label: "OS threads", value: String(threads) },
    {
      label: "Read / written",
      value: last
        ? `${humanReadableFileSize(last.read)} / ${humanReadableFileSize(
            last.write,
          )}`
        : "-",
    },
  ];

  return (
    <AccordionItem value="resources">
      <AccordionTrigger>
        <span className="flex items-center">
          <HiOutlineCpuChip />
          <span className="ml-2">Resources</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {!readings.length ? (
          <p className="text-sm text-muted-foreground">
            Resource use appears here a few seconds into the run.
          </p>
        ) : (
          <div className="flex flex-col gap-4 pt-1">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-muted-foreground">{stat.label}</dt>
                  <dd className="font-medium">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <div
              ref={measure}
              className="flex flex-col gap-4 overflow-hidden lg:flex-row"
            >
              <VegaEmbed
                spec={
                  lineSpec({
                    values: readings.map(({ t, cpu }) => ({
                      t,
                      percent: cpu,
                    })),
                    field: "percent",
                    title: "CPU",
                    axis: "percent of one core",
                    width: half,
                  }) as object
                }
                options={{ actions: false, padding: 4, theme }}
              />
              <VegaEmbed
                spec={
                  lineSpec({
                    values: readings.map(({ t, rss }) => ({
                      t,
                      mb: Math.round((rss / 1e6) * 10) / 10,
                    })),
                    field: "mb",
                    title: "Memory",
                    axis: "MB resident",
                    width: half,
                  }) as object
                }
                options={{ actions: false, padding: 4, theme }}
              />
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
