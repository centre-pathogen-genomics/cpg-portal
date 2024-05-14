import {
  Button,
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
} from "@chakra-ui/react";
import { Select } from "chakra-react-select";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, SubmitHandler } from "react-hook-form";

import { WorkflowsService, type Param, type TDataRunWorkflow } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface RunWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: number;
}

const RunWorkflow = ({ isOpen, onClose, workflowId }: RunWorkflowProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const { data: params, isLoading } = useQuery({
    queryKey: ["workflowParams", workflowId],
    queryFn: () => 
      WorkflowsService.readWorkflowParams({ workflowId })
  });

  // Initialize default values
  const defaultValues = params?.reduce((acc, param) => {
    acc[param.name] = param.default;
    return acc;
  }, {});

  // Form initialization with default values
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues,
  });

  // Reset the form with initial values on params change
  
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => WorkflowsService.runWorkflow({
      requestBody: data,
      workflowId
    }),
    onSuccess: (task) => {
      showToast("Success!", `Workflow run successfully. Task ID: ${task.id}`, "success");
      onClose();
    },
    onError: (error) => {
      showToast("Error", error.message, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowRuns']});
    },
  });

  const onSubmit: SubmitHandler<any> = (formData) => {
    mutation.mutate({ ...formData });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Configure Workflow</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {params?.map((param: Param) => (
              <FormControl key={param.id} isRequired={param.required} isInvalid={errors[param.name]}>
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
                {param.param_type === "enum" && (
                <Select
                  id={param.name}
                  options={param.options?.map((option) => ({
                    label: option, // Assuming that the label is the same as the value
                    value: option,
                  }))}
                  placeholder={param.description || "Select an option"}
                  defaultValue={param.default ? { label: param.default, value: param.default } : undefined}
                  isMulti={false} // Set true if multiple selections are allowed
                  onChange={(selectedOption) => register(param.name, {
                    required: param.required ? "Required" : false,
                    value: selectedOption ? selectedOption.value : ""
                  })}
                  selectedOptionStyle="check" // Optional: customize the selected option style
                />
              )}

                {errors[param.name] && <FormErrorMessage>{errors[param.name].message}</FormErrorMessage>}
              </FormControl>
            ))}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Start Workflow
            </Button>
            <Button onClick={onClose} variant='outline'>Cancel</Button>
            <Button onClick={() => reset(defaultValues)}>Reset</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default RunWorkflow;
