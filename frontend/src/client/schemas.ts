export const $Body_files_upload_file = {
  properties: {
    file: {
      type: "binary",
      isRequired: true,
      format: "binary",
    },
  },
} as const

export const $Body_login_login_access_token = {
  properties: {
    grant_type: {
      type: "any-of",
      contains: [
        {
          type: "string",
          pattern: "password",
        },
        {
          type: "null",
        },
      ],
    },
    username: {
      type: "string",
      isRequired: true,
    },
    password: {
      type: "string",
      isRequired: true,
    },
    scope: {
      type: "string",
      default: "",
    },
    client_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    client_secret: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $FilePublic = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    result_id: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "uuid",
        },
        {
          type: "null",
        },
      ],
    },
    created_at: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
  },
} as const

export const $FilesPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "FilePublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $HTTPValidationError = {
  properties: {
    detail: {
      type: "array",
      contains: {
        type: "ValidationError",
      },
    },
  },
} as const

export const $Message = {
  properties: {
    message: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $NewPassword = {
  properties: {
    token: {
      type: "string",
      isRequired: true,
    },
    new_password: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $Param = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    param_type: {
      type: "ParamType",
      isRequired: true,
    },
    default: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "number",
        },
        {
          type: "string",
        },
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    options: {
      type: "array",
      contains: {
        type: "string",
      },
    },
    flag: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    required: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      format: "uuid",
    },
    tool_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $ParamCreate = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    param_type: {
      type: "ParamType",
      isRequired: true,
    },
    default: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "number",
        },
        {
          type: "string",
        },
        {
          type: "boolean",
        },
      ],
      isRequired: true,
    },
    options: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    flag: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    required: {
      type: "boolean",
      default: false,
    },
  },
} as const

export const $ParamPublic = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    param_type: {
      type: "ParamType",
      isRequired: true,
    },
    default: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "number",
        },
        {
          type: "string",
        },
        {
          type: "boolean",
        },
      ],
      isRequired: true,
    },
    options: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    flag: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    required: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    tool_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $ParamType = {
  type: "Enum",
  enum: ["str", "int", "float", "bool", "enum", "file"],
} as const

export const $ParamUpdate = {
  properties: {
    name: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    param_type: {
      type: "any-of",
      contains: [
        {
          type: "ParamType",
        },
        {
          type: "null",
        },
      ],
    },
    default: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "number",
        },
        {
          type: "string",
        },
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    options: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    flag: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    required: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $ResultPublicWithFileAndTarget = {
  properties: {
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    file: {
      type: "FilePublic",
      isRequired: true,
    },
    target: {
      type: "TargetPublic",
      isRequired: true,
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    run_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    created_at: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
  },
} as const

export const $RunPublic = {
  properties: {
    taskiq_id: {
      type: "string",
      isRequired: true,
    },
    status: {
      type: "RunStatus",
      isRequired: true,
    },
    created_at: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    started_at: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    finished_at: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    tool: {
      type: "ToolPublic",
      isRequired: true,
    },
    params: {
      type: "dictionary",
      contains: {
        properties: {},
      },
      isRequired: true,
    },
    stderr: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    stdout: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    command: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    results: {
      type: "array",
      contains: {
        type: "ResultPublicWithFileAndTarget",
      },
      isRequired: true,
    },
  },
} as const

export const $RunPublicMinimal = {
  properties: {
    taskiq_id: {
      type: "string",
      isRequired: true,
    },
    status: {
      type: "RunStatus",
      isRequired: true,
    },
    created_at: {
      type: "string",
      isRequired: true,
      format: "date-time",
    },
    started_at: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    finished_at: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "date-time",
        },
        {
          type: "null",
        },
      ],
      isRequired: true,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    tool: {
      type: "ToolPublic",
      isRequired: true,
    },
    params: {
      type: "dictionary",
      contains: {
        properties: {},
      },
      isRequired: true,
    },
  },
} as const

export const $RunStatus = {
  type: "Enum",
  enum: ["pending", "running", "completed", "failed", "cancelled"],
} as const

