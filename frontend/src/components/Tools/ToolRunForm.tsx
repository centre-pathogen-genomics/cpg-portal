import { ChevronDown, HelpCircle, LoaderCircle, Search } from "lucide-react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import type { Param } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildVisibilityMap,
  countFileCpus,
  type FileUnit,
  isEmptyValue,
} from "@/lib/run-params"
import { cn } from "@/lib/utils"

export interface LocalFilePickerProps {
  param: Param
  values: string[]
  onChange: (values: string[]) => void
  disabled: boolean
}

/**
 * The run form itself: parameters, visibility, CPUs and validation. It holds no
 * portal state, so the portal and the desktop app both use it: each supplies
 * its own file picker, its own submit and whatever extra settings it has.
 */
export interface ToolRunFormProps {
  params: Param[]
  /** Identity of the tool, for remembering the thread choice per tool. */
  formKey: string
  isDisabled?: boolean
  minCpus?: number | null
  maxCpus?: number | null
  defaultCpus?: number | null
  /** The caller's own CPU ceiling, e.g. the portal user's limit. */
  userMaxCpus?: number | null
  isSuperuser?: boolean
  submitLabel?: string
  /** Creates the run. Throwing keeps the form open. */
  onSubmit: (input: {
    params: Record<string, unknown>
    cpus: number
  }) => Promise<void>
  /** The picker for one file parameter. */
  renderFilePicker: (props: LocalFilePickerProps) => ReactNode
  /**
   * What a file parameter's chosen files count as. Defaults to one file per
   * chosen value, which is what a path is.
   */
  fileUnits?: (param: Param) => FileUnit[]
  /** Field errors to show under a parameter, keyed by parameter name. */
  mapError?: (error: unknown) => Record<string, string> | null
  /** Class for the `<form>` element, e.g. a grid for a desktop layout. */
  className?: string
  /**
   * Arranges the form's parts. The default stacks them, which is what the
   * portal wants; the desktop app puts the parameters in the middle and the
   * settings in a side panel.
   */
  renderShell?: (parts: {
    params: ReactNode
    settings: ReactNode
    submit: ReactNode
  }) => ReactNode
  /** Portal-only fields, e.g. run name and tags, shown inside Run Settings. */
  extras?: ReactNode
  /** Portal-only buttons shown next to submit, e.g. email on completion. */
  submitExtras?: ReactNode
  /** Widen the run button across the row, e.g. a full-width footer. */
  fillSubmit?: boolean
  /**
   * The CPUs are this computer's own, not a shared pool: the help text says so
   * instead of describing reservations and a queue.
   */
  localCpus?: boolean
  /**
   * Values from an earlier run, to prefill the form with (e.g. a rerun):
   * `{...run.params, ...run.param_files}`. Anything that no longer fits is left
   * at its default.
   */
  initialValues?: Record<string, unknown>
  /** False while the caller is still loading what `initialValues` needs. */
  initialValuesReady?: boolean
  /** The threads the run being repeated used, clamped to the range now. */
  initialThreads?: number | null
}

const THREADS_STORAGE_PREFIX = "CPG_RUN_THREADS_"

// One key for every tool: the run settings section is either shown everywhere
// or hidden everywhere, which is what a user expects from a shared panel.
const RUN_SETTINGS_OPEN_KEY = "CPG_RUN_SETTINGS_OPEN"

function readStoredSettingsOpen(): boolean | null {
  try {
    const stored = window.localStorage.getItem(RUN_SETTINGS_OPEN_KEY)
    return stored === null ? null : stored === "true"
  } catch {
    return null
  }
}

function storeSettingsOpen(open: boolean): void {
  try {
    window.localStorage.setItem(RUN_SETTINGS_OPEN_KEY, String(open))
  } catch {
    // Storage may be unavailable (private browsing); remembering is a nicety.
  }
}

// The threads picked for a tool are remembered per machine, clamped to what is
// allowed right now (the limits may have changed since).
function readStoredThreads(
  key: string,
  min: number,
  max: number,
): number | null {
  try {
    const stored = Number(window.localStorage.getItem(key))
    if (!Number.isInteger(stored) || stored < 1) return null
    return Math.min(Math.max(stored, min), max)
  } catch {
    return null
  }
}

function storeThreads(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Storage may be unavailable (private browsing); remembering is a nicety.
  }
}

