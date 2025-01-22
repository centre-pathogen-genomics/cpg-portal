import { Tag, TagLabel, Tooltip } from "@chakra-ui/react";
 
interface ParamTagProps {
  param: string;
  value: unknown;
  truncate?: boolean;
}

const ParamTag = ( {param, value, truncate}: ParamTagProps) => {
    // truncate value if it is too long to fit in the badge
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
        <TagLabel mr={1} as={'b'}>{param}</TagLabel> {subString}
        </Tag>
    </Tooltip>
  )
}

export default ParamTag;