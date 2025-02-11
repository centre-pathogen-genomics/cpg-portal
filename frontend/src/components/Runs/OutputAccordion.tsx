import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Flex,
  Text,
  Badge,
  Spinner,
  Icon,
} from '@chakra-ui/react';
import { RunPublic } from '../../client';
import CodeBlock from '../Common/CodeBlock';
import {SiAnaconda} from 'react-icons/si';
import { HiOutlineCommandLine } from "react-icons/hi2";
import { HiOutlineDocumentText } from "react-icons/hi";


interface OutputAccordionItemProps {
    title: string;
    status: string;
    content: string | null;
    }

const OutputAccordionItem = ({ title, content, status }: OutputAccordionItemProps) => {
  const lineCount = content?.trim().split('\n').length || 0;

  return (
    <AccordionItem isDisabled={status === 'running' || status === 'pending' }>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center" align={'center'}>
              <Icon as={HiOutlineDocumentText}  /> 
              <Text mx={2}>{title}</Text>
              {status === 'running' || status === 'pending' ? (
                <Spinner size={'sm'} speed={'0.8s'} />
              ) : (
                content && content.length > 0 && (<Badge borderRadius="full"px="2" colorScheme="purple">
                  {lineCount}
                </Badge>)
              )}
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
      <AccordionPanel pb={4}>
        {content && content.length > 0 ? (
          <CodeBlock code={content} language={'text'} lineNumbers={true}/>
          // <Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
        ) : status === 'running' || status === 'pending' ? (
          <Text>Running...</Text>
        ) : (
          <Text>No output</Text>
        )}
      </AccordionPanel>
    </AccordionItem>
  );
};



const OutputAccordion = ({run}: {run: RunPublic}) => {
  return (
    <Accordion allowMultiple mb={4} wordBreak="break-all">
      <OutputAccordionItem
        title="Tool Output"
        content={run.stdout || null}
        status={run.status}
      />
      <AccordionItem>
          <AccordionButton>
            <Box as="span" flex="1" textAlign="left">
              <Flex alignItems="center" align={'center'}>
                <Icon as={HiOutlineCommandLine}  />
                <Text ml={2}>Command</Text>
              </Flex>
            </Box>
            <AccordionIcon />
          </AccordionButton>
        <AccordionPanel pb={4}>
          <CodeBlock code={run.command ?? "This shouldn't happen..."} language={'bash'} lineNumbers={false}/>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem>
          <AccordionButton>
            <Box as="span" flex="1" textAlign="left">
              <Flex alignItems="center" align={'center'}>
                <Icon as={SiAnaconda}  />
                <Text ml={2}>Environment</Text>
              </Flex>
            </Box>
            <AccordionIcon />
          </AccordionButton>
        <AccordionPanel pb={4}>
          {run.conda_env_pinned ? <CodeBlock code={run.conda_env_pinned} language={'yaml'} lineNumbers={false}/> : <Text>No environment</Text>}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
    
  );
};

export default OutputAccordion;
