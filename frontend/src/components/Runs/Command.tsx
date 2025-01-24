import { Flex, Icon, Text, VStack } from "@chakra-ui/react";
import { HiOutlineCommandLine } from "react-icons/hi2";
import CodeBlock from "../Common/CodeBlock";

function Command({ command }: { command: string }) {
  return (
    <Flex direction={"column"} mb={4}>
        <Flex w={32} direction={"column"} mb={2}>
          <Flex align={"center"}>
            <Icon as={HiOutlineCommandLine} />
            <Text ml={2}>Command</Text>
          </Flex>
        </Flex>
        <CodeBlock code={command} language="bash" />
    </Flex>
  );
}

export default Command;
