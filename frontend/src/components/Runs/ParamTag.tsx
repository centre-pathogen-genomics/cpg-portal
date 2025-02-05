import { Tag, TagLabel, Tooltip, Text, Flex, useColorModeValue } from "@chakra-ui/react";
 
interface ParamTagProps {
  param: string;
  value: unknown;
  truncate?: boolean;
}


const extractUUIDAndOtherText = (value: string): string => {
  const uuidv4Pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}_/i;

  const match = value.match(uuidv4Pattern);

  if (match) {
      const uuid = match[0]; // Extract the matched UUID
      const otherText = value.substring(uuid.length).trim(); // Extract the text after the UUID
      return otherText
  }

  return value; // If no UUID is found, treat the whole string as otherText
};

const ParamTag = ( {param, value}: ParamTagProps) => {
  if (typeof value === 'string') {
      value = extractUUIDAndOtherText(value);
  } else if (Array.isArray(value) && value.length > 0) {
      value = value.map((v) => extractUUIDAndOtherText(v)).join(', ');
  } else if (typeof value === 'boolean') {
    if (value) {
      value = 'true';
    } else {
      value = 'false';
    }
  }

  return (
    <Tooltip
        placement="top"
        hasArrow
        label={value as string}
    >
        <Flex fontSize={'sm'} cursor={'pointer'} borderWidth={2} borderColor={'ui.main'} borderRadius='md'  >
          <Flex h={'full'} color={'ui.light'} bg={'ui.main'} px={1}><Text as='b'>{param}</Text></Flex>
          <Flex whiteSpace={'nowrap'} bg={'transparent'} px={1} maxW={60} overflow={'hidden'} >
            <Text isTruncated>{value as string}</Text>
          </Flex>
        </Flex>
    </Tooltip>
  )
}

export default ParamTag;