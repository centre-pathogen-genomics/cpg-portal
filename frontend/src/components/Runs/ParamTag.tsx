import { Tag, TagLabel, Tooltip, Text } from "@chakra-ui/react";
 
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

const ParamTag = ( {param, value, truncate}: ParamTagProps) => {
    // truncate value if it is too long to fit in the badge
    if (typeof value === 'string') {
        value = extractUUIDAndOtherText(value);
    } else if (Array.isArray(value) && value.length > 0) {
        value = value.map((v) => extractUUIDAndOtherText(v));
    }
    value = JSON.stringify(value);
    let subString = (value as string);
    if (subString.length > 20 && truncate) {
        subString = subString.substring(0, 20) + "...";
    } 

  return (
    <Tooltip
        placement="top"
        hasArrow
        label={value as string}
    >
        <Tag  cursor={'pointer'} size={'sm'} variant='outline' >
        <TagLabel mr={1} as={'b'}>{param}</TagLabel><Text wordBreak={"break-all"}>{subString}</Text>
        </Tag>
    </Tooltip>
  )
}

export default ParamTag;