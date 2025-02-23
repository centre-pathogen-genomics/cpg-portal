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
import { useEffect, useRef, useState } from 'react';



interface OutputAccordionItemProps {
    title: string;
    status: string;
    content: string | null;
    }

const OutputAccordionItem = ({ title, content, status }: OutputAccordionItemProps) => {
  const lineCount = content?.trim().split('\n').length || 0;

  return (
    <AccordionItem>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <Flex alignItems="center" align={'center'}>
              <Icon as={HiOutlineDocumentText}  /> 
              <Text mx={2}>{title}</Text>
              {lineCount == 0 && (status === 'running' || status === 'pending') ? (
                <Spinner size={'sm'} speed={'0.8s'} />
              ) : (
                <Badge borderRadius="full"px="2" colorScheme="purple">
                  {lineCount}
                </Badge>
                )
              }
            </Flex>
          </Box>
          <AccordionIcon />
        </AccordionButton>
      <AccordionPanel pb={4}>
        {content && lineCount> 0 ? (
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
  // Create a ref to hold the WebSocket instance.
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  // Function to connect (or reconnect) the WebSocket.
  const connectWebSocket = () => {
    // check if websocket is already connected
    if (isConnected) {
      return
    }
    // Close existing connection if any.
    if (wsRef.current) {
      wsRef.current.close();
    }
  
    const token = localStorage.getItem("access_token"); // Retrieve your token
    const baseURL = import.meta.env.VITE_API_URL;
    // Attach token as a query parameter
    const wsUrl = baseURL.replace('http', 'ws') + `/api/v1/websockets/logs/${run.id}` + `?token=${token}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
  
    ws.onopen = () => {
      setIsConnected(true);
    };
  
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message:", data);
        if (data.log) {
          setOutput((prevOutput) => (prevOutput || '') + data.log + '\n');
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };
  
    ws.onerror = () => {
      setIsConnected(false);
    };
  
    ws.onclose = () => {
      setIsConnected(false);
    };
  };
  
  // Connect on mount and clean up on unmount.
  useEffect(() => {
    setOutput(run.stdout || null);
    if (run.status === 'running' || run.status === 'pending') {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <Accordion allowMultiple mb={4} wordBreak="break-all">
      <OutputAccordionItem
        title="Tool Output"
        content={output}
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
