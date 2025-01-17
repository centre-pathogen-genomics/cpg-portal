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
  ToolCreateWithParamsAndTargets,
  ToolPublic,
  ToolPublicWithParamsAndTargets,
  ToolsPublicWithParamsAndTargets,
  ToolUpdate,
  Body_files_upload_file,
  FilePublic,
  FilesPublic,
  RunPublic,
  RunsPublicMinimal,
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

export type TDataReadTools = {
  limit?: number
  skip?: number
}
export type TDataCreateTool = {
  requestBody: ToolCreateWithParamsAndTargets
}
export type TDataReadTool = {
  toolId: string
}
export type TDataUpdateTool = {
  requestBody: ToolUpdate
  toolId: string
}
export type TDataDeleteTool = {
  toolId: string
}
export type TDataFavouriteTool = {
  toolId: string
}
export type TDataUnfavouriteTool = {
  toolId: string
}
export type TDataReadToolByName = {
  toolName: string
}
export type TDataReadToolParams = {
  toolId: string
}
export type TDataAddParamToTool = {
  requestBody: ParamCreate
  toolId: string
}
export type TDataUpdateParamInTool = {
  paramId: string
  requestBody: ParamUpdate
  toolId: string
}
export type TDataDeleteParamFromTool = {
  paramId: string
  toolId: string
}
export type TDataReadToolTargets = {
  toolId: string
}
export type TDataAddTargetToTool = {
  requestBody: TargetCreate
  toolId: string
}
export type TDataUpdateTargetInTool = {
  requestBody: TargetUpdate
  targetId: string
  toolId: string
}
export type TDataDeleteTargetFromTool = {
  targetId: string
  toolId: string
}

