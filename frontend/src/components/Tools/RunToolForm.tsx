import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, HelpCircle, LoaderCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
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
  type FilePublic,
  FilesService,
  type FileTypeEnum,
  type Param,
  type ParamVisibilityOperator,
  type RunPublic,
} from "../../client"
import { createRunMutation } from "../../client/@tanstack/react-query.gen"
import useAuth from "../../hooks/useAuth"
import useCustomToast from "../../hooks/useCustomToast"
import { cn } from "../../lib/utils"
import { handleError } from "../../utils"
import TagInput from "../Common/TagInput"
import FileUploadButton from "../Files/UploadFileButtonWithProgress"
import EmailOnFinished from "./EmailOnFinished"

interface FileParamProps {
  param: Param
  data: FilePublic[]
  isLoading: boolean
  values: string[]
  updateValues: (update: (values: string[]) => string[]) => void
  setIsLoading: (loading: boolean) => void
  disabled: boolean
}

const FileParam = ({
  param,
  data,
  isLoading,
  values,
  updateValues,
  setIsLoading,
  disabled,
}: FileParamProps) => {
  const fileLabel = (file: FilePublic) =>
    `${file.name} (${file.file_type}${
      file.is_group ? `, group of size ${file.children?.length ?? 0}` : ""
    })`

  return (
    <div className="flex flex-col gap-2">
      {param.multiple ? (
        <MultiSelect
          id={param.name}
          options={data.map((file) => ({
            label: fileLabel(file),
            value: file.id,
            // A group stands for the files it holds, a pair for one unit.
            unitCount: file.is_group ? (file.children?.length ?? 1) : 1,
          }))}
          value={values}
          onValueChange={(nextValues) => updateValues(() => nextValues)}
          placeholder="Choose multiple files"
          searchPlaceholder="Search files..."
          emptyMessage="No matching files found."
          disabled={disabled}
          loading={isLoading}
          aria-label={`Select files for ${param.name}`}
        />
      ) : (
        <select
          id={param.name}
          disabled={disabled || isLoading}
          value={values[0] ?? ""}
          className="min-h-10 rounded-md border bg-background px-3 py-2"
          onChange={(event) =>
            updateValues(() => (event.target.value ? [event.target.value] : []))
          }
        >
          <option value="">Choose a file</option>
          {data.map((file) => (
            <option key={file.id} value={file.id}>
              {fileLabel(file)}
            </option>
          ))}
        </select>
      )}
      {!disabled && (
        <FileUploadButton
          onComplete={(file) =>
            updateValues((currentValues) =>
              param.multiple
                ? Array.from(new Set([...currentValues, file.id]))
                : [file.id],
            )
          }
          onStart={() => setIsLoading(true)}
          onEnd={() => setIsLoading(false)}
        />
      )}
    </div>
  )
}

interface RunToolFormProps {
  toolId: string
  params: Param[]
  onSuccess?: (run: RunPublic) => void
  isDisabled?: boolean
  minCpus?: number | null
  maxCpus?: number | null
  defaultCpus?: number | null
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "number" && Number.isNaN(value))
  )
}

function parseVisibilityValue(
  value: unknown,
  param: Param,
  operator: ParamVisibilityOperator,
) {
  const parseScalar = (rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined || rawValue === "")
      return null

    if (param.param_type === "bool") {
      if (typeof rawValue === "boolean") return rawValue
      if (typeof rawValue === "string") {
        const lowered = rawValue.trim().toLowerCase()
        if (["true", "1", "yes", "on"].includes(lowered)) return true
        if (["false", "0", "no", "off"].includes(lowered)) return false
      }
      return null
    }

    if (param.param_type === "int") {
      const parsed = Number.parseInt(String(rawValue), 10)
      return Number.isNaN(parsed) ? null : parsed
    }

    if (param.param_type === "float") {
      const parsed = Number.parseFloat(String(rawValue))
      return Number.isNaN(parsed) ? null : parsed
    }

    return String(rawValue)
  }

  if (
    operator === "truthy" ||
    operator === "falsy" ||
    operator === "is_set" ||
    operator === "is_empty"
  ) {
    return null
  }

  if (operator === "in" || operator === "not_in") {
    if (value === null || value === undefined) return []
    if (Array.isArray(value)) return value.map((item) => parseScalar(item))
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => parseScalar(item))
    }
    return [parseScalar(value)]
  }

  if (value === null || value === undefined || value === "") return null

  return parseScalar(value)
}

