import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Select, } from "chakra-react-select"
import { type SubmitHandler, useForm } from "react-hook-form"
import {
  FilesService,
  type Param,
  type RunPublic,
  FileTypeEnum,
} from "../../client"
import { createRunMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"
import React, { useEffect, useMemo, useState } from "react"
import { handleError } from "../../utils"
import FileUploadButton from "../Files/UploadFileButtonWithProgress"
import TagInput from "../Common/TagInput"
import EmailOnFinished from "./EmailOnFinished"


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
  setValue: (
    options:
      | { label: string; value: string }[]
      | { label: string; value: string }
  ) => void;
  selectedOptions: { label: string; value: string }[];
  allowedTypes?: FileTypeEnum[];
  multiple: boolean;
  setIsLoading?: (loading: boolean) => void;
  isDisabled?: boolean;
}

const FileParam = ({
  param,
  setValue,
  selectedOptions,
  multiple = false,
  setIsLoading,
  isDisabled = false,
}: FileParamProps) => {
  // Local state to store files for immediate updates
  const [files, setFiles] = useState<{ label: string; value: string, colorScheme?: string }[]>([]);
  const types = param.allowed_file_types ? param.allowed_file_types.map(t => t as FileTypeEnum) : undefined;
  // if multiple selection is enabled, always add group to the allowed types
  if (param.allowed_file_types && multiple && !param.allowed_file_types.includes("group")) {
    types?.push("group");
  }

  const colorSchemeMap: Record<string, string> = {
    "pair": "blue",
    "group": "green",
  };
  
  const { data, isLoading } = useQuery({
    enabled: !isDisabled,
    queryKey: ["files", param.name],
    queryFn: () =>
      FilesService.readFiles(
        {query:
          {
            types: param.allowed_file_types  ? param.allowed_file_types as unknown as FileTypeEnum[] : undefined,
          }
        }).then(({data: files}) =>{
          if (files?.data === undefined) {
            return [];
          }
          const flatFiles = [];
          for (const file of files?.data) {
              flatFiles.push({
                label: `${file.name} (${file.file_type})`,
                value: file.id,
                colorScheme: file.file_type ? colorSchemeMap[file.file_type] : undefined,
              });
          }
          return flatFiles;
        }
        ),
  })
 
  useEffect(() => {
    if (data) {
      setFiles(data);
    }
  }, [data]);

  return (
    <Flex direction={"column"} gap={2}>
      <Select
        id={param.name}
        options={files}
        placeholder={"Choose" + (param.multiple ? ` multiple files` : ` a single file`) + (param.allowed_file_types ? ` (${param.allowed_file_types.join(', ')})` : "")}
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
      {!isDisabled && (
      <FileUploadButton
        onComplete={(file) => {
          const newFile = { label: file.name, value: file.id };
          // Immediately update the local files state via the passed-in updater
          setFiles((prev) => [...prev, newFile])
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
    )}
    </Flex>
  );
};


interface RunToolFormProps {
  toolId: string
  params: Param[]
  onSuccess?: (run: RunPublic) => void
  isDisabled?: boolean
}

const RunToolForm = ({ toolId, params, onSuccess, isDisabled=false }: RunToolFormProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [isLoading, setIsLoading] = useState(false)

 
  
  
  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [emailOnFinished, setEmailOnFinished] = useState(false);
  const [runName, setRunName] = useState<string | null>(null);

 

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
    ...createRunMutation(),
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
    await mutation.mutateAsync({body: {params: formData, tags: tags}, query: {tool_id: toolId, email_on_completion: emailOnFinished, name: runName ?? undefined}});
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
        <FormControl
              pb={4}
              key={"CPG_PORTAL_RUN_NAME"}
              isInvalid={errors["CPG_PORTAL_RUN_NAME"] !== undefined}
              isDisabled={isDisabled}
            >
               <FormLabel fontSize={"md"} htmlFor={"CPG_PORTAL_RUN_NAME"} mb={0}>
                NAME
              </FormLabel>
              <Text fontSize="sm" color={'gray.500'} mb={2} >Enter a name for the run (optional)</Text>
              <Input id={"CPG_PORTAL_RUN_NAME"} onChange={(e) => setRunName(e.target.value)} />
            {errors["CPG_PORTAL_RUN_NAME"] && (
              <FormErrorMessage>
                {errors["CPG_PORTAL_RUN_NAME"]?.message as React.ReactNode}
              </FormErrorMessage>
            )}
        </FormControl>
        {normalizedParams?.map((param: Param) => (
          <FormControl
            pb={4}
            key={param.name}
            isRequired={param.required}
            isInvalid={errors[param.name] !== undefined}
            isDisabled={isDisabled}
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
            {param.param_type === "file" && (
            <FileParam
              setIsLoading={setIsLoading}
              isDisabled={isDisabled}
              param={param}
              setValue={(selected) => {
                if (Array.isArray(selected) || !param.multiple) {
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
              multiple={param.multiple ?? false}
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
      <Heading size="md" my={4}>
        Run Tool
      </Heading>
      <Flex gap={2} justify={"space-between"} direction={{base: "column-reverse", md: "row"}} >
        <ButtonGroup isDisabled={isDisabled}>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Submit
          </Button>
          <Button onClick={() => {reset(defaultValues); setFileStates({})}} variant="outline">
            Reset
          </Button>
        </ButtonGroup>
        <TagInput tags={tags} setTags={setTags} isDisabled={isDisabled} />
      </Flex>
      <Flex mt={4}>
        <EmailOnFinished emailOnFinished={emailOnFinished} setEmailOnFinished={setEmailOnFinished} isDisabled={isDisabled} />
      </Flex>
    </Box>
  )
}

export default RunToolForm
