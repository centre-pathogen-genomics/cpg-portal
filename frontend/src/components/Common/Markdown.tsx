import ReactMarkdown from 'react-markdown';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import remarkGfm from 'remark-gfm';


function RenderMarkdown({ markdown }: { markdown: string }) {
  return <ReactMarkdown components={ChakraUIRenderer()} children={markdown} skipHtml remarkPlugins={[remarkGfm]} />
}

export default RenderMarkdown;