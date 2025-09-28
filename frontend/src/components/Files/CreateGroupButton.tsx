import { useState } from "react"
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createGroupMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface CreateGroupButtonProps {
  selectedFileIds: string[]
  onGroupCreated?: () => void
  size?: "xs" | "sm" | "md" | "lg"
  variant?: string
  colorScheme?: string
}

export default function CreateGroupButton({
  selectedFileIds,
  onGroupCreated,
  size = "md",
  variant = "solid",
  colorScheme = "blue",
}: CreateGroupButtonProps) {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupName, setGroupName] = useState("")
  const { isOpen, onOpen, onClose } = useDisclosure()

  const createGroup = useMutation({
    ...createGroupMutation(),
    onSuccess: () => {
      showToast("Success", "Group created successfully.", "success")
      setGroupName("")
      setGroupError(null)
      onClose()
      queryClient.invalidateQueries({ queryKey: ["files"] })
      onGroupCreated?.()
    },
    onError: (error: any) => {
        console.error("Failed to create group:", error)
        const errorMessage = error?.response.data.detail || "An error occurred while creating the group."
        setGroupError(errorMessage)
        showToast("Error", errorMessage, "error")

    },
  })

  const handleCreateGroup = () => {
    setGroupError(null)
    if (!groupName.trim()) {
      setGroupError("Group name is required")
      return
    }
    createGroup.mutate({
      body: selectedFileIds,
      query: { name: groupName.trim() }
    })
  }

  const handleOpenModal = () => {
    setGroupName("")
    setGroupError(null)
    onOpen()
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        colorScheme={colorScheme}
        onClick={handleOpenModal}
        isDisabled={selectedFileIds.length === 0}
      >
        {selectedFileIds.length ? `Create Group (${selectedFileIds.length})` : "Select to Group"}
      </Button>

      {/* Create Group Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create File Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Enter a name for the group of {selectedFileIds.length} files:
            </Text>
            <Input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateGroup()
                }
              }}
            />
            {groupError && (
              <Text color="red.500" mt={2} fontSize="sm">
                {groupError}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleCreateGroup} 
              isLoading={createGroup.isPending}
              disabled={!groupName.trim()}
            >
              Create Group
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
