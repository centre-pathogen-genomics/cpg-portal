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
import { Select, } from "chakra-react-select"
import { type SubmitHandler, useForm } from "react-hook-form"
import {
  CreateRunData,
  FilesService,
  type Param,
  type RunPublic,
} from "../../client"
import { createRunMutation, readToolParamsOptions } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"
import React, { useMemo, useState } from "react"
import { handleError } from "../../utils"
import { Options } from "@hey-api/client-axios"
import FileUpload from "../Files/UploadFileWithProgress"


interface EnumParamProps {
  param: Param
  setValue: (value: any) => void
}

const EnumParam = ({ param, setValue }: EnumParamProps) => {
  return (
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
            selectedOption ? selectedOption.value : "",
          )
        }}
        selectedOptionStyle="check"
      />
  )
}

interface FileParamProps {
  param: Param
  files: { label: string, value: string }[]
  setValue: (value: string) => void
  selectedOptions: { label: string, value: string }[]
  setSelectedOptions: (options: { label: string, value: string }[]) => void
}

const FileParam = ({ param, files, setValue, selectedOptions, setSelectedOptions }: FileParamProps) => {
  return (
    <Flex direction={"column"}>
      <FileUpload
        onComplete={(file) => {
          setValue(file.id);
          setSelectedOptions([{ label: file.name, value: file.id }]);
        }}
      />
      <Select
        id={param.name}
        options={files}
        placeholder={param.description || "Select a file"}
        isMulti={false}
        value={selectedOptions}
        onChange={(selectedOption) => {
          setValue(selectedOption ? selectedOption.value : "");
          setSelectedOptions(selectedOption ? [selectedOption] : []);
        }}
        selectedOptionStyle="check"
      />
    </Flex>
  );
};


interface RunToolFormProps {
  toolId: string
  onSuccess?: (run: RunPublic) => void
}

const RunToolForm = ({ toolId, onSuccess }: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [isLoading, setIsLoading] = useState(false)

  const { data: params, isLoading: paramsLoading } = useQuery({
    ...readToolParamsOptions({path: {tool_id: toolId}}),  
  })

  const { data, isLoading: filesLoading } = useQuery({
    queryKey: ["files"],
    queryFn: () =>
      FilesService.readFiles().then(({data: files}) =>
        files?.data
          .map((file) => ({
            label: `${file.name}`,
            value: file.id,
          }))
      ),
  })
  
  let files = data ?? []

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
    formState: { errors },
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
      handleError(error, showToast);
      setIsLoading(false)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["toolRuns"] })
    },
  })

  const onSubmit: SubmitHandler<any> = (formData: {[key: string]: unknown}) => {
    setIsLoading(true);
    mutation.mutate({body: formData} as Options<CreateRunData>)
  }
  const normalizedParams = useMemo(() => params || [], [params]);
 
  const [fileStates, setFileStates] = useState<Record<string, { label: string; value: string }[]>>({});

  const handleFileSelection = (paramName: string, selectedOptions: { label: string; value: string }[]) => {
    setFileStates((prev) => ({ ...prev, [paramName]: selectedOptions }));
  };


  if (paramsLoading || filesLoading) return <div>Loading...</div>


  
  return (
    <Box as="form" onSubmit={handleSubmit(onSubmit)} w="100%">
      <Box>
        {normalizedParams?.map((param: Param) => (
          <FormControl
            pb={4}
            key={param.id}
            isRequired={param.required}
            isInvalid={errors[param.name] !== undefined}
          >
            <FormLabel htmlFor={param.name}>{param.name} ({param.description})</FormLabel>
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
              <EnumParam param={param} setValue={(value) => setValue(param.name, value)} />
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
              <FileParam
                param={param}
                files={files}
                setValue={(value) => setValue(param.name, value)}
                selectedOptions={fileStates[param.name] || []}
                setSelectedOptions={(selectedOptions) => handleFileSelection(param.name, selectedOptions)}
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
        <Button variant="primary" type="submit" isLoading={isLoading}>
          Run Tool
        </Button>
        <Button onClick={() => {reset(defaultValues); setFileStates({})}} variant="outline">
          Reset
        </Button>
      </ButtonGroup>
    </Box>
  )
}

export default RunToolForm