export class ToolsService {
  /**
   * Read Tools
   * Retrieve tools with a favourited status for the current user.
   * @returns ToolsPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readTools(
    data: TDataReadTools = {},
  ): CancelablePromise<ToolsPublicWithParamsAndTargets> {
    const { limit = 100, skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tools/",
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
   * Create Tool
   * Create new tool along with its params.
   * @returns ToolPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static createTool(
    data: TDataCreateTool,
  ): CancelablePromise<ToolPublicWithParamsAndTargets> {
    const { requestBody } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tools/",
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Tool
   * Retrieve tool by ID.
   * @returns ToolPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readTool(
    data: TDataReadTool,
  ): CancelablePromise<ToolPublicWithParamsAndTargets> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tools/{tool_id}",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Tool
   * Update tool by ID.
   * @returns ToolPublic Successful Response
   * @throws ApiError
   */
  public static updateTool(
    data: TDataUpdateTool,
  ): CancelablePromise<ToolPublic> {
    const { requestBody, toolId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tools/{tool_id}",
      path: {
        tool_id: toolId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Tool
   * Delete tool by ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTool(data: TDataDeleteTool): CancelablePromise<Message> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tools/{tool_id}",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Favourite Tool
   * Add a tool to the current user's favourites.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static favouriteTool(
    data: TDataFavouriteTool,
  ): CancelablePromise<Message> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tools/{tool_id}/favourite",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Unfavourite Tool
   * Remove a tool from the current user's favourites.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static unfavouriteTool(
    data: TDataUnfavouriteTool,
  ): CancelablePromise<Message> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tools/{tool_id}/favourite",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Tool By Name
   * Retrieve tool by name.
   * @returns ToolPublicWithParamsAndTargets Successful Response
   * @throws ApiError
   */
  public static readToolByName(
    data: TDataReadToolByName,
  ): CancelablePromise<ToolPublicWithParamsAndTargets> {
    const { toolName } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tools/name/{tool_name}",
      path: {
        tool_name: toolName,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Tool Params
   * Retrieve tool params by tool ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static readToolParams(
    data: TDataReadToolParams,
  ): CancelablePromise<Array<Param>> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tools/{tool_id}/params",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Add Param To Tool
   * Add param to tool by tool ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static addParamToTool(
    data: TDataAddParamToTool,
  ): CancelablePromise<Param> {
    const { requestBody, toolId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tools/{tool_id}/params",
      path: {
        tool_id: toolId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Param In Tool
   * Update param in tool by tool ID and param ID.
   * @returns Param Successful Response
   * @throws ApiError
   */
  public static updateParamInTool(
    data: TDataUpdateParamInTool,
  ): CancelablePromise<Param> {
    const { paramId, requestBody, toolId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tools/{tool_id}/params/{param_id}",
      path: {
        tool_id: toolId,
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
   * Delete Param From Tool
   * Delete param from tool by tool ID and param ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteParamFromTool(
    data: TDataDeleteParamFromTool,
  ): CancelablePromise<Message> {
    const { paramId, toolId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tools/{tool_id}/params/{param_id}",
      path: {
        tool_id: toolId,
        param_id: paramId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Read Tool Targets
   * Retrieve tool targets by tool ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static readToolTargets(
    data: TDataReadToolTargets,
  ): CancelablePromise<Array<Target>> {
    const { toolId } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/tools/{tool_id}/targets",
      path: {
        tool_id: toolId,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Add Target To Tool
   * Add target to tool by tool ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static addTargetToTool(
    data: TDataAddTargetToTool,
  ): CancelablePromise<Target> {
    const { requestBody, toolId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/tools/{tool_id}/targets",
      path: {
        tool_id: toolId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Update Target In Tool
   * Update target in tool by tool ID and target ID.
   * @returns Target Successful Response
   * @throws ApiError
   */
  public static updateTargetInTool(
    data: TDataUpdateTargetInTool,
  ): CancelablePromise<Target> {
    const { requestBody, targetId, toolId } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/tools/{tool_id}/targets/{target_id}",
      path: {
        tool_id: toolId,
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
   * Delete Target From Tool
   * Delete target from tool by tool ID and target ID.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteTargetFromTool(
    data: TDataDeleteTargetFromTool,
  ): CancelablePromise<Message> {
    const { targetId, toolId } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/tools/{tool_id}/targets/{target_id}",
      path: {
        tool_id: toolId,
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

export type TDataReadRuns = {
  limit?: number
  orderBy?: string
  skip?: number
}
export type TDataCreateRun = {
  requestBody: Record<string, unknown>
  toolId: string
}
export type TDataReadActiveRuns = {
  limit?: number
  skip?: number
}
export type TDataReadRun = {
  id: string
}
export type TDataDeleteRun = {
  id: string
}
export type TDataCancelRun = {
  id: string
}

export class RunsService {
  /**
   * Read Runs
   * Retrieve runs with optional ordering.
   * @returns RunsPublicMinimal Successful Response
   * @throws ApiError
   */
  public static readRuns(
    data: TDataReadRuns = {},
  ): CancelablePromise<RunsPublicMinimal> {
    const { limit = 100, orderBy = "-created_at", skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/runs/",
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
   * Create Run
   * Create and run a run of a specific tool, validating against predefined tool parameters.
   * Accepts both files and regular parameters dynamically.
   * @returns RunPublic Successful Response
   * @throws ApiError
   */
  public static createRun(data: TDataCreateRun): CancelablePromise<RunPublic> {
    const { requestBody, toolId } = data
    return __request(OpenAPI, {
      method: "POST",
      url: "/api/v1/runs/",
      query: {
        tool_id: toolId,
      },
      body: requestBody,
      mediaType: "application/json",
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Runs
   * Delete all inactive runs.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteRuns(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/runs/",
    })
  }

  /**
   * Cancel Runs
   * Cancel all active runs with status pending or running.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static cancelRuns(): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/runs/cancel",
    })
  }

  /**
   * Read Active Runs
   * Retrieve active runs with status pending or running.
   * @returns RunsPublicMinimal Successful Response
   * @throws ApiError
   */
  public static readActiveRuns(
    data: TDataReadActiveRuns = {},
  ): CancelablePromise<RunsPublicMinimal> {
    const { limit = 100, skip = 0 } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/runs/active",
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
   * Read Run
   * Retrieve run metadata.
   * @returns RunPublic Successful Response
   * @throws ApiError
   */
  public static readRun(data: TDataReadRun): CancelablePromise<RunPublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "GET",
      url: "/api/v1/runs/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Delete Run
   * Delete run.
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteRun(data: TDataDeleteRun): CancelablePromise<Message> {
    const { id } = data
    return __request(OpenAPI, {
      method: "DELETE",
      url: "/api/v1/runs/{id}",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }

  /**
   * Cancel Run
   * Cancel run.
   * @returns RunPublic Successful Response
   * @throws ApiError
   */
  public static cancelRun(data: TDataCancelRun): CancelablePromise<RunPublic> {
    const { id } = data
    return __request(OpenAPI, {
      method: "PATCH",
      url: "/api/v1/runs/{id}/cancel",
      path: {
        id,
      },
      errors: {
        422: `Validation Error`,
      },
    })
  }
}
