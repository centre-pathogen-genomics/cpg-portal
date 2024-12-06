export type Body_files_upload_file = {
  file: Blob | File
}

export type Body_login_login_access_token = {
  grant_type?: string | null
  username: string
  password: string
  scope?: string
  client_id?: string | null
  client_secret?: string | null
}

export type FilePublic = {
  name: string
  id: string
  result_id?: string | null
  created_at: string
}

export type FilesPublic = {
  data: Array<FilePublic>
  count: number
}

export type HTTPValidationError = {
  detail?: Array<ValidationError>
}

export type Message = {
  message: string
}

export type NewPassword = {
  token: string
  new_password: string
}

export type Param = {
  name: string
  description?: string | null
  param_type: ParamType
  default?: number | string | boolean | null
  options?: Array<string>
  flag?: string | null
  required?: boolean
  id?: string
  tool_id: string
}

export type ParamCreate = {
  name: string
  description?: string | null
  param_type: ParamType
  default: number | string | boolean
  options?: Array<string> | null
  flag?: string | null
  required?: boolean
}

export type ParamPublic = {
  name: string
  description?: string | null
  param_type: ParamType
  default: number | string | boolean
  options?: Array<string> | null
  flag?: string | null
  required?: boolean
  id: string
  tool_id: string
}

export type ParamType = "str" | "int" | "float" | "bool" | "enum" | "file"

export type ParamUpdate = {
  name?: string | null
  description?: string | null
  param_type?: ParamType | null
  default?: number | string | boolean | null
  options?: Array<string> | null
  flag?: string | null
  required?: boolean | null
}

export type ResultPublicWithFileAndTarget = {
  id: string
  file: FilePublic
  target: TargetPublic
  owner_id: string
  task_id: string
  created_at: string
}

export type Target = {
  path: string
  name?: string | null
  description?: string | null
  target_type: TargetType
  display?: boolean
  required?: boolean
  id?: string
  tool_id: string
}

export type TargetCreate = {
  path: string
  name: string
  description?: string | null
  target_type: TargetType
  display?: boolean
  required?: boolean
}

export type TargetPublic = {
  path: string
  name?: string | null
  description?: string | null
  target_type: TargetType
  display?: boolean
  required?: boolean
  id: string
  tool_id: string
}

export type TargetType = "text" | "image" | "csv" | "tsv" | "json" | "unknown"

export type TargetUpdate = {
  path?: string | null
  name?: string | null
  description?: string | null
  target_type?: TargetType | null
  display?: boolean | null
  required?: boolean
}

export type TaskPublic = {
  taskiq_id: string
  status: TaskStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  id: string
  owner_id: string
  tool: ToolPublic
  stderr?: string | null
  stdout?: string | null
  command?: string | null
  params: Record<string, unknown>
  results: Array<ResultPublicWithFileAndTarget>
}

export type TaskPublicMinimal = {
  taskiq_id: string
  status: TaskStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  id: string
  owner_id: string
  tool: ToolPublic
}

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TasksPublicMinimal = {
  data: Array<TaskPublicMinimal>
  count: number
}

export type Token = {
  access_token: string
  token_type?: string
}

export type ToolCreateWithParamsAndTargets = {
  name: string
  description?: string | null
  image?: string | null
  command: Array<string>
  setup_command?: string | null
  enabled?: boolean
  params?: Array<ParamCreate>
  targets?: Array<TargetCreate>
}

export type ToolPublic = {
  name: string
  description?: string | null
  image?: string | null
  command: Array<string>
  setup_command?: string | null
  enabled?: boolean
  id: string
  owner_id: string
}

export type ToolPublicWithParamsAndTargets = {
  name: string
  description?: string | null
  image?: string | null
  command: Array<string>
  setup_command?: string | null
  enabled?: boolean
  id: string
  owner_id: string
  params: Array<ParamPublic>
  targets: Array<TargetPublic>
}

export type ToolUpdate = {
  name?: string | null
  description?: string | null
  image?: string | null
  command?: Array<string> | null
  setup_command?: string | null
  enabled?: boolean
}

export type ToolsPublicWithParamsAndTargets = {
  data: Array<ToolPublicWithParamsAndTargets>
  count: number
}

export type UpdatePassword = {
  current_password: string
  new_password: string
}

export type UserCreate = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  password: string
}

export type UserPublic = {
  email: string
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  id: string
}

export type UserRegister = {
  email: string
  password: string
  full_name?: string | null
}

export type UserUpdate = {
  email?: string | null
  is_active?: boolean
  is_superuser?: boolean
  full_name?: string | null
  password?: string | null
}

export type UserUpdateMe = {
  full_name?: string | null
  email?: string | null
}

export type UsersPublic = {
  data: Array<UserPublic>
  count: number
}

export type ValidationError = {
  loc: Array<string | number>
  msg: string
  type: string
}
