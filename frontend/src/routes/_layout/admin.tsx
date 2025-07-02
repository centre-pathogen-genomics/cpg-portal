import {
  Box,
  Container,
  Flex,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Text,
  Badge,
  Progress,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
  Skeleton,
  Alert,
  AlertIcon,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  SkeletonText,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"
import { FiUsers, FiDatabase, FiActivity, FiTool } from "react-icons/fi"

import { type UserPublic } from "../../client"
import { getSystemStatsOptions, readUsersOptions, readUserMeQueryKey } from "../../client/@tanstack/react-query.gen"
import AddUser from "../../components/Admin/AddUser"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import { PaginationFooter } from "../../components/Common/PaginationFooter.tsx"

const usersSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/admin")({
  component: AdminDashboard,
  validateSearch: (search) => usersSearchSchema.parse(search),
})

const PER_PAGE = 5

// Custom hook for fetching stats
function useStats() {
  return useQuery({
    ...getSystemStatsOptions(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
  isLoading = false,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color?: string
  isLoading?: boolean
}) {
  const cardBg = useColorModeValue("white", "gray.800")
  const borderColor = useColorModeValue("gray.200", "gray.700")

  return (
    <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
      <CardBody>
        <Flex justify="space-between" align="start">
          <Box>
            <Text fontSize="sm" color="gray.500" fontWeight="medium">
              {title}
            </Text>
            <Skeleton isLoaded={!isLoading}>
              <Text fontSize="2xl" fontWeight="bold" mt={1}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </Text>
            </Skeleton>
            {subtitle && (
              <Text fontSize="sm" color="gray.500" mt={1}>
                {subtitle}
              </Text>
            )}
          </Box>
          <Icon as={icon} boxSize={8} color={`${color}.500`} />
        </Flex>
      </CardBody>
    </Card>
  )
}

function RunStatusChart({ data, isLoading }: { data?: Record<string, number>; isLoading: boolean }) {
  if (isLoading || !data) {
    return <Skeleton height="200px" />
  }

  const total = Object.values(data).reduce((sum, count) => sum + count, 0)
  const statuses = [
    { key: "completed", label: "Completed", color: "green" },
    { key: "running", label: "Running", color: "blue" },
    { key: "pending", label: "Pending", color: "yellow" },
    { key: "failed", label: "Failed", color: "red" },
    { key: "cancelled", label: "Cancelled", color: "gray" },
  ]

  return (
    <VStack spacing={3} align="stretch">
      {statuses.map(({ key, label, color }) => {
        const count = data[key] || 0
        const percentage = total > 0 ? (count / total) * 100 : 0
        return (
          <Box key={key}>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="sm">{label}</Text>
              <Text fontSize="sm" fontWeight="bold">
                {count.toLocaleString()} ({percentage.toFixed(1)}%)
              </Text>
            </Flex>
            <Progress value={percentage} colorScheme={color} size="sm" />
          </Box>
        )
      })}
    </VStack>
  )
}

function FileTypesChart({ data, isLoading }: { data?: Record<string, number>; isLoading: boolean }) {
  if (isLoading || !data) {
    return <Skeleton height="200px" />
  }

  const total = Object.values(data).reduce((sum, count) => sum + count, 0)
  const topTypes = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <VStack spacing={3} align="stretch">
      {topTypes.map(([type, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0
        return (
          <Box key={type}>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="sm">{type.toUpperCase()}</Text>
              <Text fontSize="sm" fontWeight="bold">
                {count.toLocaleString()} ({percentage.toFixed(1)}%)
              </Text>
            </Flex>
            <Progress value={percentage} colorScheme="teal" size="sm" />
          </Box>
        )
      })}
    </VStack>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function safeToFixed(value: unknown, decimals: number = 2): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value || 0))
  return isNaN(num) ? "0" : num.toFixed(decimals)
}

function safeNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value || 0))
  return isNaN(num) ? 0 : num
}

