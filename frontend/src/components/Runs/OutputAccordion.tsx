import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Flex,
  Text,
  Spinner,
  Icon,
} from '@chakra-ui/react';
import { RunPublic } from '../../client';
import CodeBlock from '../Common/CodeBlock';
import Markdown from '../Common/Markdown';
import { HiOutlineDocumentText } from 'react-icons/hi';
import { HiOutlineCommandLine } from 'react-icons/hi2';
import { HiQuestionMarkCircle } from "react-icons/hi";

import { SiAnaconda } from 'react-icons/si';
import { useState } from 'react';
import useWebSocket from '../../hooks/useWebsocket';

interface OutputAccordionItemProps {
  title: string;
  status: string;
  content: string | null;
  runId: string;
}

const OutputAccordionItem = ({ title, content, status, runId }: OutputAccordionItemProps) => {
  const [output, setOutput] = useState<string | null>(content || null);
  const lineCount = output?.trim().split('\n').length || 0;

  // Connect to the logs channel using the run ID.
  useWebSocket(`logs/${runId}`, {
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.log) {
          setOutput((prev) => [prev, data.log].filter(Boolean).join('\n'));
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    },
  });

  return (
    <AccordionItem>
      <AccordionButton>
        <Box as="span" flex="1" textAlign="left">
          <Flex alignItems="center">
            <Icon as={HiOutlineDocumentText} />
            <Text mx={2}>{title}</Text>
            {(status === 'running' || status === 'pending') && (
              <Spinner size="sm" speed="0.8s" />
            )}
          </Flex>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        {lineCount > 0 ? (
          <CodeBlock code={output || ''} language="text" lineNumbers={true} follow={true} maxHeight='500px' />
        ) : status === 'running' || status === 'pending' ? (
          <Text>Running...</Text>
        ) : (
          <Text>No output</Text>
        )}
      </AccordionPanel>
    </AccordionItem>
  );
};

const OutputAccordion = ({ run }: { run: RunPublic }) => {
  

  return (
    <Accordion allowMultiple mb={4} wordBreak="break-all">
      {run.tool.explanation_of_results_markdown && (
      <AccordionItem>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center">
              <Icon as={HiQuestionMarkCircle} />
              <Text ml={2}>Explanation of Results</Text>
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={4}>
          <Markdown markdown={run.tool.explanation_of_results_markdown} /> 
        </AccordionPanel>
      </AccordionItem>
      )}
      <OutputAccordionItem title="Tool Logs" content={run.stdout || null} status={run.status} runId={run.id} />
      <AccordionItem>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center">
              <Icon as={HiOutlineCommandLine} />
              <Text ml={2}>Command</Text>
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={4}>
          <CodeBlock
            code={run.command ?? "This shouldn't happen..."}
            language="bash"
            lineNumbers={false}
          />
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center">
              <Icon as={SiAnaconda} />
              <Text ml={2}>Environment</Text>
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={4}>
          {run.conda_env_pinned ? (
            <CodeBlock code={run.conda_env_pinned} language="yaml" lineNumbers={false} />
          ) : (
            <Text>No environment</Text>
          )}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};

export default OutputAccordion;
