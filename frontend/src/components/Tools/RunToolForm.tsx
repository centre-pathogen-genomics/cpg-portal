import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, LoaderCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  FilesService,
  type FileTypeEnum,
  type Param,
  type RunPublic,
} from "../../client"
import { createRunMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"
import TagInput from "../Common/TagInput"
import FileUploadButton from "../Files/UploadFileButtonWithProgress"
import EmailOnFinished from "./EmailOnFinished"

interface FileParamProps {
  param: Param
  values: string[]
  setValues: (values: string[]) => void
  setIsLoading: (loading: boolean) => void
  disabled: boolean
}

const FileParam = ({
  param,
  values,
  setValues,
  setIsLoading,
  disabled,
}: FileParamProps) => {
  const types = param.allowed_file_types?.map((type) => type as FileTypeEnum)
  const { data = [], isLoading } = useQuery({
    enabled: !disabled,
    queryKey: ["files", param.name],
    queryFn: () =>
      FilesService.readFiles({ query: { types } }).then(
        ({ data }) => data?.data || [],
      ),
  })

  const fileLabel = (file: (typeof data)[number]) =>
    `${file.name} (${file.file_type}${file.is_group ? ", group" : ""})`

  const selectedFile = data.find((file) => file.id === values[0])
  const selectionLabel =
    values.length === 0
      ? "Choose multiple files"
      : values.length === 1
        ? selectedFile
          ? fileLabel(selectedFile)
          : "1 file selected"
        : `${values.length} files selected`

  const toggleValue = (value: string, checked: boolean) => {
    if (checked) {
      setValues(Array.from(new Set([...values, value])))
      return
    }
    setValues(values.filter((selectedValue) => selectedValue !== value))
  }

  return (
    <div className="flex flex-col gap-2">
      {param.multiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={param.name}
              type="button"
              variant="outline"
              disabled={disabled || isLoading}
              aria-label={`Select files for ${param.name}`}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">{selectionLabel}</span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {data.map((file) => (
              <DropdownMenuCheckboxItem
                key={file.id}
                checked={values.includes(file.id)}
                onCheckedChange={(checked) =>
                  toggleValue(file.id, checked === true)
                }
                onSelect={(event) => event.preventDefault()}
              >
                <span className="truncate">{fileLabel(file)}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <select
          id={param.name}
          disabled={disabled || isLoading}
          value={values[0] ?? ""}
          className="min-h-10 rounded-md border bg-background px-3 py-2"
          onChange={(event) =>
            setValues(event.target.value ? [event.target.value] : [])
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
            setValues(
              param.multiple
                ? Array.from(new Set([...values, file.id]))
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
}

const RunToolForm = ({
  toolId,
  params,
  onSuccess,
  isDisabled = false,
}: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [emailOnFinished, setEmailOnFinished] = useState(false)
  const [runName, setRunName] = useState<string | null>(null)
  const defaults = useMemo(() => {
    const values: Record<string, any> = {}
    for (const param of params) values[param.name] = param.default
    return values
  }, [params])
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Record<string, any>>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: defaults,
  })
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
  const submit: SubmitHandler<Record<string, any>> = async (formData) => {
    setIsLoading(true)
    const filtered = Object.fromEntries(
      Object.entries(formData).filter(([, value]) => value !== null),
    )
    await mutation.mutateAsync({
      body: { params: filtered, tags },
      query: {
        tool_id: toolId,
        email_on_completion: emailOnFinished,
        name: runName ?? undefined,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="w-full">
      <div className="pb-4">
        <Label htmlFor="CPG_PORTAL_RUN_NAME">NAME</Label>
        <p className="mb-2 text-sm text-gray-500">
          Enter a name for the run (optional)
        </p>
        <Input
          id="CPG_PORTAL_RUN_NAME"
          disabled={isDisabled}
          onChange={(event) => setRunName(event.target.value)}
        />
      </div>
      {params.map((param) => (
        <div className="pb-4" key={param.name}>
          <Label htmlFor={param.name}>
            {param.name.toUpperCase()}
            {param.required && " *"}
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
              value={watch(param.name) ?? ""}
              onChange={(event) => setValue(param.name, event.target.value)}
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
                onCheckedChange={(checked) =>
                  setValue(param.name, checked === true)
                }
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
              values={watch(param.name) || []}
              setValues={(values) => setValue(param.name, values)}
            />
          )}
          {errors[param.name] && (
            <p className="mt-1 text-sm text-destructive">
              {String(errors[param.name]?.message)}
            </p>
          )}
        </div>
      ))}
      <h2 className="my-4 text-lg font-semibold">Run Tool</h2>
      <div className="flex flex-col-reverse justify-between gap-2 md:flex-row">
        <div className="flex gap-2">
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
        </div>
        <TagInput tags={tags} setTags={setTags} isDisabled={isDisabled} />
      </div>
      <div className="mt-4">
        <EmailOnFinished
          emailOnFinished={emailOnFinished}
          setEmailOnFinished={setEmailOnFinished}
          isDisabled={isDisabled}
        />
      </div>
    </form>
  )
}

export default RunToolForm
