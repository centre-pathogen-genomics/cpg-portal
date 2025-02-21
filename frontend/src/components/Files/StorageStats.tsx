import { Box, Heading, HStack, Progress, Stack, Text } from '@chakra-ui/react'
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getFilesStatsOptions, readUserMeQueryKey } from '../../client/@tanstack/react-query.gen';
import { humanReadableFileSize } from '../../utils';
import { UserPublic } from '../../client';

interface StorageStatsProps {
  size?: string
}

const StorageStats = ({size = 'sm'}: StorageStatsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(readUserMeQueryKey())
  const {data} = useQuery({
    ...getFilesStatsOptions(),
    refetchInterval: 30000
  })

  let percentageUsed = 0  
  if (data && currentUser?.max_storage) {
        percentageUsed = (data.total_size / currentUser.max_storage) * 100
        percentageUsed = Math.round(percentageUsed)
    }
  return (
    <Box >
        <Stack spacing='2'>
            <HStack spacing='1'>
                <Heading size={size}>Storage</Heading>
            </HStack>
            <Stack spacing='1'>
            <Progress
                value={percentageUsed}
                size={size}
                backgroundColor={"gray.200"}
            />
            <Text fontSize="sm" colorScheme='gray'>
            
                {data ? `${humanReadableFileSize(data.total_size)}` : "0b"} used ({data ? data.count : 0}/{currentUser ? currentUser.max_storage_files : 1000} files)
            </Text>
            </Stack>
        </Stack>
    </Box>
  )
}

export default StorageStats