import {
  Button,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"
import { Select } from "chakra-react-select"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { FilesService, type Param, WorkflowsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import React from "react"

interface RunWorkflowProps {
  isOpen: boolean
  onClose: () => void
  workflowId: string
}

const RunWorkflow = ({ isOpen, onClose, workflowId }: RunWorkflowProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const { data: params, isLoading } = useQuery({
    queryKey: ["workflowParams", workflowId],
    queryFn: () => WorkflowsService.readWorkflowParams({ workflowId }),
  })

  const { data: files } = useQuery({
    queryKey: ["files"],
    queryFn: () =>
      FilesService.readFiles().then((data) =>
        data.data.map((file) => ({ label: file.name, value: file.id })),
      ),
  })

  // Initialize default values
  const defaultValues = params?.reduce((acc, param) => {
    acc[param.name] = param.default
    return acc
  }, {} as Record<string, any>) ?? {}

  
  interface FormData {
    [key: string]: any;
  }

  // Form initialization with default values
  const {
    register,
    handleSubmit,
    reset,
    setValue, // Add setValue here
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues,
  })

  // Reset the form with initial values on params change
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      WorkflowsService.runWorkflow({
        requestBody: data,
        workflowId,
      }),
    onSuccess: (task) => {
      showToast(
        "Success!",
        `Workflow run successfully.\nTask ID: ${task.id}`,
        "success",
      )
      onClose()
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

  if (isLoading) return <div>Loading...</div>

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Configure Workflow</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {params?.map((param: Param) => (
              <FormControl
                key={param.id}
                isRequired={param.required}
                isInvalid={errors[param.name] !==  undefined}
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
                      label: option, // Assuming that the label is the same as the value
                      value: option,
                    }))}
                    placeholder={param.description || "Select an option"}
                    defaultValue={
                      param.default
                        ? { label: param.default, value: param.default }
                        : undefined
                    }
                    isMulti={false} // Set true if multiple selections are allowed
                    onChange={(selectedOption) => {
                      setValue(
                        param.name,
                        selectedOption ? selectedOption.value : "",
                      ) // Update setValue
                    }}
                    selectedOptionStyle="check" // Optional: customize the selected option style
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
                  <Select // File input is a select with multiple selections
                    id={param.name}
                    options={files}
                    placeholder={param.description || "Select a file"}
                    isMulti={false}
                    onChange={(selectedOption) => {
                      setValue(
                        param.name,
                        selectedOption ? selectedOption.value : "",
                      ) // Update setValue
                    }}
                    selectedOptionStyle="check" // Optional: customize the selected option style
                  />
                )}

                {errors[param.name] && (
                  <FormErrorMessage>
                    {errors[param.name]?.message as React.ReactNode}
                  </FormErrorMessage>
                )}
              </FormControl>
            ))}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Start Workflow
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={() => reset(defaultValues)}>Reset</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default RunWorkflow
