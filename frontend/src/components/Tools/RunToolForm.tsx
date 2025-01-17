import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import FileDropZone from "../Files/FileUploadButton"
import { Select, SelectInstance } from "chakra-react-select"
import { type SubmitHandler, useForm } from "react-hook-form"
import {
  CreateRunData,
  FilesService,
  type Param,
  type RunPublic,
} from "../../client"
import { createRunMutation, readToolParamsOptions } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"
import React from "react"
import { handleError } from "../../utils"
import { Options } from "@hey-api/client-axios"

interface RunToolFormProps {
  toolId: string
  onSuccess?: (run: RunPublic) => void
}

const RunToolForm = ({ toolId, onSuccess }: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const { data: params, isLoading: paramsLoading } = useQuery({
    ...readToolParamsOptions({path: {tool_id: toolId}}),  
  })

  const { data: files, isLoading: filesLoading, refetch } = useQuery({
    queryKey: ["files"],
    queryFn: () =>
      FilesService.readFiles().then(({data: files}) =>
        files?.data
          .map((file) => ({
            label: `${file.name}`,
            value: file.id,
          }))
          .reverse(),
      ),
  })

  const selectRef = React.createRef<SelectInstance<{label:string, value:string}>>()
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
    ...createRunMutation({query: {tool_id: toolId}}),
    onSuccess: (run: RunPublic) => {
      showToast(
        "Success!",
        `Run Queued (${run.id})`,
        "success",
      )
      if (onSuccess) onSuccess(run)
    },
    onError: (error) => {
      handleError(error, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["toolRuns"] })
    },
  })

  const onSubmit: SubmitHandler<any> = (formData: {[key: string]: unknown}) => {
    mutation.mutate({body: formData} as Options<CreateRunData>)
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
             <Flex
              gap={4}
              direction={"column"}
            >
                <Select
                  id={param.name}
                  ref={selectRef}
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
                <Flex  justifyContent={"end"}>
                  <FileDropZone onUpload={(file) => {
                    refetch().then(() => {
                      selectRef.current?.setValue({value: file.id, label:file.name}, 'select-option')
                      setValue(
                        param.name,
                        file.id
                      )
                    })
                  }}/>
                </Flex>
              </Flex>
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
          Run Tool
        </Button>
        <Button onClick={() => reset(defaultValues)} variant="outline">
          Reset
        </Button>
      </ButtonGroup>
    </Box>
  )
}

export default RunToolForm
