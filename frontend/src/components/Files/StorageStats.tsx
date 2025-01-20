import { Box, Heading, HStack, Progress, Stack, Text } from '@chakra-ui/react'
import { useQuery } from "@tanstack/react-query"
import { HiOutlineCloud } from "react-icons/hi";
import { getFilesStatsOptions } from '../../client/@tanstack/react-query.gen';
import { humanReadableFileSize } from '../../utils';

const StorageStats = () => {
  const {data} = useQuery({
    ...getFilesStatsOptions(),
    refetchInterval: 30000
  })

  let percentageUsed = 0  
  if (data) {
        percentageUsed = (data.total_size / 10000000000) * 100
        percentageUsed = Math.round(percentageUsed) + 1 // add 1 to make it look like it's actually being used
    }
  return (
    <Box >
        <Stack spacing='2'>
            <HStack spacing='1'>
                <HiOutlineCloud/><Heading size='xs'>Storage</Heading>
            </HStack>
            <Stack spacing='1'>
            <Progress
                value={percentageUsed}
                size='sm'
                backgroundColor={"gray.200"}
            />
            <Text fontSize="sm" colorScheme='gray'>
            
                {data ? `${humanReadableFileSize(data.total_size)}` : "0b"} used ({data ? data.count : 0} files)
            </Text>
            </Stack>
        </Stack>
    </Box>
  )
}

export default StorageStats