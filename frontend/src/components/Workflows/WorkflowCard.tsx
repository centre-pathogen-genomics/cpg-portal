import { Card, CardHeader, CardBody, CardFooter, Text, Button, ButtonGroup, Heading } from "@chakra-ui/react"
import { FaPlay } from "react-icons/fa";
import { useDisclosure } from "@chakra-ui/react";

import RunWorkflow from './RunWorkflow'; // Adjust the import path as needed
import { type WorkflowPublic } from "../../client";

interface WorkflowCardProps {
  workflow: WorkflowPublic;
}

const WorkflowCard = ({ workflow }: WorkflowCardProps) => {
    const runWorkflowModal = useDisclosure();

    return (
        <>
            <Card variant='outline'>
                <CardHeader>
                    <Heading size='lg'>{workflow.name}</Heading>
                </CardHeader>
                <CardBody>
                    <Text>{workflow.description}</Text>
                </CardBody>
                <CardFooter>
                    <ButtonGroup spacing={4}>
                        <Button 
                            variant="primary" 
                            leftIcon={<FaPlay />} 
                            onClick={runWorkflowModal.onOpen} // Opens the modal
                        >
                            Run Workflow
                        </Button>
                    </ButtonGroup>
                </CardFooter>
            </Card>
            <RunWorkflow 
                isOpen={runWorkflowModal.isOpen} 
                onClose={runWorkflowModal.onClose} 
                workflowId={workflow.id} 
            />
        </>
    )
}

export default WorkflowCard;
