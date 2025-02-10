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
} from '@chakra-ui/react';
import { RunPublic } from '../../client';
import CodeBlock from '../Common/CodeBlock';

interface OutputAccordionItemProps {
    title: string;
    status: string;
    content: string | null;
    }

const OutputAccordionItem = ({ title, content, status }: OutputAccordionItemProps) => {
  const lineCount = content?.trim().split('\n').length || 0;

  return (
    <AccordionItem isDisabled={status === 'running' || status === 'pending' }>
      <h2>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center" align={'center'}>
              <Text mr={2}>{title}</Text>
              {status === 'running' || status === 'pending' ? (
                <Spinner size={'sm'} speed={'0.8s'} />
              ) : (
                <Badge borderRadius="full"px="2" colorScheme="purple">
                  {lineCount}
                </Badge>
              )}
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </h2>
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
        title="Stdout"
        content={run.stdout || null}
        status={run.status}
      />
      <OutputAccordionItem
        title="Stderr"
        content={run.stderr || null}
        status={run.status}
      />
    </Accordion>
  );
};

export default OutputAccordion;
