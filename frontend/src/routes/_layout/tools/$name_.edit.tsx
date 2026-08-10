import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form"
import { z } from "zod"
import {
  type CondaEnv,
  type CondaEnvPipDependency,
  type FileTypeEnum,
  type Param,
  type ParamType,
  type SetupFile,
  type Target,
  type ToolBadge,
  type ToolPublic,
  type ToolStatus,
  type ToolUpdate,
  UsersService,
} from "@/client"
import {
  readToolByNameOptions,
  readToolByNameQueryKey,
  readToolsQueryKey,
  updateToolMutation,
} from "@/client/@tanstack/react-query.gen"
import {
  FileTypeEnumSchema,
  ParamTypeSchema,
  ToolStatusSchema,
} from "@/client/schemas.gen"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const paramTypes = ParamTypeSchema.enum as unknown as ParamType[]
const fileTypes = FileTypeEnumSchema.enum as unknown as FileTypeEnum[]
const toolStatuses = ToolStatusSchema.enum as unknown as ToolStatus[]

const optionalString = z.string().nullable().optional()

const listItemSchema = z.object({ value: z.string() })
const badgeSchema = z.object({
  badge: optionalString,
  url: optionalString,
})
const condaDependencySchema = z.object({
  kind: z.enum(["dependency", "pip"]),
  value: z.string(),
})
const paramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  param_type: z.enum(paramTypes),
  allowed_file_types: z.array(listItemSchema),
  multiple: z.boolean(),
  description: optionalString,
  default: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  options: z.array(listItemSchema),
  required: z.boolean(),
})
const targetSchema = z.object({
  path: z.string().min(1, "Path is required"),
  target_type: z.string().min(1, "Target type is required"),
  required: z.boolean(),
})
const setupFileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  content: z.string(),
})

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  version: optionalString,
  image: optionalString,
  description: optionalString,
  explanation_of_results_markdown: optionalString,
  url: optionalString,
  github_repo: optionalString,
  docs_url: optionalString,
  paper_doi: optionalString,
  license: optionalString,
  citation_markdown: optionalString,
  tags: z.array(listItemSchema),
  badges: z.array(badgeSchema),
  command: z.string().min(1, "Command is required"),
  conda_channels: z.array(listItemSchema),
  conda_dependencies: z.array(condaDependencySchema),
  post_install: optionalString,
  setup_files: z.array(setupFileSchema),
  params: z.array(paramSchema),
  targets: z.array(targetSchema),
  llm_summary_enabled: z.boolean(),
  favourited_count: z.number().int().min(0),
  run_count: z.number().int().min(0),
  enabled: z.boolean(),
  status: z.enum(toolStatuses),
  installation_log: optionalString,
})

type ToolFormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/_layout/tools/$name_/edit")({
  beforeLoad: async () => {
    const response = await UsersService.readUserMe({
      throwOnError: true,
    }).catch(() => {
      throw redirect({ to: "/login" })
    })
    if (!response.data.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  component: ToolEditor,
  head: (context) => ({
    meta: [
      {
        title: `Edit ${(context.params as { name: string }).name} | CPG Portal`,
      },
    ],
  }),
})