function matchesVisibilityCondition({
  dependencyValue,
  operator,
  expectedValue,
}: {
  dependencyValue: unknown
  operator: ParamVisibilityOperator
  expectedValue: unknown
}) {
  if (operator === "truthy") return Boolean(dependencyValue)
  if (operator === "falsy") return !dependencyValue
  if (operator === "is_set") return !isEmptyValue(dependencyValue)
  if (operator === "is_empty") return isEmptyValue(dependencyValue)

  if (operator === "equals") return dependencyValue === expectedValue
  if (operator === "not_equals") return dependencyValue !== expectedValue
  if (operator === "in") {
    if (Array.isArray(expectedValue)) {
      if (Array.isArray(dependencyValue)) {
        return dependencyValue.some((item) => expectedValue.includes(item))
      }
      return expectedValue.includes(dependencyValue)
    }
    return false
  }
  if (operator === "not_in") {
    if (Array.isArray(expectedValue)) {
      if (Array.isArray(dependencyValue)) {
        return dependencyValue.every((item) => !expectedValue.includes(item))
      }
      return !expectedValue.includes(dependencyValue)
    }
    return true
  }
  if (
    typeof dependencyValue !== "number" ||
    typeof expectedValue !== "number"
  ) {
    return false
  }
  if (operator === "greater_than") return dependencyValue > expectedValue
  if (operator === "greater_than_or_equal")
    return dependencyValue >= expectedValue
  if (operator === "less_than") return dependencyValue < expectedValue
  if (operator === "less_than_or_equal") return dependencyValue <= expectedValue
  return false
}

function buildVisibilityMap(params: Param[], values: Record<string, unknown>) {
  const paramsByName = new Map(params.map((param) => [param.name, param]))
  const cache = new Map<string, boolean>()
  const visiting = new Set<string>()

  const getVisible = (name: string): boolean => {
    const cached = cache.get(name)
    if (cached !== undefined) return cached
    if (visiting.has(name)) return false

    const param = paramsByName.get(name)
    if (!param) return true

    visiting.add(name)
    let visible = true
    if (param.visible_if_param) {
      const dependency = paramsByName.get(param.visible_if_param)
      if (!dependency) {
        visible = false
      } else if (getVisible(dependency.name)) {
        const dependencyValue = values[dependency.name] ?? dependency.default
        const operator = param.visible_if_operator ?? "equals"
        const expectedValue = parseVisibilityValue(
          param.visible_if_value,
          dependency,
          operator,
        )
        visible = matchesVisibilityCondition({
          dependencyValue,
          operator,
          expectedValue,
        })
      } else {
        visible = false
      }
    }
    visiting.delete(name)
    cache.set(name, visible)
    return visible
  }

  for (const param of params) getVisible(param.name)
  return cache
}

const THREADS_STORAGE_PREFIX = "CPG_PORTAL_RUN_THREADS_"

// The threads picked for a tool are remembered per browser, clamped to what is
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

