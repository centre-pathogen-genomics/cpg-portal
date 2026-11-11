import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  type FilePublic,
  FilesService,
  type FileTypeEnum,
  type Param,
  type RunPublic,
} from "../../client"
import { createRunMutation } from "../../client/@tanstack/react-query.gen"
import useAuth from "../../hooks/useAuth"
import useCustomToast from "../../hooks/useCustomToast"
import type { FileUnit } from "../../lib/run-params"
import { handleError } from "../../utils"
import TagInput from "../Common/TagInput"
import FileUploadButton from "../Files/UploadFileButtonWithProgress"
import EmailOnFinished from "./EmailOnFinished"
import ToolRunForm, { type LocalFilePickerProps } from "./ToolRunForm"

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
      file.is_group ? `, group of ${file.children?.length ?? 0}` : ""
    })`

  return (
    <div className="flex flex-col gap-2">
      <MultiSelect
        id={param.name}
        single={!param.multiple}
        options={data.map((file) => ({
          label: fileLabel(file),
          value: file.id,
          // A group stands for the files it holds, a pair for one unit.
          unitCount: file.is_group ? (file.children?.length ?? 1) : 1,
        }))}
        value={values}
        onValueChange={(nextValues) => updateValues(() => nextValues)}
        placeholder={param.multiple ? "Choose multiple files" : "Choose a file"}
        searchPlaceholder="Search files..."
        emptyMessage="No matching files found."
        disabled={disabled}
        loading={isLoading}
        aria-label={`Select files for ${param.name}`}
      />
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
  /**
   * Values from an earlier run, to prefill the form with (e.g. a rerun):
   * `{...run.params, ...run.param_files}`. Anything that no longer fits is left
   * at its default.
   */
  initialValues?: Record<string, unknown>
  initialTags?: string[]
  /** The threads the run being repeated used, clamped to the range now. */
  initialThreads?: number | null
}

/**
 * The portal's run form: the shared form plus what only the portal has — the
 * signed-in user's CPU limit, files stored on the portal, run name, tags and
 * email on completion.
 */
const RunToolForm = ({
  toolId,
  params,
  onSuccess,
  isDisabled = false,
  minCpus,
  maxCpus,
  defaultCpus,
  initialValues,
  initialTags,
  initialThreads,
}: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const { user } = useAuth()
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [emailOnFinished, setEmailOnFinished] = useState(false)
  const [runName, setRunName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // The file pickers need the files a tool's file parameters may choose from.
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

  const mutation = useMutation({
    ...createRunMutation(),
    onSuccess: (run: RunPublic) => {
      showToast("Success!", `Run Queued (${run.id})`, "success")
      onSuccess?.(run)
    },
    onError: (error) => handleError(error, showToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["toolRuns"] })
    },
  })

  const renderFilePicker = ({
    param,
    values,
    onChange,
    disabled,
  }: LocalFilePickerProps) => (
    <FileParam
      param={param}
      disabled={disabled}
      setIsLoading={setUploading}
      data={fileQueriesByParam.get(param.name)?.data ?? []}
      isLoading={fileQueriesByParam.get(param.name)?.isLoading ?? false}
      values={values}
      updateValues={(update) => onChange(update(values))}
    />
  )

  // A portal file stands for one unit, or for the files a group holds.
  const fileUnits = (param: Param): FileUnit[] =>
    fileQueriesByParam.get(param.name)?.data ?? []

  return (
    <ToolRunForm
      formKey={toolId}
      params={params}
      isDisabled={isDisabled || uploading}
      minCpus={minCpus}
      maxCpus={maxCpus}
      defaultCpus={defaultCpus}
      userMaxCpus={user?.max_cpus}
      isSuperuser={user?.is_superuser ?? false}
      initialValues={initialValues}
      initialValuesReady={!fileQueries.some((query) => query.isLoading)}
      initialThreads={initialThreads}
      renderFilePicker={renderFilePicker}
      fileUnits={fileUnits}
      onSubmit={async ({ params: values, cpus }) => {
        await mutation.mutateAsync({
          body: { params: values, tags },
          query: {
            tool_id: toolId,
            email_on_completion: emailOnFinished,
            name: runName ?? undefined,
            cpus,
          },
        })
      }}
      extras={
        <>
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
              Optional, used to find the run and outputs later
            </p>
            <TagInput tags={tags} setTags={setTags} isDisabled={isDisabled} />
          </div>
        </>
      }
      submitExtras={
        <EmailOnFinished
          emailOnFinished={emailOnFinished}
          setEmailOnFinished={setEmailOnFinished}
          isDisabled={isDisabled}
        />
      }
    />
  )
}

export default RunToolForm