function nullIfBlank(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function listValues(values: { value: string }[] | undefined) {
  const seen = new Set<string>()
  return (values ?? [])
    .map((item) => item.value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function stringList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => ({ value }))
}

function isPipDependency(
  dependency: string | CondaEnvPipDependency,
): dependency is CondaEnvPipDependency {
  return typeof dependency !== "string" && Array.isArray(dependency.pip)
}

function defaultValues(tool: ToolPublic): ToolFormData {
  return {
    name: tool.name,
    version: tool.version ?? "",
    image: tool.image ?? "",
    description: tool.description ?? "",
    explanation_of_results_markdown: tool.explanation_of_results_markdown ?? "",
    url: tool.url ?? "",
    github_repo: tool.github_repo ?? "",
    docs_url: tool.docs_url ?? "",
    paper_doi: tool.paper_doi ?? "",
    license: tool.license ?? "",
    citation_markdown: tool.citation_markdown ?? "",
    tags: stringList(tool.tags),
    badges: (tool.badges ?? []).map((badge) => ({
      badge: badge.badge ?? "",
      url: badge.url ?? "",
    })),
    command: tool.command,
    conda_channels: stringList(tool.conda_env?.channels),
    conda_dependencies: (tool.conda_env?.dependencies ?? []).flatMap(
      (dependency): ToolFormData["conda_dependencies"] =>
        isPipDependency(dependency)
          ? dependency.pip.map((value) => ({ kind: "pip", value }))
          : [{ kind: "dependency", value: dependency }],
    ),
    post_install: tool.post_install ?? "",
    setup_files: (tool.setup_files ?? []).map((file) => ({
      name: file.name,
      content: file.content,
    })),
    params: (tool.params ?? []).map((param) => ({
      name: param.name,
      param_type: param.param_type,
      allowed_file_types: stringList(param.allowed_file_types),
      multiple: param.multiple ?? false,
      description: param.description ?? "",
      default: param.default ?? null,
      options: stringList(param.options),
      required: param.required ?? false,
    })),
    targets: (tool.targets ?? []).map((target) => ({
      path: target.path,
      target_type: target.target_type,
      required: target.required ?? true,
    })),
    llm_summary_enabled: tool.llm_summary_enabled ?? false,
    favourited_count: tool.favourited_count ?? 0,
    run_count: tool.run_count ?? 0,
    enabled: tool.enabled ?? false,
    status: tool.status,
    installation_log: tool.installation_log ?? "",
  }
}

function buildParam(param: ToolFormData["params"][number]): Param {
  const value = param.default
  let defaultValue: Param["default"] = null
  if (value !== null && value !== "") {
    if (param.param_type === "int")
      defaultValue = Number.parseInt(String(value), 10)
    else if (param.param_type === "float")
      defaultValue = Number.parseFloat(String(value))
    else if (param.param_type === "bool") defaultValue = Boolean(value)
    else defaultValue = String(value)
  }
  return {
    name: param.name.trim(),
    param_type: param.param_type,
    allowed_file_types: listValues(param.allowed_file_types),
    multiple: param.multiple,
    description: nullIfBlank(param.description),
    default: defaultValue,
    options: listValues(param.options),
    required: param.required,
  }
}

function buildToolUpdate(data: ToolFormData): ToolUpdate {
  const condaDependencies: CondaEnv["dependencies"] = []
  const pipDependencies = data.conda_dependencies
    .filter((dependency) => dependency.kind === "pip")
    .map((dependency) => dependency.value.trim())
    .filter(Boolean)

  for (const dependency of data.conda_dependencies) {
    const value = dependency.value.trim()
    if (dependency.kind === "dependency" && value) condaDependencies.push(value)
  }
  if (pipDependencies.length) condaDependencies.push({ pip: pipDependencies })

  const condaEnv =
    data.conda_channels.length || condaDependencies.length
      ? {
          channels: listValues(data.conda_channels),
          dependencies: condaDependencies,
        }
      : null

  return {
    name: data.name.trim(),
    version: nullIfBlank(data.version),
    image: nullIfBlank(data.image),
    description: nullIfBlank(data.description),
    explanation_of_results_markdown: nullIfBlank(
      data.explanation_of_results_markdown,
    ),
    url: nullIfBlank(data.url),
    github_repo: nullIfBlank(data.github_repo),
    docs_url: nullIfBlank(data.docs_url),
    paper_doi: nullIfBlank(data.paper_doi),
    license: nullIfBlank(data.license),
    citation_markdown: nullIfBlank(data.citation_markdown),
    badges: data.badges
      .map<ToolBadge>((badge) => ({
        badge: nullIfBlank(badge.badge),
        url: nullIfBlank(badge.url),
      }))
      .filter((badge) => badge.badge || badge.url),
    tags: listValues(data.tags),
    command: data.command.trim(),
    conda_env: condaEnv,
    post_install: nullIfBlank(data.post_install),
    setup_files: data.setup_files.map<SetupFile>((file) => ({
      name: file.name.trim(),
      content: file.content,
    })),
    params: data.params.map(buildParam),
    targets: data.targets.map<Target>((target) => ({
      path: target.path.trim(),
      target_type: target.target_type.trim(),
      required: target.required,
    })),
    llm_summary_enabled: data.llm_summary_enabled,
    favourited_count: data.favourited_count,
    run_count: data.run_count,
    enabled: data.enabled,
    status: data.status,
    installation_log: nullIfBlank(data.installation_log),
  }
}

function FieldShell({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function TextField({
  control,
  name,
  label,
  multiline = false,
}: {
  control: Control<ToolFormData>
  name: FieldPath<ToolFormData>
  label: string
  multiline?: boolean
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea
                className="min-h-28 font-mono"
                {...field}
                value={String(field.value ?? "")}
              />
            ) : (
              <Input {...field} value={String(field.value ?? "")} />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function BooleanField({
  control,
  name,
  label,
}: {
  control: Control<ToolFormData>
  name: FieldPath<ToolFormData>
  label: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-3">
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <FormLabel className="m-0">{label}</FormLabel>
        </FormItem>
      )}
    />
  )
}

function ArrayActions({
  onAdd,
  label = "Add",
}: {
  onAdd: () => void
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={onAdd}
    >
      <Plus />
      Add
    </Button>
  )
}

function RowActions({
  index,
  count,
  onMove,
  onRemove,
  removeLabel = "Remove",
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  removeLabel?: string
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function StringListBuilder<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder: string
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: name as never,
  })
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <ArrayActions
          label={`Add ${label.toLowerCase()}`}
          onAdd={() => append({ value: "" } as never)}
        />
      </div>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No items configured.</p>
      )}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto]"
        >
          <Controller
            control={control}
            name={`${name}.${index}.value` as FieldPath<T>}
            render={({ field: input }) => (
              <Input
                {...input}
                value={String(input.value ?? "")}
                placeholder={placeholder}
              />
            )}
          />
          <RowActions
            index={index}
            count={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}
    </div>
  )
}