const RunToolForm = ({
  toolId,
  params,
  onSuccess,
  isDisabled = false,
  minCpus,
  maxCpus,
  defaultCpus,
}: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [tags, setTags] = useState<string[]>([])
  const [emailOnFinished, setEmailOnFinished] = useState(false)
  const [runName, setRunName] = useState<string | null>(null)

  // A tool that needs a fixed number of threads does not offer the choice at
  // all. A tool without a maximum leaves the user's own limit as the maximum,
  // and a tool without a default starts at its minimum.
  const minThreads = Math.max(1, minCpus ?? 1)
  const toolMax = maxCpus ?? user?.max_cpus ?? 1
  const fixedThreads = maxCpus != null && minThreads === maxCpus
  const effectiveMax = user?.is_superuser
    ? Math.max(minThreads, toolMax)
    : Math.max(minThreads, Math.min(toolMax, user?.max_cpus ?? toolMax))
  // Whether the user's own limit is what caps the tool's range.
  const cappedByUser =
    !user?.is_superuser && (user?.max_cpus ?? toolMax) < toolMax
  const threadOptions = useMemo(
    () =>
      Array.from(
        { length: effectiveMax - minThreads + 1 },
        (_, index) => minThreads + index,
      ),
    [effectiveMax, minThreads],
  )

  const threadsKey = `${THREADS_STORAGE_PREFIX}${toolId}`
  // Only a pick made on this page counts as an override; a remembered one is
  // just the starting point, and the files decide when they have a say.
  const [threads, setThreads] = useState<number | null>(null)
  const chooseThreads = (value: number) => {
    setThreads(value)
    storeThreads(threadsKey, value)
  }

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

  // The file pickers and the threads default both need the files a tool's file
  // parameters may choose from, so they are loaded here.
  const fileParams = params.filter((param) => param.param_type === "file")
  const fileQueries = useQueries({
    queries: fileParams.map((param) => ({
      enabled: !isDisabled,
      queryKey: ["files", param.name],
      queryFn: () =>
        FilesService.readFiles({
          query: {
            types: param.allowed_file_types?.map(
              (type) => type as FileTypeEnum,
            ),
          },
        }).then(({ data }) => data?.data || []),
    })),
  })
  const fileQueriesByParam = new Map(
    fileParams.map((param, index) => [param.name, fileQueries[index]]),
  )

  // Tools that take a batch of input files usually want a thread per file, or
  // the CPUs the tool asked for per file, so that is the default when the tool
  // has not named one. A parameter with zero CPUs per file does not scale at
  // all, for tools where only some file parameters should, a group of files
  // counts as the files it holds, and a pair stays one unit of work.
  const chosenFileCount = params.reduce((count, param) => {
    if (!param.multiple || param.param_type !== "file") return count
    const configured = param.cpus_per_file ?? 1
    if (configured <= 0) return count
    const files = fileQueriesByParam.get(param.name)?.data ?? []
    const byId = new Map(files.map((file) => [file.id, file]))
    const chosen = (getValues(param.name) as string[] | undefined) ?? []
    const units = chosen.reduce((total, id) => {
      const file = byId.get(id)
      return total + (file?.is_group ? (file.children?.length ?? 1) : 1)
    }, 0)
    return count + units * configured
  }, 0)
  const defaultThreads = Math.max(
    minThreads,
    Math.min(defaultCpus ?? (chosenFileCount || minThreads), effectiveMax),
  )
  const storedThreads = useMemo(
    () => readStoredThreads(threadsKey, minThreads, effectiveMax),
    [threadsKey, minThreads, effectiveMax],
  )
  // A pick made here wins, then the default the chosen files imply, then the
  // threads this browser used for the tool last time.
  const threadsToUse = fixedThreads
    ? minThreads
    : (threads ??
      (chosenFileCount > 0
        ? defaultThreads
        : (storedThreads ?? defaultThreads)))

  const formValues = watch()
  const visibleParams = useMemo(
    () => buildVisibilityMap(params, formValues),
    [formValues, params],
  )

  const mutation = useMutation({
    ...createRunMutation(),
    onSuccess: (run: RunPublic) => {
      showToast("Success!", `Run Queued (${run.id})`, "success")
      onSuccess?.(run)
    },
    onError: (error) => handleError(error, showToast),
    onSettled: () => {
      setIsLoading(false)
      queryClient.invalidateQueries({ queryKey: ["toolRuns"] })
    },
  })

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
    await mutation.mutateAsync({
      body: { params: filtered, tags },
      query: {
        tool_id: toolId,
        email_on_completion: emailOnFinished,
        name: runName ?? undefined,
        cpus: threadsToUse,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="w-full">
      {params.map((param) => {
        if (!visibleParams.get(param.name)) return null
        return (
          <div className="pb-4" key={param.name}>
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
              <p className="mb-2 text-sm text-gray-500">{param.description}</p>
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
            {param.param_type === "file" && (
              <FileParam
                param={param}
                disabled={isDisabled}
                setIsLoading={setIsLoading}
                data={fileQueriesByParam.get(param.name)?.data ?? []}
                isLoading={
                  fileQueriesByParam.get(param.name)?.isLoading ?? false
                }
                values={(watch(param.name) as string[] | undefined) || []}
                updateValues={(update) => {
                  clearErrors(param.name)
                  setValue(
                    param.name,
                    update((getValues(param.name) as string[]) || []),
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
                  )
                }}
              />
            )}
          </div>
        )
      })}
      <div className="my-4 flex items-center gap-2">
        <Button type="submit" disabled={isDisabled || isLoading}>
          {isLoading && <LoaderCircle className="animate-spin" />}Submit
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isDisabled}
          onClick={() => reset(defaults)}
        >
          Reset
        </Button>
        <div className="ml-2">
          <EmailOnFinished
            emailOnFinished={emailOnFinished}
            setEmailOnFinished={setEmailOnFinished}
            isDisabled={isDisabled}
          />
        </div>
      </div>
      <h2 className="my-4 text-lg font-semibold">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 border-b pb-1"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          aria-controls="CPG_PORTAL_RUN_SETTINGS"
        >
          Run Settings
          <ChevronDown
            className={cn(
              "text-muted-foreground size-5 transition-transform",
              settingsOpen && "rotate-180",
            )}
          />
        </button>
      </h2>
      {settingsOpen && (
        <div id="CPG_PORTAL_RUN_SETTINGS" className="flex flex-col gap-4">
          {!fixedThreads && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="CPG_PORTAL_RUN_THREADS">CPU threads</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground size-5"
                        aria-label="What are threads?"
                      >
                        <HelpCircle className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <PopoverHeader>
                        <PopoverTitle>CPU threads</PopoverTitle>
                        <PopoverDescription>
                          The CPUs reserved for this run.
                        </PopoverDescription>
                      </PopoverHeader>
                      <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-sm">
                        <li>
                          {maxCpus == null
                            ? `This tool needs at least ${minThreads} threads.`
                            : `This tool allows ${minThreads}–${maxCpus} threads.`}
                        </li>
                        {cappedByUser && (
                          <li>{`Your own limit is ${user?.max_cpus} threads per run.`}</li>
                        )}
                        <li>
                          A run starts as soon as that many CPUs are free, and
                          waits in the queue until then.
                        </li>
                        <li>
                          More threads usually finish sooner, but may wait
                          longer to start.
                        </li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-sm text-gray-500">
                  {minThreads === effectiveMax
                    ? `${minThreads} available`
                    : `${minThreads}–${effectiveMax} available`}
                </p>
              </div>
              <Select
                value={String(threadsToUse)}
                onValueChange={(value) => chooseThreads(Number(value))}
                disabled={isDisabled}
              >
                <SelectTrigger id="CPG_PORTAL_RUN_THREADS" className="w-24">
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
          <div>
            <Label htmlFor="CPG_PORTAL_RUN_NAME">Run name</Label>
            <p className="mb-2 text-sm text-gray-500">
              Optional, named automatically if left blank
            </p>
            <Input
              id="CPG_PORTAL_RUN_NAME"
              disabled={isDisabled}
              onChange={(event) => setRunName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="CPG_PORTAL_RUN_TAGS">Tags</Label>
            <p className="mb-2 text-sm text-gray-500">
              Optional, used to find the run later
            </p>
            <TagInput tags={tags} setTags={setTags} isDisabled={isDisabled} />
          </div>
        </div>
      )}
    </form>
  )
}

export default RunToolForm
