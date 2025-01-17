import { Box, Card, CardBody, CardHeader, Flex, Heading, HStack, Progress, Stack, Text } from '@chakra-ui/react'
import { useQuery } from "@tanstack/react-query"
import type { FilesStatistics } from "../../client"
import { FilesService } from "../../client"
import { HiOutlineCloud } from "react-icons/hi";

const StorageStats = () => {
  const {data} = useQuery<FilesStatistics>({
    queryKey: ["filesStatistics"],
    queryFn: () => FilesService.getFilesStats(),
    staleTime: 30000,
  })

  let percentageUsed = 0  
  if (data) {
        percentageUsed = (data.total_size / 10000000000) * 100
        percentageUsed = Math.round(percentageUsed) + 1 // add 1 to make it look like it's actually being used
    }
    console.log(percentageUsed)

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
                {data ? `${data.total_size}b` : "0b"} used ({data ? data.count : 0} files)
            </Text>
            </Stack>
        </Stack>
    </Box>
  )
}

export default StorageStats