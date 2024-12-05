import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

import type {
  Body_login_login_access_token,
  Message,
  NewPassword,
  Token,
  UserPublic,
  UpdatePassword,
  UserCreate,
  UserRegister,
  UsersPublic,
  UserUpdate,
  UserUpdateMe,
  Param,
  ParamCreate,
  ParamUpdate,
  Target,
  TargetCreate,
  TargetUpdate,
  WorkflowCreateWithParamsAndTargets,
  WorkflowPublic,
  WorkflowPublicWithParamsAndTargets,
  WorkflowsPublicWithParamsAndTargets,
  WorkflowUpdate,
  Body_files_upload_file,
  FilePublic,
  FilesPublic,
  TaskPublic,
  TasksPublicMinimal,
} from "./models"

export type TDataLoginAccessToken = {
  formData: Body_login_login_access_token
}
export type TDataRecoverPassword = {
  email: string
}
export type TDataResetPassword = {
  requestBody: NewPassword
}
export type TDataRecoverPasswordHtmlContent = {
  email: string
}

export class LoginService {
  /**
   * Login Access Token
   * OAuth2 compatible token login, get an access token for future requests
   * @returns Token Successful Response
   * @throws ApiError
   */
  public static loginAccessToken(
    data: TDataLoginAccessToken,
  ): CancelablePromise<Token> {
    const { formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/login/access-token",
      formData: formData,
      mediaType: "application/x-www-form-urlencoded",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Test Token
   * Test access token
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static testToken(): CancelablePromise<UserPublic> {
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/login/test-token",
    })
  }