function UsersTable() {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(readUserMeQueryKey())
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ to: ".", search: (prev: {[key: string]: string}) => ({ ...prev, page }) })

  const {
    data: users,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...readUsersOptions({query: { skip: (page - 1) * PER_PAGE, limit: PER_PAGE }}),
  })

  const hasNextPage = !isPlaceholderData && users && users.data?.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(readUsersOptions({query: { skip: (page) * PER_PAGE, limit: PER_PAGE }}))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <>
      <TableContainer>
        <Table size={{ base: "sm", md: "md" }}>
          <Thead>
            <Tr>
              <Th width="20%">Full name</Th>
              <Th width="50%">Email</Th>
              <Th width="10%">Role</Th>
              <Th width="10%">Status</Th>
              <Th width="10%">Actions</Th>
            </Tr>
          </Thead>
          {isPending ? (
            <Tbody>
              <Tr>
                {new Array(4).fill(null).map((_, index) => (
                  <Td key={index}>
                    <SkeletonText noOfLines={1} paddingBlock="16px" />
                  </Td>
                ))}
              </Tr>
            </Tbody>
          ) : (
            <Tbody>
              {users?.data?.map((user) => (
                <Tr key={user.id}>
                  <Td
                    color={!user.full_name ? "ui.dim" : "inherit"}
                    isTruncated
                    maxWidth="150px"
                  >
                    {user.full_name || "N/A"}
                    {currentUser?.id === user.id && (
                      <Badge ml="1" colorScheme="teal">
                        You
                      </Badge>
                    )}
                  </Td>
                  <Td isTruncated maxWidth="150px">
                    {user.email}
                  </Td>
                  <Td>{user.is_superuser ? "Superuser" : "User"}</Td>
                  <Td>
                    <Flex gap={2}>
                      <Box
                        w="2"
                        h="2"
                        borderRadius="50%"
                        bg={user.is_active ? "ui.success" : "ui.danger"}
                        alignSelf="center"
                      />
                      {user.is_active ? "Active" : "Inactive"}
                    </Flex>
                  </Td>
                  <Td>
                    <ActionsMenu
                      type="User"
                      value={user}
                      disabled={currentUser?.id === user.id}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          )}
        </Table>
      </TableContainer>
      <Flex justify="end" my={4}>
        <PaginationFooter
          onChangePage={setPage}
          page={page}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </Flex>
    </>
  )
}

function AdminDashboard() {
  const { data: stats, isLoading, error } = useStats()
  const cardBg = useColorModeValue("white", "gray.800")
  const borderColor = useColorModeValue("gray.200", "gray.700")

  if (error) {
    return (
      <Container maxW="full">
        <Alert status="error" mt={4}>
          <AlertIcon />
          Failed to load admin statistics. Please check your permissions and try again.
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <Heading size="2xl" textAlign={{ base: "center", md: "left" }} pt={6} mb={6}>
        Admin Dashboard
      </Heading>

      {/* Key Metrics Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatsCard
          title="Total Users"
          value={stats?.users.total || 0}
          subtitle={`${stats?.users.active || 0} active`}
          icon={FiUsers}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Files"
          value={stats?.files.total || 0}
          subtitle={`${formatBytes(stats?.files.total_size_bytes || 0)}`}
          icon={FiDatabase}
          color="green"
          isLoading={isLoading}
        />
        <StatsCard
          title="Total Runs"
          value={stats?.runs.total || 0}
          subtitle={`${stats?.runs.currently_running || 0} running`}
          icon={FiActivity}
          color="purple"
          isLoading={isLoading}
        />
        <StatsCard
          title="Tools Available"
          value={stats?.tools.enabled || 0}
          subtitle={`${stats?.tools.total || 0} total`}
          icon={FiTool}
          color="orange"
          isLoading={isLoading}
        />
      </SimpleGrid>

      {/* Detailed Stats Grid */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={8}>
        {/* User Statistics */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              User Statistics
            </Heading>
            <VStack spacing={4} align="stretch">
              <Stat>
                <StatLabel>Total Users</StatLabel>
                <StatNumber>{stats?.users.total || 0}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Active Users</StatLabel>
                <StatNumber>{stats?.users.active || 0}</StatNumber>
                <StatHelpText>
                  {stats?.users.total
                    ? safeToFixed((safeNumber(stats.users.active) / safeNumber(stats.users.total)) * 100, 1)
                    : 0}
                  % of total
                </StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Superusers</StatLabel>
                <StatNumber>{stats?.users.superusers || 0}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Active Last 30 Days</StatLabel>
                <StatNumber>{stats?.users.active_last_30_days || 0}</StatNumber>
              </Stat>
            </VStack>
          </CardBody>
        </Card>

        {/* Run Statistics */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              Run Status Distribution
            </Heading>
            <RunStatusChart data={stats?.runs.by_status} isLoading={isLoading} />
            <Box mt={4}>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.500">
                  Success Rate
                </Text>
                <Badge colorScheme="green" variant="subtle">
                  {safeToFixed(stats?.runs.success_rate_percent, 1)}%
                </Badge>
              </HStack>
            </Box>
          </CardBody>
        </Card>

        {/* File Statistics */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              Storage Overview
            </Heading>
            <VStack spacing={4} align="stretch">
              <Stat>
                <StatLabel>Total Storage Used</StatLabel>
                <StatNumber>{safeToFixed(stats?.files.total_size_gb, 2)} GB</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Saved Files Storage</StatLabel>
                <StatNumber>{safeToFixed(stats?.files.saved_size_gb, 2)} GB</StatNumber>
                <StatHelpText>
                  {stats?.files.saved || 0} files saved permanently
                </StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Temporary Files</StatLabel>
                <StatNumber>{stats?.files.temporary || 0}</StatNumber>
                <StatHelpText>
                  {stats?.files.total_size_gb && stats?.files.saved_size_gb
                    ? safeToFixed(safeNumber(stats.files.total_size_gb) - safeNumber(stats.files.saved_size_gb), 2)
                    : "0"}{" "}
                  GB
                </StatHelpText>
              </Stat>
            </VStack>
          </CardBody>
        </Card>

        {/* File Types */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              Top File Types
            </Heading>
            <FileTypesChart data={stats?.files.by_type} isLoading={isLoading} />
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Performance Metrics */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Tool Statistics */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              Most Popular Tools
            </Heading>
            <VStack spacing={3} align="stretch">
              {stats?.tools.most_popular &&
                stats.tools.most_popular
                  .slice(0, 5)
                  .map((tool: any) => (
                    <Flex key={tool.name} justify="space-between" align="center">
                      <Text fontSize="sm">{tool.name}</Text>
                      <Badge colorScheme="blue" variant="subtle">
                        {tool.count} runs
                      </Badge>
                    </Flex>
                  ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              System Performance
            </Heading>
            <VStack spacing={4} align="stretch">
              <Stat>
                <StatLabel>Runs Last 24h</StatLabel>
                <StatNumber>{stats?.runs.last_24_hours || 0}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Average Runtime</StatLabel>
                <StatNumber>{safeToFixed(stats?.runs.average_runtime_minutes, 1)} min</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Currently Running</StatLabel>
                <StatNumber>{stats?.runs.currently_running || 0}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Average File Size</StatLabel>
                <StatNumber>
                  {stats?.files.average_size_bytes
                    ? formatBytes(stats.files.average_size_bytes)
                    : "0 Bytes"}
                </StatNumber>
              </Stat>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Users Management Section */}
      <Box mt={8}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg">Users Management</Heading>
          <Navbar type={"User"} addModalAs={AddUser} />
        </Flex>
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardBody>
            <UsersTable />
          </CardBody>
        </Card>
      </Box>
    </Container>
  )
}
