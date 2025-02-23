import { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  useToast,
  useColorModeValue,
  Button,
} from '@chakra-ui/react';
import { IoIosCopy, IoIosCheckmarkCircleOutline } from 'react-icons/io';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs2015, githubGist } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { CopyToClipboard } from 'react-copy-to-clipboard';

interface CodeBlockProps {
  code: string;
  language: string;
  lineNumbers?: boolean;
  maxHeight?: string;
  follow?: boolean; // If true, enable follow (auto-scroll) behavior.
}

const CodeBlock = ({
  code,
  language,
  lineNumbers,
  maxHeight,
  follow = false,
}: CodeBlockProps) => {
  // Copy-to-clipboard logic
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const style = useColorModeValue(githubGist, vs2015);

  const notify = () => {
    toast({
      description: 'Copied to clipboard!',
      status: 'success',
      duration: 5000,
      isClosable: true,
      position: 'bottom-right',
    });
    handleCopy();
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 5000);
  };

  // Follow (auto-scroll) logic
  const [isFollowing, setIsFollowing] = useState(follow);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new code arrives if follow mode is enabled.
  useEffect(() => {
    if (follow && isFollowing && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [code, isFollowing, follow]);

  // Update follow state based on scrolling.
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (follow) {
      setIsFollowing(atBottom);
    }
  };

  return (
    <Box position="relative" borderWidth="1px" borderRadius="md">
      {/* Floating copy button in the top right */}
      <Box position="absolute" top="6px" right="6px" zIndex="3">
        <CopyToClipboard text={code} onCopy={notify}>
          <IconButton
            icon={
              copied ? (
                <IoIosCheckmarkCircleOutline color="green" />
              ) : (
                <IoIosCopy color="grey" />
              )
            }
            aria-label="Copy to clipboard"
            size="sm"
            variant="ghost"
            colorScheme={copied ? 'green' : 'whiteAlpha'}
          />
        </CopyToClipboard>
      </Box>
      {/* Scrollable container for the code */}
      <Box
        ref={scrollContainerRef}
        onScroll={follow ? handleScroll : undefined}
        maxHeight={maxHeight}
        overflowY="auto"
      >
        <SyntaxHighlighter
          language={language}
          style={style}
          wrapLines={true}
          wrapLongLines={true}
          showLineNumbers={lineNumbers}
          customStyle={{ padding: '16px', margin: 0 }}
        >
          {code}
        </SyntaxHighlighter>
      </Box>
      {/* "Follow" button only appears if the follow prop is enabled */}
      {follow && !isFollowing && (
        <Button
          position="absolute"
          bottom="16px"
          right="16px"
          onClick={() => setIsFollowing(true)}
          colorScheme="blue"
        >
          Follow
        </Button>
      )}
    </Box>
  );
};

export default CodeBlock;