  /**
   * Recover Password
   * Password Recovery
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static recoverPassword(
    data: TDataRecoverPassword,
  ): CancelablePromise<Message> {
    const { email } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/password-recovery/{email}",
      path: {
        email,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Reset Password
   * Reset password
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static resetPassword(
    data: TDataResetPassword,
  ): CancelablePromise<Message> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/reset-password/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Recover Password Html Content
   * HTML Content for Password Recovery
   * @returns string Successful Response
   * @throws ApiError
   */
  public static recoverPasswordHtmlContent(
    data: TDataRecoverPasswordHtmlContent,
  ): CancelablePromise<string> {
    const { email } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/password-recovery-html-content/{email}",
      path: {
        email,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export type TDataReadUsers = {
  limit?: number
  skip?: number
}
export type TDataCreateUser = {
  requestBody: UserCreate
}
export type TDataUpdateUserMe = {
  requestBody: UserUpdateMe
}
export type TDataUpdatePasswordMe = {
  requestBody: UpdatePassword
}
export type TDataRegisterUser = {
  requestBody: UserRegister
}
export type TDataReadUserById = {
  userId: string
}
export type TDataUpdateUser = {
  requestBody: UserUpdate
  userId: string
}
export type TDataDeleteUser = {
  userId: string
}

export class UsersService {
  /**
   * Read Users
   * Retrieve users.
   * @returns UsersPublic Successful Response
   * @throws ApiError
   */
  public static readUsers(
    data: TDataReadUsers = {},
  ): CancelablePromise<UsersPublic> {
    const { limit = 100, skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/",
      query: {
        skip,
        limit,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create User
   * Create new user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static createUser(
    data: TDataCreateUser,
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/users/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read User Me
   * Get current user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static readUserMe(): CancelablePromise<UserPublic> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/me",
    })
  }

  /**
   * Delete User Me
   * Delete own user.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteUserMe(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/users/me",
    })
  }

  /**
   * Update User Me
   * Update own user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static updateUserMe(
    data: TDataUpdateUserMe,
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/users/me",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Password Me
   * Update own password.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static updatePasswordMe(
    data: TDataUpdatePasswordMe,
  ): CancelablePromise<Message> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/users/me/password",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Register User
   * Create new user without the need to be logged in.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static registerUser(
    data: TDataRegisterUser,
  ): CancelablePromise<UserPublic> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/users/signup",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read User By Id
   * Get a specific user by id.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static readUserById(
    data: TDataReadUserById,
  ): CancelablePromise<UserPublic> {
    const { userId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/users/{user_id}",
      path: {
        user_id: userId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update User
   * Update a user.
   * @returns UserPublic Successful Response
   * @throws ApiError
   */
  public static updateUser(
    data: TDataUpdateUser,
  ): CancelablePromise<UserPublic> {
    const { requestBody, userId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/users/{user_id}",
      path: {
        user_id: userId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete User
   * Delete a user.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteUser(data: TDataDeleteUser): CancelablePromise<Message> {
    const { userId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/users/{user_id}",
      path: {
        user_id: userId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export type TDataTestEmail = {
  emailTo: string
}

export class UtilsService {
  /**
   * Test Email
   * Test emails.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static testEmail(data: TDataTestEmail): CancelablePromise<Message> {
    const { emailTo } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/utils/test-email/",
      query: {
        email_to: emailTo,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Health Check
   * @returns boolean Successful Response
   * @throws ApiError
   */
  public static healthCheck(): CancelablePromise<boolean> {
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/utils/health-check/",
    })
  }
}

export type TDataReadWorkflows = {
  limit?: number
  skip?: number
}
export type TDataCreateWorkflow = {
  requestBody: WorkflowCreateWithParamsAndTargets
}
export type TDataReadWorkflow = {
  workflowId: string
}
export type TDataUpdateWorkflow = {
  requestBody: WorkflowUpdate
  workflowId: string
}
export type TDataDeleteWorkflow = {
  workflowId: string
}
export type TDataReadWorkflowByName = {
  workflowName: string
}
export type TDataReadWorkflowParams = {
  workflowId: string
}
export type TDataAddParamToWorkflow = {
  requestBody: ParamCreate
  workflowId: string
}
export type TDataUpdateParamInWorkflow = {
  paramId: string
  requestBody: ParamUpdate
  workflowId: string
}
export type TDataDeleteParamFromWorkflow = {
  paramId: string
  workflowId: string
}
export type TDataReadWorkflowTargets = {
  workflowId: string
}
export type TDataAddTargetToWorkflow = {
  requestBody: TargetCreate
  workflowId: string
}
export type TDataUpdateTargetInWorkflow = {
  requestBody: TargetUpdate
  targetId: string
  workflowId: string
}
export type TDataDeleteTargetFromWorkflow = {
  targetId: string
  workflowId: string
}

export class WorkflowsService {
  /**
   * Read Workflows
   * Retrieve workflows.
   * @returns WorkflowsPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readWorkflows(
    data: TDataReadWorkflows = {},
  ): CancelablePromise<WorkflowsPublicWithParamsAndTargets> {
    const { limit = 100, skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/workflows/",
      query: {
        skip,
        limit,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create Workflow
   * Create new workflow along with its params.
   * @returns WorkflowPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static createWorkflow(
    data: TDataCreateWorkflow,
  ): CancelablePromise<WorkflowPublicWithParamsAndTargets> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/workflows/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Workflow
   * Retrieve workflow by ID.
   * @returns WorkflowPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readWorkflow(
    data: TDataReadWorkflow,
  ): CancelablePromise<WorkflowPublicWithParamsAndTargets> {
    const { workflowId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/workflows/{workflow_id}",
      path: {
        workflow_id: workflowId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Workflow
   * Update workflow by ID.
   * @returns WorkflowPublic Successful Response
   * @throws ApiError
   */
  public static updateWorkflow(
    data: TDataUpdateWorkflow,
  ): CancelablePromise<WorkflowPublic> {
    const { requestBody, workflowId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/workflows/{workflow_id}",
      path: {
        workflow_id: workflowId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Workflow
   * Delete workflow by ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteWorkflow(
    data: TDataDeleteWorkflow,
  ): CancelablePromise<Message> {
    const { workflowId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/workflows/{workflow_id}",
      path: {
        workflow_id: workflowId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Workflow By Name
   * Retrieve workflow by name.
   * @returns WorkflowPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readWorkflowByName(
    data: TDataReadWorkflowByName,
  ): CancelablePromise<WorkflowPublicWithParamsAndTargets> {
    const { workflowName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/workflows/name/{workflow_name}",
      path: {
        workflow_name: workflowName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Workflow Params
   * Retrieve workflow params by workflow ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static readWorkflowParams(
    data: TDataReadWorkflowParams,
  ): CancelablePromise<Array<Param>> {
    const { workflowId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/workflows/{workflow_id}/params",
      path: {
        workflow_id: workflowId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Add Param To Workflow
   * Add param to workflow by workflow ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static addParamToWorkflow(
    data: TDataAddParamToWorkflow,
  ): CancelablePromise<Param> {
    const { requestBody, workflowId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/workflows/{workflow_id}/params",
      path: {
        workflow_id: workflowId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Param In Workflow
   * Update param in workflow by workflow ID and param ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static updateParamInWorkflow(
    data: TDataUpdateParamInWorkflow,
  ): CancelablePromise<Param> {
    const { paramId, requestBody, workflowId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/workflows/{workflow_id}/params/{param_id}",
      path: {
        workflow_id: workflowId,
        param_id: paramId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Param From Workflow
   * Delete param from workflow by workflow ID and param ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteParamFromWorkflow(
    data: TDataDeleteParamFromWorkflow,
  ): CancelablePromise<Message> {
    const { paramId, workflowId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/workflows/{workflow_id}/params/{param_id}",
      path: {
        workflow_id: workflowId,
        param_id: paramId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Workflow Targets
   * Retrieve workflow targets by workflow ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static readWorkflowTargets(
    data: TDataReadWorkflowTargets,
  ): CancelablePromise<Array<Target>> {
    const { workflowId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/workflows/{workflow_id}/targets",
      path: {
        workflow_id: workflowId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Add Target To Workflow
   * Add target to workflow by workflow ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static addTargetToWorkflow(
    data: TDataAddTargetToWorkflow,
  ): CancelablePromise<Target> {
    const { requestBody, workflowId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/workflows/{workflow_id}/targets",
      path: {
        workflow_id: workflowId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Target In Workflow
   * Update target in workflow by workflow ID and target ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static updateTargetInWorkflow(
    data: TDataUpdateTargetInWorkflow,
  ): CancelablePromise<Target> {
    const { requestBody, targetId, workflowId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/workflows/{workflow_id}/targets/{target_id}",
      path: {
        workflow_id: workflowId,
        target_id: targetId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Target From Workflow
   * Delete target from workflow by workflow ID and target ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTargetFromWorkflow(
    data: TDataDeleteTargetFromWorkflow,
  ): CancelablePromise<Message> {
    const { targetId, workflowId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/workflows/{workflow_id}/targets/{target_id}",
      path: {
        workflow_id: workflowId,
        target_id: targetId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export type TDataReadFiles = {
  limit?: number
  orderBy?: string
  skip?: number
}
export type TDataUploadFile = {
  formData: Body_files_upload_file
}
export type TDataReadFile = {
  id: string
}
export type TDataDeleteFile = {
  id: string
}
export type TDataDownloadFile = {
  id: string
}
export type TDataGetDownloadToken = {
  id: string
  minutes?: number
}
export type TDataDownloadFileWithToken = {
  token: string
}

export class FilesService {
  /**
   * Read Files
   * Retrieve files.
   * @returns FilesPublic Successful Response
   * @throws ApiError
   */
  public static readFiles(
    data: TDataReadFiles = {},
  ): CancelablePromise<FilesPublic> {
    const { limit = 100, orderBy = "-created_at", skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/",
      query: {
        skip,
        limit,
        order_by: orderBy,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Upload File
   * Upload a new file.
   * @returns FilePublic Successful Response
   * @throws ApiError
   */
  public static uploadFile(
    data: TDataUploadFile,
  ): CancelablePromise<FilePublic> {
    const { formData } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/files/",
      formData: formData,
      mediaType: "multipart/form-data",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Files
   * Delete all files.
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static deleteFiles(): CancelablePromise<unknown> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/files/",
    })
  }

  /**
   * Read File
   * Retrieve file metadata.
   * @returns FilePublic Successful Response
   * @throws ApiError
   */
  public static readFile(data: TDataReadFile): CancelablePromise<FilePublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete File
   * Delete file.
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static deleteFile(data: TDataDeleteFile): CancelablePromise<unknown> {
    const { id } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/files/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Download File
   * Download file.
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static downloadFile(
    data: TDataDownloadFile,
  ): CancelablePromise<unknown> {
    const { id } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/{id}/download",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Get Download Token
   * Get signed file download token.
   * @returns string Successful Response
   * @throws ApiError
   */
  public static getDownloadToken(
    data: TDataGetDownloadToken,
  ): CancelablePromise<string> {
    const { id, minutes = 1 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/{id}/token",
      path: {
        id,
      },
      query: {
        minutes,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Download File With Token
   * Download file by token.
   * @returns unknown Successful Response
   * @throws ApiError
   */
  public static downloadFileWithToken(
    data: TDataDownloadFileWithToken,
  ): CancelablePromise<unknown> {
    const { token } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/files/download/{token}",
      path: {
        token,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}

export type TDataReadTasks = {
  limit?: number
  orderBy?: string
  skip?: number
}
export type TDataCreateTask = {
  requestBody: Record<string, unknown>
  workflowId: string
}
export type TDataReadActiveTasks = {
  limit?: number
  skip?: number
}
export type TDataReadTask = {
  id: string
}
export type TDataDeleteTask = {
  id: string
}
export type TDataCancelTask = {
  id: string
}

export class TasksService {
  /**
   * Read Tasks
   * Retrieve tasks with optional ordering.
   * @returns TasksPublicMinimal Successful Response
   * @throws ApiError
   */
  public static readTasks(
    data: TDataReadTasks = {},
  ): CancelablePromise<TasksPublicMinimal> {
    const { limit = 100, orderBy = "-created_at", skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/",
      query: {
        skip,
        limit,
        order_by: orderBy,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Create Task
   * Create and run a task of a specific workflow, validating against predefined workflow parameters.
   * Accepts both files and regular parameters dynamically.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static createTask(
    data: TDataCreateTask,
  ): CancelablePromise<TaskPublic> {
    const { requestBody, workflowId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tasks/",
      query: {
        workflow_id: workflowId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Tasks
   * Delete all inactive tasks.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTasks(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tasks/",
    })
  }

  /**
   * Cancel Tasks
   * Cancel all active tasks with status pending or running.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static cancelTasks(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/cancel",
    })
  }

  /**
   * Read Active Tasks
   * Retrieve active tasks with status pending or running.
   * @returns TasksPublicMinimal Successful Response
   * @throws ApiError
   */
  public static readActiveTasks(
    data: TDataReadActiveTasks = {},
  ): CancelablePromise<TasksPublicMinimal> {
    const { limit = 100, skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/active",
      query: {
        skip,
        limit,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Task
   * Retrieve task metadata.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static readTask(data: TDataReadTask): CancelablePromise<TaskPublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tasks/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Task
   * Delete task.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTask(data: TDataDeleteTask): CancelablePromise<Message> {
    const { id } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tasks/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Cancel Task
   * Cancel task.
   * @returns TaskPublic Successful Response
   * @throws ApiError
   */
  public static cancelTask(
    data: TDataCancelTask,
  ): CancelablePromise<TaskPublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tasks/{id}/cancel",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}
