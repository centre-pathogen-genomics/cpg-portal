import React, { useState } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { RiRobot2Line } from "react-icons/ri";

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { generateRunSummaryMutation } from "../../client/@tanstack/react-query.gen";
import useCustomToast from "../../hooks/useCustomToast";

interface GenerateSummaryDialogProps {
  runId: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: (data: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const GenerateSummaryDialog = ({
  runId,
  isOpen,
  onClose,
  onGenerated,
  isLoading,
  setIsLoading,
}: GenerateSummaryDialogProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);

  // Setup react-hook-form
  const { handleSubmit, formState: { isSubmitting } } = useForm();

  // Set up our mutation with success and error handlers.
  const mutation = useMutation({
    ...generateRunSummaryMutation(),
    onSuccess: (data) => {
      if (onGenerated) onGenerated(data);
      onClose();
    },
    onError: () => {
      showToast(
        "Error",
        "An error occurred while generating the summary. Please try again later.",
        "error"
      );
    },
    onSettled: () => {
      // Invalidate any queries that may be related to the run data
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });

  // Use mutateAsync to await the mutation resolution.
  const onSubmit = async () => {
    console.log("Generating AI Summary for run", runId);
    setIsLoading(true);
    try {
      await mutation.mutateAsync({ path: { run_id: runId } });
    } catch (error) {
      // Error handling is already performed in the mutation's onError
    } finally {
      setIsLoading(false);
      console.log("Generated AI Summary for run", runId);
    }
  };

  // onError handler for react-hook-form validations
  const onErrorHandler = () => {
    showToast("Form Error", "There was an error with the form submission.", "error");
  };

  // Compute a loading flag based on both form submission and our custom loading state.
  const loading = isSubmitting || isLoading; 

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <AlertDialogOverlay>
        {/* Attach the form handler with both success and error callbacks */}
        <AlertDialogContent as="form" onSubmit={handleSubmit(onSubmit, onErrorHandler)}>
          <AlertDialogHeader>
            Generate AI Summary for Run {runId}?
          </AlertDialogHeader>
          <AlertDialogBody>
            Are you sure you want to generate an AI-powered summary for this run? Your data will be sent to Google servers.
          </AlertDialogBody>
          <AlertDialogFooter gap={3}>
            {/* The Generate button shows a loading spinner and is disabled while loading */}
            <Button variant="solid" colorScheme="blue" type="submit" isLoading={loading}>
              Generate
            </Button>
            {/* The Cancel button is also disabled while loading */}
            <Button ref={cancelRef} onClick={onClose} isDisabled={loading}>
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

interface GenerateAISummaryProps {
  runId: string;
  onGenerated?: (data: string) => void;
}

const GenerateAISummary = ({ runId, onGenerated }: GenerateAISummaryProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <>
      <Button
        onClick={onOpen}
        aria-label="Generate LLM Summary"
        rightIcon={<RiRobot2Line fontSize="24px" />}
        _hover={{ color: "ui.main" }}
        variant="ghost"
        isLoading={isLoading}
      >
        AI Summary
      </Button>
      <GenerateSummaryDialog
        runId={runId}
        isOpen={isOpen}
        onClose={onClose}
        onGenerated={onGenerated}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
    </>
  );
};

export default GenerateAISummary;
