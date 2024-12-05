import { useState } from 'react';
import { Box, IconButton, useToast, Flex, useColorModeValue } from '@chakra-ui/react';
import { IoIosCopy, IoIosCheckmarkCircleOutline } from 'react-icons/io';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs2015, githubGist } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { CopyToClipboard } from 'react-copy-to-clipboard';

interface CodeBlockProps {
    code: string;
    language: string;
    lineNumbers?: boolean;
    maxHeight?: string;
}

const CodeBlock = ({ code, language, lineNumbers, maxHeight }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const style = useColorModeValue(githubGist, vs2015)
  const copyBg = useColorModeValue('white', 'gray.700');

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

  return (
    <Box position="relative" borderWidth="1px" borderRadius="md" overflow="hidden">
      <Flex
        position="absolute"
        top="0"
        right="0"
        p={1}
        align="center"
        background={copyBg}
        zIndex="1"
        borderBottomLeftRadius="md"
      >
        {/* <Text fontSize="xs" mr={1} color="white">
          {language}
        </Text> */}
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
      </Flex>
      <SyntaxHighlighter
        customStyle={{ maxHeight: maxHeight }}
        language={language}
        style={style}
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={lineNumbers}
      >
        {code}
      </SyntaxHighlighter>
    </Box>
  );
};

export default CodeBlock;
