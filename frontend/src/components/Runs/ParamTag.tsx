import { Tooltip, Text, Flex, useColorModeValue } from "@chakra-ui/react";
 
interface ParamTagProps {
  param: string;
  value: unknown;
  truncate?: boolean;
}


const extractUUIDAndOtherText = (value: string | string[]): string => {
  const uuidv4Pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}_/i;
  if (!Array.isArray(value)) {
    value = [value];
  }
  const text = [];
  for (let i = 0; i < value.length; i++) {
    const match = value[i].match(uuidv4Pattern);
    if (match) {
        const uuid = match[0]; // Extract the matched UUID
        const otherText = value[i].substring(uuid.length).trim(); // Extract the text after the UUID
        text.push(otherText);
    }
    
  }
  if (text.length === 0) {
    return value.join(', ');
  } else
  if (text.length === 1) {
    return text[0];
  }
  return `Group(${text.join(', ')})`; // Groups
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


  const bg = useColorModeValue('gray.100', 'whiteAlpha.200')
  const color = useColorModeValue('ui.main', 'ui.light')


  return (
    <Tooltip
        placement="top"
        hasArrow
        label={value as string}
    >
        <Flex fontSize={'sm'} cursor={'pointer'} overflow={'hidden'} borderWidth={2} borderColor={bg} borderRadius='md'  >
          <Flex h={'full'} color={color} bg={bg} px={1}><Text as={'b'}>{param}</Text></Flex>
          <Flex whiteSpace={'nowrap'}  px={1} maxW={40} overflow={'hidden'} >
            <Text isTruncated>{value as string}</Text>
          </Flex>
        </Flex>
    </Tooltip>
  )
}

export default ParamTag;