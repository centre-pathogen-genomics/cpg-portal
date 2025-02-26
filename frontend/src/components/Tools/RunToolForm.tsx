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
  Text,
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
import { createRunMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"
import React, { useEffect, useMemo, useState } from "react"
import { handleError } from "../../utils"
import { Options } from "@hey-api/client-axios"
import FileUploadButton from "../Files/UploadFileButtonWithProgress"
import TagInput from "../Common/TagInput"


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
        placeholder="Select an option"
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
  param: Param;
  files: { label: string; value: string }[];
  setValue: (
    options:
      | { label: string; value: string }[]
      | { label: string; value: string }
  ) => void;
  selectedOptions: { label: string; value: string }[];
  multiple: boolean;
  updateLocalFiles?: (file: { label: string; value: string }) => void;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
}

const FileParam = ({
  param,
  files,
  setValue,
  selectedOptions,
  multiple = false,
  updateLocalFiles,
  isLoading,
  setIsLoading,
}: FileParamProps) => {
  return (
    <Flex direction={"column"} gap={2}>
      <Select
        id={param.name}
        options={files}
        placeholder={"Choose from My Files" + (multiple ? " (multiple)" : "")}
        isMulti={multiple}
        isClearable={true}
        value={selectedOptions}
        onChange={(selectedOption) => {
          setValue(
            Array.isArray(selectedOption)
              ? selectedOption
              : [selectedOption]
          );
        }}
        isLoading={isLoading}
        selectedOptionStyle="check"
        
      />
      <FileUploadButton
        onComplete={(file) => {
          const newFile = { label: file.name, value: file.id };
          // Immediately update the local files state via the passed-in updater
          if (updateLocalFiles) {
            updateLocalFiles(newFile);
          }
          // Update the form value
          setValue(newFile);
        }}
        onEnd={() => {
          if (setIsLoading) {
            setIsLoading(false);
          }
        }
        }
        onStart={() => {
          if (setIsLoading) {
            setIsLoading(true);
          }
        }}
      />
    </Flex>
  );
};


interface RunToolFormProps {
  toolId: string
  params: Param[]
  onSuccess?: (run: RunPublic) => void
}

const RunToolForm = ({ toolId, params, onSuccess }: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [isLoading, setIsLoading] = useState(false)

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
  
  // Local state to store files for immediate updates
  const [localFiles, setLocalFiles] = useState<{ label: string; value: string }[]>([]);
  // Tags state
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setLocalFiles(data);
    }
  }, [data]);

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
    getValues,
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
      setIsLoading(false);
    },
    onSettled: () => {
      setIsLoading(false)
      queryClient.invalidateQueries({ queryKey: ["toolRuns"] })
    },
  })

 
  const onValid: SubmitHandler<any> = async (formData: {[key: string]: unknown}) => {
    setIsLoading(true);
    // filter out null values and default values
    for (const key in formData) {
      if (formData[key] === null) {
        delete formData[key];
      }
    }
    await mutation.mutateAsync({body: {params:   formData, tags: tags}} as Options<CreateRunData>)
    setIsLoading(false);
  }

  const onSubmit = (data: any) => {
    setIsLoading(true);
    handleSubmit(onValid)(data)
    setIsLoading(false);
  }

  const normalizedParams = useMemo(() => params || [], [params]);
 
  const [fileStates, setFileStates] = useState<Record<string, { label: string; value: string }[]>>({});
  
  return (
    <Box as="form" onSubmit={onSubmit} w="100%">
      <Box>
        {normalizedParams?.map((param: Param) => (
          <FormControl
            pb={4}
            key={param.name}
            isRequired={param.required}
            isInvalid={errors[param.name] !== undefined}
          >
              <FormLabel fontSize={"md"} htmlFor={param.name} mb={0}>
                {param.name.toUpperCase()}
              </FormLabel>
              {param.param_type !== "bool" && (
                <Text fontSize="sm" color={'gray.500'} mb={2} >{param.description}</Text>
              )}
            {param.param_type === "str" && (
              <Input
                id={param.name}
                {...register(param.name, {
                  required: param.required ? "Required" : false,
                })}
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
                placeholder="Enter a number"
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
                placeholder="Enter a number"
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
               {param.description || 'Check to enable'} 
              </Checkbox>
            )}
            {(param.param_type === "file" || param.param_type === "files") && (
            <FileParam
              isLoading={filesLoading}
              setIsLoading={setIsLoading}
              param={param}
              files={localFiles}  // Use localFiles instead of data
              setValue={(selected) => {
                if (Array.isArray(selected) || param.param_type === "file") {
                  // For multi-file selection, replace the existing value.

                  if (!Array.isArray(selected)) {
                    selected = [selected];
                  }
                  let values = selected.filter((v) => v !== null).map((v) => v.value);
                  setValue(param.name, values);
                  setFileStates((prev) => {
                    return { ...prev, [param.name]: selected as { label: string; value: string }[] }
                  });
                } else {
                  // For a single file upload, append the new file to the existing values.
                  let existingValues: string[] = getValues(param.name) || [];
                  existingValues.push(selected.value);
                  setValue(param.name, existingValues);
                  setFileStates((prev) => {
                    const existingOptions = prev[param.name] || []; 
                    return { ...prev, [param.name]: [...existingOptions, selected as { label: string; value: string }] }
                  });
                }
              }}
              selectedOptions={fileStates[param.name] || []}
              multiple={param.param_type === "files"}
              updateLocalFiles={(newFile) =>
                setLocalFiles((prev) => [...prev, newFile])
              }
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
      <Flex gap={2} justify={"space-between"} direction={{base: "column", md: "row"}}>
        <ButtonGroup>
          <Button variant="primary" type="submit" isLoading={isLoading} >
            Run Tool
          </Button>
          <Button onClick={() => {reset(defaultValues); setFileStates({})}} variant="outline">
            Reset
          </Button>
        </ButtonGroup>
        <TagInput tags={tags} setTags={setTags} />
      </Flex>
    </Box>
  )
}

export default RunToolForm
