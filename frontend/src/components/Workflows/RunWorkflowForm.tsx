import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Select } from "chakra-react-select"
import { type SubmitHandler, useForm } from "react-hook-form"
import {
  FilesService,
  type Param,
  type TaskPublic,
  WorkflowsService,
} from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface RunWorkflowFormProps {
  workflowId: string
  onSuccess?: (task: TaskPublic) => void
}

const RunWorkflowForm = ({ workflowId, onSuccess }: RunWorkflowFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const { data: params, isLoading: paramsLoading } = useQuery({
    queryKey: ["workflowParams", workflowId],
    queryFn: () => WorkflowsService.readWorkflowParams({ workflowId }),
  })

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["files"],
    queryFn: () =>
      FilesService.readFiles().then((data) =>
        data.data
          .map((file) => ({
            label: `${file.name} (Task: ${file.result_id})`,
            value: file.id,
          }))
          .reverse(),
      ),
  })

  const defaultValues = params?.reduce((acc, param) => {
    acc[param.name] = param.default
    return acc
  }, {} as Record<string, any>) ?? {}

  interface FormData {
    [key: string]: any;
  }
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues,
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      WorkflowsService.runWorkflow({
        requestBody: data,
        workflowId,
      }),
    onSuccess: (task) => {
      showToast(
        "Success!",
        `Workflow run successfully. Task ID: ${task.id}`,
        "success",
      )
      if (onSuccess) onSuccess(task)
    },
    onError: (error) => {
      showToast("Error", error.message, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowRuns"] })
    },
  })

  const onSubmit: SubmitHandler<any> = (formData) => {
    mutation.mutate({ ...formData })
  }

  if (paramsLoading || filesLoading) return <div>Loading...</div>

  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} w="100%">
      <Box>
        {params?.map((param: Param) => (
          <FormControl
            pb={4}
            key={param.id}
            isRequired={param.required}
            isInvalid={errors[param.name] !== undefined}
          >
            <FormLabel htmlFor={param.name}>{param.name}</FormLabel>
            {param.param_type === "str" && (
              <Input
                id={param.name}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                })}
                placeholder={param.description || param.name}
                defaultValue={param.default as string}
              />
            )}
            {param.param_type === "int" && (
              <Input
                id={param.name}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                  valueAsNumber: true,
                })}
                placeholder={param.description || param.name}
                defaultValue={param.default as number}
                type="number"
              />
            )}
            {param.param_type === "float" && (
              <Input
                id={param.name}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                  valueAsNumber: true,
                })}
                placeholder={param.description || param.name}
                defaultValue={param.default as number}
                type="number"
                step="0.01"
              />
            )}
            {param.param_type === "enum" && (
              <Select
                id={param.name}
                options={param.options?.map((option) => ({
                  label: option,
                  value: option,
                }))}
                placeholder={param.description || "Select an option"}
                defaultValue={
                  param.default
                    ? { label: param.default, value: param.default }
                    : undefined
                }
                isMulti={false}
                onChange={(selectedOption) => {
                  setValue(
                    param.name,
                    selectedOption ? selectedOption.value : "",
                  )
                }}
                selectedOptionStyle="check"
              />
            )}
            {param.param_type === "bool" && (
              <Checkbox
                id={param.name}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                })}
                defaultChecked={param.default as boolean}
              >
                {param.description || param.name}
              </Checkbox>
            )}
            {param.param_type === "file" && (
              <Select
                id={param.name}
                options={files}
                placeholder={param.description || "Select a file"}
                isMulti={false}
                onChange={(selectedOption) => {
                  setValue(
                    param.name,
                    selectedOption ? selectedOption.value : "",
                  )
                }}
                selectedOptionStyle="check"
              />
            )}
            {errors[param.name] && (
              <FormErrorMessage>
                {errors[param.name]?.message as React.ReactNode}
              </FormErrorMessage>
            )}
          </FormControl>
        ))}
      </Box>
      <ButtonGroup>
        <Button variant="primary" type="submit" isLoading={isSubmitting}>
          Start Workflow
        </Button>
        <Button onClick={() => reset(defaultValues)} variant="outline">
          Reset
        </Button>
      </ButtonGroup>
    </Box>
  )
}

export default RunWorkflowForm
