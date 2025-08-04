import {
  Button,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Switch,
  FormControl,
  FormLabel,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FiShare2 } from "react-icons/fi";

import { type RunPublic } from "../../client";
import { toggleRunSharingMutation } from "../../client/@tanstack/react-query.gen";
import useCustomToast from "../../hooks/useCustomToast";

interface ShareRunButtonProps {
  run: RunPublic;
}

function ShareRunButton({ run }: ShareRunButtonProps) {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isShared, setIsShared] = useState(run.shared || false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const mutation = useMutation({
    ...toggleRunSharingMutation(),
    onSuccess: () => {
      showToast("Success!", `Run sharing ${isShared ? "enabled" : "disabled"} successfully.`, "success");
      queryClient.invalidateQueries({
        queryKey: [{ _id: "readRun" }],
      });
      onClose();
    },
    onError: (err: any) => {
      const errDetail = (err.body as any)?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
  });

  const onConfirm = async () => {
    mutation.mutate({
      path: { id: run.id },
      query: { shared: isShared },
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<FiShare2 />}
        colorScheme={run.shared ? "green" : "gray"}
        onClick={onOpen}
      >
        {run.shared ? "Shared" : "Share"}
      </Button>

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Share Run
            </AlertDialogHeader>

            <AlertDialogBody>
              <VStack spacing={4} align="stretch">
                <Text>
                  Configure sharing settings for this run. When shared, other users with this url will be able to view the run results.
                </Text>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="share-toggle" mb="0">
                    Enable sharing
                  </FormLabel>
                  <Switch
                    id="share-toggle"
                    isChecked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    colorScheme="green"
                  />
                </FormControl>

                {isShared && (
                  <Text fontSize="sm" color="orange.500">
                    ⚠️ When sharing is enabled, any user with the run link can view the results.
                  </Text>
                )}
              </VStack>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme={isShared ? "green" : "red"}
                onClick={onConfirm}
                ml={3}
                isLoading={mutation.isPending}
              >
                Confirm
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

export default ShareRunButton;
