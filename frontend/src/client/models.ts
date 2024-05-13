export type Body_files_upload_file = {
	file: Blob | File;
};



export type Body_login_login_access_token = {
  grant_type?: string | null
  username: string
  password: string
  scope?: string
  client_id?: string | null
  client_secret?: string | null
}

export type FilePublic = {
	name: string;
	id: number;
	result_id?: number | null;
	created_at: string;
};



export type FilesPublic = {
	data: Array<FilePublic>;
	count: number;
};



export type HTTPValidationError = {
	detail?: Array<ValidationError>;
};



export type ItemCreate = {
	title: string;
	description?: string | null;
};



export type ItemPublic = {
	title: string;
	description?: string | null;
	id: number;
	owner_id: number;
};



export type ItemUpdate = {
	title?: string | null;
	description?: string | null;
};



export type ResultPublicWithFiles = {
	id: number;
	results?: Record<string, unknown> | null;
	files?: Array<FilePublic>;
	owner_id: number;
	task_id: number;
	created_at: string;
};



export type TaskPublic = {
	taskiq_id: string;
	id: number;
	owner_id: number;
	workflow: WorkflowMinimalPublic;
	status: TaskStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
};



export type NewPassword = {
	token: string;
	new_password: string;
};



export type Param = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default?: (number | string | boolean | null);
	options?: Array<string>;
	flag?: string | null;
	required?: boolean;
	id?: number | null;
	workflow_id?: number | null;
};



export type ParamCreate = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default: (number | string | boolean);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean;
};



export type ParamPublic = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default: (number | string | boolean);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean;
	id: number;
	workflow_id: number;
};



export type ParamType = 'str' | 'int' | 'float' | 'bool' | 'enum' | 'file';



export type ParamUpdate = {
	name?: string | null;
	description?: string | null;
	param_type?: ParamType | null;
	default?: (number | string | boolean | null);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean | null;
};



export type ResultPublicWithFiles = {
	id: number;
	results?: Record<string, unknown> | null;
	files?: Array<FilePublic>;
	owner_id: number;
	task_id: number;
	created_at: string;
};



export type TaskPublic = {
	taskiq_id: string;
	id: number;
	owner_id: number;
	workflow: WorkflowMinimalPublic;
	status: TaskStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
};



export type TaskPublicWithResult = {
	taskiq_id: string;
	id: number;
	owner_id: number;
	workflow: WorkflowMinimalPublic;
	status: TaskStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	result?: ResultPublicWithFiles | null;
};



export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';



export type TasksPublic = {
	data: Array<TaskPublic>;
	count: number;
};



export type Param = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default?: (number | string | boolean | null);
	options?: Array<string>;
	flag?: string | null;
	required?: boolean;
	id?: number | null;
	workflow_id?: number | null;
};



export type ParamCreate = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default: (number | string | boolean);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean;
};



export type ParamPublic = {
	name: string;
	description?: string | null;
	param_type: ParamType;
	default: (number | string | boolean);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean;
	id: number;
	workflow_id: number;
};



export type ParamType = 'str' | 'int' | 'float' | 'bool' | 'enum' | 'file';



export type ParamUpdate = {
	name?: string | null;
	description?: string | null;
	param_type?: ParamType | null;
	default?: (number | string | boolean | null);
	options?: Array<string> | null;
	flag?: string | null;
	required?: boolean | null;
};



export type ResultPublicWithFiles = {
	id: number;
	results?: Record<string, unknown> | null;
	files?: Array<FilePublic>;
	owner_id: number;
	task_id: number;
	created_at: string;
};



export type TaskPublic = {
	taskiq_id: string;
	id: number;
	owner_id: number;
	workflow_id: number;
	status: TaskStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
};



export type TaskPublicWithResult = {
	taskiq_id: string;
	id: number;
	owner_id: number;
	workflow_id: number;
	status: TaskStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	result?: ResultPublicWithFiles | null;
};



export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';



export type TasksPublic = {
	data: Array<TaskPublic>;
	count: number;
};



export type Token = {
  access_token: string
  token_type?: string
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
	loc: Array<string | number>;
	msg: string;
	type: string;
};



export type WorkflowCreateWithParams = {
	name: string;
	description?: string | null;
	image?: string | null;
	command: Array<string>;
	setup_command?: string | null;
	target_files?: Array<string> | null;
	json_results_file?: string | null;
	enabled?: boolean;
	params?: Array<ParamCreate>;
};



export type WorkflowMinimalPublic = {
	id: number;
	name: string;
};



export type WorkflowPublic = {
	name: string;
	description?: string | null;
	image?: string | null;
	command: Array<string>;
	setup_command?: string | null;
	target_files?: Array<string> | null;
	json_results_file?: string | null;
	enabled?: boolean;
	id: number;
	owner_id: number;
};



export type WorkflowPublicWithParams = {
	name: string;
	description?: string | null;
	image?: string | null;
	command: Array<string>;
	setup_command?: string | null;
	target_files?: Array<string> | null;
	json_results_file?: string | null;
	enabled?: boolean;
	id: number;
	owner_id: number;
	params: Array<ParamPublic>;
};



export type WorkflowUpdate = {
	name?: string | null;
	description?: string | null;
	image?: string | null;
	command?: Array<string> | null;
	setup_command?: string | null;
	target_files?: Array<string> | null;
	json_results_file?: string | null;
	enabled?: boolean;
};



export type WorkflowsPublicWithParams = {
	data: Array<WorkflowPublicWithParams>;
	count: number;
};