export const $RunsPublicMinimal = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "RunPublicMinimal",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $Target = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    name: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    target_type: {
      type: "TargetType",
      isRequired: true,
    },
    display: {
      type: "boolean",
      default: false,
    },
    required: {
      type: "boolean",
      default: true,
    },
    id: {
      type: "string",
      format: "uuid",
    },
    tool_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $TargetCreate = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    target_type: {
      type: "TargetType",
      isRequired: true,
    },
    display: {
      type: "boolean",
      default: false,
    },
    required: {
      type: "boolean",
      default: true,
    },
  },
} as const

export const $TargetPublic = {
  properties: {
    path: {
      type: "string",
      isRequired: true,
    },
    name: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    target_type: {
      type: "TargetType",
      isRequired: true,
    },
    display: {
      type: "boolean",
      default: false,
    },
    required: {
      type: "boolean",
      default: true,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    tool_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $TargetType = {
  type: "Enum",
  enum: ["text", "image", "csv", "tsv", "json", "unknown"],
} as const

export const $TargetUpdate = {
  properties: {
    path: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    name: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    target_type: {
      type: "any-of",
      contains: [
        {
          type: "TargetType",
        },
        {
          type: "null",
        },
      ],
    },
    display: {
      type: "any-of",
      contains: [
        {
          type: "boolean",
        },
        {
          type: "null",
        },
      ],
    },
    required: {
      type: "boolean",
      default: true,
    },
  },
} as const

export const $Token = {
  properties: {
    access_token: {
      type: "string",
      isRequired: true,
    },
    token_type: {
      type: "string",
      default: "bearer",
    },
  },
} as const

export const $ToolCreateWithParamsAndTargets = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    image: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    command: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    setup_command: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    enabled: {
      type: "boolean",
      default: false,
    },
    params: {
      type: "array",
      contains: {
        type: "ParamCreate",
      },
      default: [],
    },
    targets: {
      type: "array",
      contains: {
        type: "TargetCreate",
      },
      default: [],
    },
  },
} as const

export const $ToolPublic = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    image: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    command: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    setup_command: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    enabled: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $ToolPublicWithParamsAndTargets = {
  properties: {
    name: {
      type: "string",
      isRequired: true,
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    image: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    command: {
      type: "array",
      contains: {
        type: "string",
      },
      isRequired: true,
    },
    setup_command: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    enabled: {
      type: "boolean",
      default: false,
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    params: {
      type: "array",
      contains: {
        type: "ParamPublic",
      },
      isRequired: true,
    },
    targets: {
      type: "array",
      contains: {
        type: "TargetPublic",
      },
      isRequired: true,
    },
  },
} as const

export const $ToolUpdate = {
  properties: {
    name: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    description: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    image: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    command: {
      type: "any-of",
      contains: [
        {
          type: "array",
          contains: {
            type: "string",
          },
        },
        {
          type: "null",
        },
      ],
    },
    setup_command: {
      type: "any-of",
      contains: [
        {
          type: "string",
        },
        {
          type: "null",
        },
      ],
    },
    enabled: {
      type: "boolean",
      default: false,
    },
  },
} as const

export const $ToolsPublicWithParamsAndTargets = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "ToolPublicWithParamsAndTargets",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $UpdatePassword = {
  properties: {
    current_password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
    new_password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
  },
} as const

export const $UserCreate = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
  },
} as const

export const $UserPublic = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
  },
} as const

export const $UserRegister = {
  properties: {
    email: {
      type: "string",
      isRequired: true,
      format: "email",
      maxLength: 255,
    },
    password: {
      type: "string",
      isRequired: true,
      maxLength: 40,
      minLength: 8,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UserUpdate = {
  properties: {
    email: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "email",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    is_active: {
      type: "boolean",
      default: true,
    },
    is_superuser: {
      type: "boolean",
      default: false,
    },
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    password: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 40,
          minLength: 8,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UserUpdateMe = {
  properties: {
    full_name: {
      type: "any-of",
      contains: [
        {
          type: "string",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
    email: {
      type: "any-of",
      contains: [
        {
          type: "string",
          format: "email",
          maxLength: 255,
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $UsersPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "UserPublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const

export const $ValidationError = {
  properties: {
    loc: {
      type: "array",
      contains: {
        type: "any-of",
        contains: [
          {
            type: "string",
          },
          {
            type: "number",
          },
        ],
      },
      isRequired: true,
    },
    msg: {
      type: "string",
      isRequired: true,
    },
    type: {
      type: "string",
      isRequired: true,
    },
  },
} as const