// One unit per chosen value: a portal file id and a local path are both values.
function valuesAsFiles(values: unknown): FileUnit[] {
  const chosen = Array.isArray(values) ? values : values ? [values] : []
  return chosen
    .filter((value): value is string => typeof value === "string")
    .map((value) => ({ id: value, is_group: false, children: [] }))
}

const ToolRunForm = ({
  params,
  formKey,
  isDisabled = false,
  minCpus,
  maxCpus,
  defaultCpus,
  userMaxCpus,
  isSuperuser = false,
  submitLabel = "Submit",
  onSubmit,
  renderFilePicker,
  fileUnits,
  mapError,
  className,
  renderShell,
  extras,
  submitExtras,
  fillSubmit = false,
  localCpus = false,
  initialValues,
  initialValuesReady = true,
  initialThreads,
}: ToolRunFormProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [paramFilter, setParamFilter] = useState("")
  const [settingsOpen, setSettingsOpen] = useState<boolean>(
    () => readStoredSettingsOpen() ?? true,
  )
  const toggleSettings = () => {
    setSettingsOpen((open) => {
      storeSettingsOpen(!open)
      return !open
    })
  }

  // A tool that needs a fixed number of threads does not offer the choice at
  // all. A tool without a maximum leaves the user's own limit as the maximum,
  // and a tool without a default starts at its minimum.
  const minThreads = Math.max(1, minCpus ?? 1)
  const toolMax = maxCpus ?? userMaxCpus ?? 1
  const fixedThreads = maxCpus != null && minThreads === maxCpus
  const effectiveMax = isSuperuser
    ? Math.max(minThreads, toolMax)
    : Math.max(minThreads, Math.min(toolMax, userMaxCpus ?? toolMax))
  // Whether the user's own limit is what caps the tool's range.
  const cappedByUser = !isSuperuser && (userMaxCpus ?? toolMax) < toolMax
  const threadsKey = `${THREADS_STORAGE_PREFIX}${formKey}`
  // Only a pick made on this page counts as an override; a remembered one is
  // just the starting point, and the files decide when they have a say.
  const [threads, setThreads] = useState<number | null>(null)
  const chooseThreads = useCallback(
    (value: number) => {
      setThreads(value)
      storeThreads(threadsKey, value)
    },
    [threadsKey],
  )

  const defaults = useMemo(() => {
    const values: Record<string, unknown> = {}
    for (const param of params) values[param.name] = param.default
    return values
  }, [params])

  const {
    register,
    clearErrors,
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: defaults,
  })

  const fileParams = params.filter((param) => param.param_type === "file")
  const filesByParam = new Map(
    fileParams.map((param) => [
      param.name,
      fileUnits ? fileUnits(param) : valuesAsFiles(getValues(param.name)),
    ]),
  )

  // A tool that names a cpus_per_file only gets work out of the CPUs its files
  // imply, so it cannot be given more than they add up to: fewer files mean
  // fewer CPUs, and the rest would sit idle.
  const scalesWithFiles = params.some(
    (param) =>
      param.multiple &&
      param.param_type === "file" &&
      (param.cpus_per_file ?? 0) > 0,
  )
  const chosenFileCount = countFileCpus(params, filesByParam, getValues())
  const maxThreads = scalesWithFiles
    ? Math.min(effectiveMax, Math.max(minThreads, chosenFileCount))
    : effectiveMax
  const threadOptions = useMemo(
    () =>
      Array.from(
        { length: maxThreads - minThreads + 1 },
        (_, index) => minThreads + index,
      ),
    [maxThreads, minThreads],
  )
  const defaultThreads = Math.max(
    minThreads,
    Math.min(defaultCpus ?? (chosenFileCount || minThreads), maxThreads),
  )
  const storedThreads = useMemo(
    () => readStoredThreads(threadsKey, minThreads, maxThreads),
    [threadsKey, minThreads, maxThreads],
  )
  // A pick made here wins, then the default the chosen files imply, then the
  // threads this machine used for the tool last time. The files cap the pick,
  // so removing files lowers the CPUs even when one was picked by hand.
  const threadsToUse = fixedThreads
    ? minThreads
    : Math.min(
        maxThreads,
        threads ??
          (chosenFileCount > 0
            ? defaultThreads
            : (storedThreads ?? defaultThreads)),
      )

  // Prefill from an earlier run: a parameter the tool no longer has, a file
  // that no longer exists and a choice the tool no longer offers are all left
  // at their default.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !initialValues || !initialValuesReady) return
    prefilled.current = true
    const next: Record<string, unknown> = {}
    for (const param of params) {
      const recorded = initialValues?.[param.name]
      if (recorded === undefined || recorded === null) continue
      if (param.param_type === "file") {
        const allowed = new Set(filesByParam.get(param.name)?.map((f) => f.id))
        const ids = (Array.isArray(recorded) ? recorded : [recorded]).flat()
        // An empty set means the caller has no list to check against (the
        // desktop's files come from the disk, not from a query), so what the
        // run recorded is offered as it was.
        const usable = ids.filter(
          (id): id is string =>
            typeof id === "string" && (allowed.size === 0 || allowed.has(id)),
        )
        if (usable.length) next[param.name] = usable
        continue
      }
      if (
        param.param_type === "enum" &&
        !(param.options ?? []).includes(String(recorded))
      ) {
        continue
      }
      next[param.name] = recorded
    }
    const nextValues = { ...getValues(), ...next }
    reset(nextValues)
    if (initialThreads != null) {
      // The threads may no longer fit, e.g. the tool's limits changed or the
      // prefilled files imply fewer, and a select with no matching option
      // shows blank.
      const prefillMax = scalesWithFiles
        ? Math.min(
            effectiveMax,
            Math.max(
              minThreads,
              countFileCpus(params, filesByParam, nextValues),
            ),
          )
        : effectiveMax
      chooseThreads(Math.max(minThreads, Math.min(initialThreads, prefillMax)))
    }
  }, [
    initialValues,
    initialValuesReady,
    initialThreads,
    params,
    filesByParam,
    getValues,
    reset,
    minThreads,
    effectiveMax,
    scalesWithFiles,
    chooseThreads,
  ])

  const formValues = watch()
  const visibleParams = useMemo(
    () => buildVisibilityMap(params, formValues),
    [formValues, params],
  )

  const submit: SubmitHandler<Record<string, unknown>> = async (formData) => {
    clearErrors()
    let hasValidationError = false
    for (const param of params) {
      if (!visibleParams.get(param.name)) continue
      if (param.required && isEmptyValue(formData[param.name])) {
        setError(param.name, { type: "required", message: "Required" })
        hasValidationError = true
      }
    }
    if (hasValidationError) return

    const filtered = Object.fromEntries(
      Object.entries(formData).filter(
        ([name, value]) => visibleParams.get(name) && !isEmptyValue(value),
      ),
    )
    setIsLoading(true)
    try {
      await onSubmit({ params: filtered, cpus: threadsToUse })
    } catch (error) {
      const fieldErrors = mapError?.(error)
      if (fieldErrors) {
        for (const [name, message] of Object.entries(fieldErrors)) {
          setError(name, { type: "value", message })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const filterQuery = paramFilter.trim().toLowerCase()

  const paramFields = (
    <>
      {params.length > 8 && (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search parameters"
            value={paramFilter}
            onChange={(event) => setParamFilter(event.target.value)}
            className="pl-9"
          />
        </div>
      )}
      {params.map((param) => {
        if (!visibleParams.get(param.name)) return null
        if (filterQuery && !param.name.toLowerCase().includes(filterQuery))
          return null
        return (
          <div className="pb-6" key={param.name}>
            <Label htmlFor={param.name}>
              {param.name.toUpperCase()}
              {param.required && " *"}
              {errors[param.name] && (
                <div className="text-destructive pt-0 mt-0">
                  {String(errors[param.name]?.message)}
                </div>
              )}
            </Label>
            {param.param_type !== "bool" && (
              <p className="mb-2 max-w-[75ch] text-sm text-foreground/70">
                {param.description}
              </p>
            )}
            {param.param_type === "str" && (
              <Input
                id={param.name}
                disabled={isDisabled}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                })}
              />
            )}
            {(param.param_type === "int" || param.param_type === "float") && (
              <Input
                id={param.name}
                disabled={isDisabled}
                type="number"
                step={param.param_type === "float" ? "0.01" : undefined}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                  valueAsNumber: true,
                })}
              />
            )}
            {param.param_type === "enum" && (
              <select
                id={param.name}
                disabled={isDisabled}
                className="h-10 w-full rounded-md border bg-background px-3"
                value={(watch(param.name) as string | undefined) ?? ""}
                onChange={(event) => {
                  clearErrors(param.name)
                  setValue(param.name, event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
              >
                <option value="">Select an option</option>
                {param.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
            {param.param_type === "bool" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={param.name}
                  disabled={isDisabled}
                  defaultChecked={param.default as boolean}
                  onCheckedChange={(checked) => {
                    clearErrors(param.name)
                    setValue(param.name, checked === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
                <Label htmlFor={param.name}>
                  {param.description || "Check to enable"}
                </Label>
              </div>
            )}
            {param.param_type === "file" &&
              renderFilePicker({
                param,
                disabled: isDisabled,
                values: (watch(param.name) as string[] | undefined) || [],
                onChange: (next) => {
                  clearErrors(param.name)
                  setValue(param.name, next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                },
              })}
          </div>
        )
      })}
    </>
  )

  // The CPUs control plus whatever the caller adds, e.g. the portal's run name
  // and tags. The desktop app shows these in its configuration panel.
  const settingsFields = (
    <>
      {extras}
      {!fixedThreads && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1">
              <Label htmlFor="CPG_RUN_THREADS">CPUs</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground size-5"
                    aria-label="What are CPUs?"
                  >
                    <HelpCircle className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <PopoverHeader>
                    <PopoverTitle>CPUs</PopoverTitle>
                    <PopoverDescription>
                      {localCpus
                        ? "The CPUs this run may use on this computer."
                        : "The CPUs reserved for this run."}
                    </PopoverDescription>
                  </PopoverHeader>
                  <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-sm">
                    <li>
                      {maxCpus == null
                        ? `This tool needs at least ${minThreads} ${
                            minThreads === 1 ? "CPU" : "CPUs"
                          }.`
                        : `This tool allows ${minThreads}-${maxCpus} CPUs.`}
                    </li>
                    {cappedByUser && (
                      <li>
                        {localCpus
                          ? `This computer has ${userMaxCpus} CPUs.`
                          : `Your own limit is ${userMaxCpus} CPUs per run.`}
                      </li>
                    )}
                    {scalesWithFiles && (
                      <li>
                        {`CPUs scale with the chosen files, which allow at most ${maxThreads} ${
                          maxThreads === 1 ? "CPU" : "CPUs"
                        }.`}
                      </li>
                    )}
                    {!localCpus && (
                      <li>
                        A run starts as soon as that many CPUs are free, and
                        waits in the queue until then.
                      </li>
                    )}
                    <li>
                      {localCpus
                        ? "More CPUs usually finish sooner, but may wait for them to free up."
                        : "More CPUs usually finish sooner, but may wait longer to start."}
                    </li>
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-sm text-gray-500">
              {minThreads === maxThreads
                ? `${minThreads} available`
                : `${minThreads}-${maxThreads} available`}
            </p>
          </div>
          <Select
            value={String(threadsToUse)}
            onValueChange={(value) => {
              const selected = Number(value)
              // Radix echoes its own controlled value back through this
              // callback, and an empty string while its options are not
              // mounted. Neither is a pick the user made.
              if (
                !Number.isInteger(selected) ||
                selected < 1 ||
                selected === threadsToUse
              ) {
                return
              }
              chooseThreads(selected)
            }}
            disabled={isDisabled}
          >
            <SelectTrigger id="CPG_RUN_THREADS" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {threadOptions.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )

  const submitRow = (
    <div className="my-4 flex items-center gap-2">
      <Button
        type="submit"
        className={cn(fillSubmit && "flex-1")}
        disabled={isDisabled || isLoading}
      >
        {isLoading && <LoaderCircle className="animate-spin" />}
        {submitLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isDisabled}
        onClick={() => reset(defaults)}
      >
        Reset
      </Button>
      {submitExtras && <div className="ml-2">{submitExtras}</div>}
    </div>
  )

  if (renderShell) {
    return (
      <form onSubmit={handleSubmit(submit)} className={className ?? "w-full"}>
        {renderShell({
          params: paramFields,
          settings: settingsFields,
          submit: submitRow,
        })}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit(submit)} className={className ?? "w-full"}>
      {paramFields}

      <h2 className="mt-2 mb-4 text-lg ">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 border-b pb-1 font-semibold"
          onClick={toggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="CPG_RUN_SETTINGS"
        >
          Run Settings
          <div className="flex items-center justify-between gap-2 font-normal">
            {!settingsOpen && (
              <p className="text-sm text-gray-400">click to open</p>
            )}
            <ChevronDown
              className={cn(
                "text-muted-foreground size-5 transition-transform",
                settingsOpen && "rotate-180",
              )}
            />
          </div>
        </button>
      </h2>

      {settingsOpen && (
        <div id="CPG_RUN_SETTINGS" className="flex flex-col gap-4">
          {settingsFields}
        </div>
      )}
      {submitRow}
    </form>
  )
}

export default ToolRunForm
