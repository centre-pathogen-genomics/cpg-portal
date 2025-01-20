import { Tag, TagLabel, Tooltip } from "@chakra-ui/react";
 
interface ParamTagProps {
  param: string;
  value: string;
  truncate?: boolean;
}

const ParamTag = ( {param, value, truncate}: ParamTagProps) => {
    // truncate value if it is too long to fit in the badge
    let subString = value
    if (subString.length > 20 && truncate) {
        subString = subString.substring(0, 20) + "...";
    } 

  return (
    <Tooltip
        placement="top"
        hasArrow
        label={value}
    >
        <Tag  cursor={'pointer'} size={'sm'} variant='outline' >
        <TagLabel as={'b'}>{param}</TagLabel>={subString}
        </Tag>
    </Tooltip>
  )
}

export default ParamTag;