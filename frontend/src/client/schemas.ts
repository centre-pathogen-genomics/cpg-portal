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
    workflow_id: {
      type: "any-of",
      contains: [
        {
          type: "number",
        },
        {
          type: "null",
        },
      ],
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
    workflow_id: {
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

export const $ResultPublicWithFiles = {
  properties: {
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    results: {
      type: "any-of",
      contains: [
        {
          type: "dictionary",
          contains: {
            properties: {},
          },
        },
        {
          type: "null",
        },
      ],
    },
    files: {
      type: "array",
      contains: {
        type: "FilePublic",
      },
      default: [],
    },
    owner_id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    task_id: {
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

export const $TaskPublic = {
  properties: {
    taskiq_id: {
      type: "string",
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
    workflow: {
      type: "WorkflowMinimalPublic",
      isRequired: true,
    },
    status: {
      type: "TaskStatus",
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
  },
} as const

export const $TaskPublicWithResult = {
  properties: {
    taskiq_id: {
      type: "string",
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
    workflow: {
      type: "WorkflowMinimalPublic",
      isRequired: true,
    },
    status: {
      type: "TaskStatus",
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
    result: {
      type: "any-of",
      contains: [
        {
          type: "ResultPublicWithFiles",
        },
        {
          type: "null",
        },
      ],
    },
  },
} as const

export const $TaskStatus = {
  type: "Enum",
  enum: ["pending", "running", "completed", "failed", "cancelled"],
} as const

export const $TasksPublic = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "TaskPublic",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
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

export const $WorkflowCreateWithParams = {
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
    target_files: {
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
    json_results_file: {
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
      default: true,
    },
    params: {
      type: "array",
      contains: {
        type: "ParamCreate",
      },
      default: [],
    },
  },
} as const

export const $WorkflowMinimalPublic = {
  properties: {
    id: {
      type: "string",
      isRequired: true,
      format: "uuid",
    },
    name: {
      type: "string",
      isRequired: true,
    },
  },
} as const

export const $WorkflowPublic = {
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
    target_files: {
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
    json_results_file: {
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
      default: true,
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

export const $WorkflowPublicWithParams = {
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
    target_files: {
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
    json_results_file: {
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
      default: true,
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
  },
} as const

export const $WorkflowUpdate = {
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
    target_files: {
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
    json_results_file: {
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
      default: true,
    },
  },
} as const

export const $WorkflowsPublicWithParams = {
  properties: {
    data: {
      type: "array",
      contains: {
        type: "WorkflowPublicWithParams",
      },
      isRequired: true,
    },
    count: {
      type: "number",
      isRequired: true,
    },
  },
} as const