function nextAvailableFileType(selectedTypes: { value: string }[] | undefined) {
  const selected = new Set(
    (selectedTypes ?? []).map((item) => item.value).filter(Boolean),
  )
  return fileTypes.find((type) => !selected.has(type)) ?? "unknown"
}

function FileTypeListBuilder({
  control,
  paramIndex,
}: {
  control: Control<ToolFormData>
  paramIndex: number
}) {
  const name =
    `params.${paramIndex}.allowed_file_types` as `params.${number}.allowed_file_types`
  const { fields, append, remove, move } = useFieldArray({
    control,
    name,
  })
  const selectedTypes = useWatch({ control, name })

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Allowed file types</h3>
        <ArrayActions
          label="Add allowed file type"
          onAdd={() => append({ value: nextAvailableFileType(selectedTypes) })}
        />
      </div>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No file types configured.
        </p>
      )}
      {fields.map((field, index) => {
        const currentValue = selectedTypes?.[index]?.value
        const selectedByOtherRows = new Set(
          (selectedTypes ?? [])
            .filter((_, selectedIndex) => selectedIndex !== index)
            .map((item) => item.value),
        )

        return (
          <div
            key={field.id}
            className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto]"
          >
            <Controller
              control={control}
              name={`${name}.${index}.value`}
              render={({ field: select }) => (
                <Select
                  value={String(select.value ?? "")}
                  onValueChange={select.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select file type" />
                  </SelectTrigger>
                  <SelectContent>
                    {fileTypes.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        disabled={
                          selectedByOtherRows.has(type) && currentValue !== type
                        }
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <RowActions
              index={index}
              count={fields.length}
              onMove={move}
              onRemove={() => remove(index)}
            />
          </div>
        )
      })}
    </div>
  )
}

function DetailsTab({ control }: { control: Control<ToolFormData> }) {
  const badges = useFieldArray({ control, name: "badges" })
  return (
    <TabsContent value="details" className="space-y-6">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TextField control={control} name="name" label="Name" />
          <TextField control={control} name="version" label="Version" />
          <TextField control={control} name="image" label="Image URL" />
          <TextField control={control} name="url" label="Home URL" />
          <TextField control={control} name="github_repo" label="GitHub repo" />
          <TextField control={control} name="docs_url" label="Docs URL" />
          <TextField control={control} name="paper_doi" label="Paper DOI" />
          <TextField control={control} name="license" label="License" />
          <div className="md:col-span-2">
            <TextField
              control={control}
              name="description"
              label="Description"
              multiline
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              control={control}
              name="citation_markdown"
              label="Citation markdown"
              multiline
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              control={control}
              name="explanation_of_results_markdown"
              label="Result explanation markdown"
              multiline
            />
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-md">
        <CardContent className="space-y-6 pt-6">
          <StringListBuilder
            control={control}
            name="tags"
            label="Tags"
            placeholder="tag"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Badges</h3>
              <ArrayActions
                label="Add badge"
                onAdd={() => badges.append({ badge: "", url: "" })}
              />
            </div>
            {badges.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No badges configured.
              </p>
            )}
            {badges.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <TextField
                  control={control}
                  name={`badges.${index}.badge`}
                  label="Badge image URL"
                />
                <TextField
                  control={control}
                  name={`badges.${index}.url`}
                  label="Link URL"
                />
                <RowActions
                  index={index}
                  count={badges.fields.length}
                  onMove={badges.move}
                  onRemove={() => badges.remove(index)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function ExecutionTab({ control }: { control: Control<ToolFormData> }) {
  const dependencies = useFieldArray({ control, name: "conda_dependencies" })
  return (
    <TabsContent value="execution" className="space-y-6">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Execution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            control={control}
            name="command"
            label="Command"
            multiline
          />
          <TextField
            control={control}
            name="post_install"
            label="Post-install command"
            multiline
          />
          <StringListBuilder
            control={control}
            name="conda_channels"
            label="Conda channels"
            placeholder="conda-forge"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Conda dependencies</h3>
              <ArrayActions
                label="Add conda dependency"
                onAdd={() =>
                  dependencies.append({ kind: "dependency", value: "" })
                }
              />
            </div>
            {dependencies.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No dependencies configured.
              </p>
            )}
            {dependencies.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border p-3 md:grid-cols-[180px_1fr_auto]"
              >
                <Controller
                  control={control}
                  name={`conda_dependencies.${index}.kind`}
                  render={({ field: select }) => (
                    <FieldShell label="Type">
                      <Select
                        value={select.value}
                        onValueChange={select.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dependency">Conda</SelectItem>
                          <SelectItem value="pip">Pip</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldShell>
                  )}
                />
                <TextField
                  control={control}
                  name={`conda_dependencies.${index}.value`}
                  label="Package"
                />
                <RowActions
                  index={index}
                  count={dependencies.fields.length}
                  onMove={dependencies.move}
                  onRemove={() => dependencies.remove(index)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function ParamDefaultField({
  control,
  index,
}: {
  control: Control<ToolFormData>
  index: number
}) {
  const type = useWatch({ control, name: `params.${index}.param_type` })
  if (type === "bool") {
    return (
      <FormField
        control={control}
        name={`params.${index}.default`}
        render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl>
              <Checkbox
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel className="m-0">Default</FormLabel>
          </FormItem>
        )}
      />
    )
  }
  return (
    <TextField
      control={control}
      name={`params.${index}.default`}
      label="Default"
    />
  )
}

function ParamOptionsField({
  control,
  index,
}: {
  control: Control<ToolFormData>
  index: number
}) {
  const type = useWatch({ control, name: `params.${index}.param_type` })
  if (type !== "enum") return null
  return (
    <StringListBuilder
      control={control}
      name={`params.${index}.options`}
      label="Options"
      placeholder="option"
    />
  )
}

function ParamFileTypesField({
  control,
  index,
}: {
  control: Control<ToolFormData>
  index: number
}) {
  const type = useWatch({ control, name: `params.${index}.param_type` })
  if (type !== "file") return null
  return <FileTypeListBuilder control={control} paramIndex={index} />
}

function InputsTab({ control }: { control: Control<ToolFormData> }) {
  const params = useFieldArray({ control, name: "params" })
  return (
    <TabsContent value="inputs" className="space-y-6">
      <Card className="rounded-md">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Inputs</CardTitle>
          <ArrayActions
            label="Add param"
            onAdd={() =>
              params.append({
                name: "",
                param_type: "str",
                allowed_file_types: [],
                multiple: false,
                description: "",
                default: null,
                options: [],
                required: false,
              })
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {params.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No params configured.
            </p>
          )}
          {params.fields.map((field, index) => (
            <div key={field.id} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                <TextField
                  control={control}
                  name={`params.${index}.name`}
                  label="Name"
                />
                <Controller
                  control={control}
                  name={`params.${index}.param_type`}
                  render={({ field: select }) => (
                    <FieldShell label="Type">
                      <Select
                        value={select.value}
                        onValueChange={select.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paramTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldShell>
                  )}
                />
                <RowActions
                  index={index}
                  count={params.fields.length}
                  onMove={params.move}
                  onRemove={() => params.remove(index)}
                  removeLabel="Remove param"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  control={control}
                  name={`params.${index}.description`}
                  label="Description"
                />
                <ParamDefaultField control={control} index={index} />
              </div>
              <div className="flex flex-wrap gap-6">
                <BooleanField
                  control={control}
                  name={`params.${index}.required`}
                  label="Required"
                />
                <BooleanField
                  control={control}
                  name={`params.${index}.multiple`}
                  label="Multiple"
                />
              </div>
              <div className="grid gap-6">
                <ParamOptionsField control={control} index={index} />
                <ParamFileTypesField control={control} index={index} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function TargetTypeField({
  control,
  index,
}: {
  control: Control<ToolFormData>
  index: number
}) {
  return (
    <FormField
      control={control}
      name={`targets.${index}.target_type`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Target type</FormLabel>
          <Select
            value={field.value || "unknown"}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target type" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {fileTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function OutputsTab({ control }: { control: Control<ToolFormData> }) {
  const targets = useFieldArray({ control, name: "targets" })
  const setupFiles = useFieldArray({ control, name: "setup_files" })
  return (
    <TabsContent value="outputs" className="space-y-6">
      <Card className="rounded-md">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Targets</CardTitle>
          <ArrayActions
            label="Add target"
            onAdd={() =>
              targets.append({
                path: "",
                target_type: "unknown",
                required: true,
              })
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {targets.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No targets configured.
            </p>
          )}
          {targets.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-4 rounded-md border p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <TextField
                control={control}
                name={`targets.${index}.path`}
                label="Path"
              />
              <TargetTypeField control={control} index={index} />
              <div className="space-y-3">
                <BooleanField
                  control={control}
                  name={`targets.${index}.required`}
                  label="Required"
                />
                <RowActions
                  index={index}
                  count={targets.fields.length}
                  onMove={targets.move}
                  onRemove={() => targets.remove(index)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-md">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Setup Files</CardTitle>
          <ArrayActions
            label="Add setup file"
            onAdd={() => setupFiles.append({ name: "", content: "" })}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {setupFiles.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No setup files configured.
            </p>
          )}
          {setupFiles.fields.map((field, index) => (
            <div key={field.id} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <TextField
                  control={control}
                  name={`setup_files.${index}.name`}
                  label="Name"
                />
                <RowActions
                  index={index}
                  count={setupFiles.fields.length}
                  onMove={setupFiles.move}
                  onRemove={() => setupFiles.remove(index)}
                />
              </div>
              <TextField
                control={control}
                name={`setup_files.${index}.content`}
                label="Content"
                multiline
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function AdminTab({ control }: { control: Control<ToolFormData> }) {
  return (
    <TabsContent value="admin">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Admin</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <BooleanField control={control} name="enabled" label="Tool enabled" />
          <BooleanField
            control={control}
            name="llm_summary_enabled"
            label="AI summary enabled"
          />
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {toolStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="favourited_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Favourited count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(event) =>
                      field.onChange(
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="run_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Run count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(event) =>
                      field.onChange(
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2">
            <TextField
              control={control}
              name="installation_log"
              label="Installation log"
              multiline
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

function ToolEditor() {
  const { name } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const {
    data: tool,
    isError,
    isPending,
  } = useQuery({
    ...readToolByNameOptions({ path: { tool_name: name } }),
  })

  const form = useForm<ToolFormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    values: tool ? defaultValues(tool) : undefined,
  })

  useEffect(() => {
    if (tool) form.reset(defaultValues(tool))
  }, [form, tool])

  const mutation = useMutation({
    ...updateToolMutation(),
    onSuccess: (updatedTool) => {
      queryClient.invalidateQueries({
        queryKey: readToolByNameQueryKey({ path: { tool_name: name } }),
      })
      queryClient.invalidateQueries({
        queryKey: readToolByNameQueryKey({
          path: { tool_name: updatedTool.name },
        }),
      })
      queryClient.invalidateQueries({ queryKey: readToolsQueryKey() })
      showSuccessToast("Tool updated successfully")
      navigate({
        to: "/tools/$name",
        params: { name: updatedTool.name },
        resetScroll: true,
      })
    },
    onError: (error) => handleError(error, showErrorToast),
  })

  const onSubmit: SubmitHandler<ToolFormData> = (data) => {
    if (!tool) return
    mutation.mutate({
      path: { tool_id: tool.id },
      body: buildToolUpdate(data),
    })
  }

  if (isError) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Tool Not Found</h1>
        <p>The requested tool could not be found.</p>
      </div>
    )
  }

  if (isPending || !tool) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Loading editor...</h1>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 md:px-6 lg:px-8 xl:px-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" asChild className="mb-2 px-0">
            <RouterLink to="/tools/$name" params={{ name }}>
              <ArrowLeft />
              Back
            </RouterLink>
          </Button>
          <h1 className="text-4xl font-bold">Edit {tool.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <RouterLink to="/tools/$name" params={{ name }}>
              Cancel
            </RouterLink>
          </Button>
          <LoadingButton
            type="submit"
            form="tool-editor-form"
            loading={mutation.isPending}
          >
            Save
          </LoadingButton>
        </div>
      </div>
      <Form {...form}>
        <form id="tool-editor-form" onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="execution">Execution</TabsTrigger>
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
              <TabsTrigger value="outputs">Outputs</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            <DetailsTab control={form.control} />
            <ExecutionTab control={form.control} />
            <InputsTab control={form.control} />
            <OutputsTab control={form.control} />
            <AdminTab control={form.control} />
          </Tabs>
        </form>
      </Form>
    </div>
  )
}

export default ToolEditor
