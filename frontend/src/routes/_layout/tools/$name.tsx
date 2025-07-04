import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Box, Button, Flex, FormLabel, Heading, HStack, Image, Link, Skeleton, SkeletonText, Switch, Text, Badge as VersionBadge } from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, Link as RouterLink } from "@tanstack/react-router"
import { disableLlmSummaryMutation, disableToolMutation, enableLlmSummaryMutation, enableToolMutation, installToolMutation, readToolByNameOptions, readToolByNameQueryKey, readUserMeQueryKey } from "../../../client/@tanstack/react-query.gen"
import RunToolForm from "../../../components/Tools/RunToolForm"
import { ToolPublic, UserPublic } from "../../../client"
import CodeBlock from "../../../components/Common/CodeBlock"
import Badge from "../../../components/Tools/badges/Badge"
import GitHubBadge from "../../../components/Tools/badges/GitHubBadge"
import { useEffect, useState } from "react"
import useCustomToast from "../../../hooks/useCustomToast"
import FavouriteButton from "../../../components/Tools/FavouriteButton"

export const Route = createFileRoute("/_layout/tools/$name")({
  component: Tool,
  head: (ctx) => ({
    meta: [
      {
        name: 'description',
        content: `Run and configure ${(ctx.params as { name: string }).name} in the CPG Portal`, 
      },
      {
        title: `${(ctx.params as { name: string }).name} | CPG Portal`,
      },
    ],
  })
})

function EnableToolButton({tool}: {tool: ToolPublic}) {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [isEnabled, setIsEnabled] = useState(tool.enabled);
  
  const enableTool = useMutation({
    ...enableToolMutation(),
    onError: () => {
      showToast("Error", "Could not enable tool", "error");
    },
    onSuccess: () => {
      setIsEnabled(true);
      // queryClient.invalidateQueries({queryKey: [{_id: 'readToolByName'}]});
      const queryKey = readToolByNameQueryKey({path: {tool_name: tool.name}});
      queryClient.invalidateQueries({queryKey});
    },
  });

  const unenableTool = useMutation({
    ...disableToolMutation(),
    onError: () => {
      showToast("Error", "Could not disable tool", "error");
    },
    onSuccess: () => {
      setIsEnabled(false);
      const queryKey = readToolByNameQueryKey({path: {tool_name: tool.name}});
      queryClient.invalidateQueries({queryKey});
    }
  });

  return (
    <HStack alignItems="center" >
    <Switch size={'lg'} id="enable" isChecked={isEnabled} onChange={(e) => {
        if (e.target.checked) {
          enableTool.mutate({path: {tool_id: tool.id}});
        } else {
          unenableTool.mutate({path: {tool_id: tool.id}});
        }
      }
    } />
    <FormLabel htmlFor='enable' mb='0' mr={1}>
      {isEnabled ? "Tool Enabled" : "Tool Disabled"} 
    </FormLabel>
    </HStack>
  )
}

function EnableAISummaryButton({tool}: {tool: ToolPublic}) {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [isEnabled, setIsEnabled] = useState(tool.llm_summary_enabled);
  
  const enableTool = useMutation({
    ...enableLlmSummaryMutation(),
    onError: () => {
      showToast("Error", "Could not enable AI Summary", "error");
    },
    onSuccess: () => {
      setIsEnabled(true);
      const queryKey = readToolByNameQueryKey({path: {tool_name: tool.name}});
      queryClient.invalidateQueries({queryKey});
    },
  });

  const unenableTool = useMutation({
    ...disableLlmSummaryMutation(),
    onError: () => {
      showToast("Error", "Could not disable AI Summary", "error");
    },
    onSuccess: () => {
      setIsEnabled(false);
      const queryKey = readToolByNameQueryKey({path: {tool_name: tool.name}});
      queryClient.invalidateQueries({queryKey});
    }
  });

  return (
    <HStack alignItems="center" >
    <Switch size={'lg'} id="enable" isChecked={isEnabled} onChange={(e) => {
        if (e.target.checked) {
          enableTool.mutate({path: {tool_id: tool.id}});
        } else {
          unenableTool.mutate({path: {tool_id: tool.id}});
        }
      }
    } />
    <FormLabel htmlFor='enable' mb='0' mr={1}>
      {isEnabled ? "AI Summary Enabled" : "AI Summary Disabled"} 
    </FormLabel>
    </HStack>
  )
}

function useInstallTool(tool: ToolPublic) {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  return useMutation({
    ...installToolMutation(),
    onError: ({message}) => {
      showToast("Error", message || "Could not install tool", "error");
    },
    onSuccess: ({message}) => {
      showToast("Success", message || "Installation started", "success");

      const queryKey = readToolByNameQueryKey({ path: { tool_name: tool.name } });

      // Initial invalidation
      queryClient.invalidateQueries({ queryKey });

      // Set up an interval to revalidate periodically
      const interval = setInterval(async () => {
        // Fetch the latest tool status
        const updatedTool = queryClient.getQueryData(queryKey) as ToolPublic;

        // If the tool is no longer installing, clear the interval
        if (updatedTool?.status !== "installing") {
          clearInterval(interval);
        } else {
          queryClient.invalidateQueries({ queryKey });
        }
      }, 5000);
    },
  });
}

// Component Implementation
function InstallToolButton({ tool }: { tool: ToolPublic }) {
  const installTool = useInstallTool(tool);

  const handleInstallClick = () => {
    installTool.mutate({ path: { tool_id: tool.id } });
  };

  return (
    <Box>
      <Button
        isLoading={tool.status === "installing"}
        onClick={handleInstallClick}
        aria-label="Install Tool"
        isDisabled={tool.status === "installed"}
      >
        Install
      </Button>
    </Box>
  );
}


function Tool() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(readUserMeQueryKey())
  const anonymousUser = currentUser === undefined
  const { name } = Route.useParams()
  const { isError, data: tool, isPending } = useQuery({
    ...readToolByNameOptions({path: {tool_name: name}}),
  })

  useEffect(() => { 
    if (tool) {
      setIsFavourited(tool.favourited ?? false);
    }
  }
  , [tool])

  const [isFavourited, setIsFavourited] = useState(false); 
  

  if (isError) {
    return (
      <Box maxW="2xl" width="100%" mx={4} pt={12} pb={8}>
        <Heading>Tool Not Found</Heading>
        <Text>
          The requested tool could not be found. Please check the ID and try
          again.
        </Text>
      </Box>
    )
  }
  if (isPending) {
    return (
      <Flex justify="center">
        <Box maxW="5xl" width="100%" mx={4} pt={6} pb={8}>
        <Flex mb={2} pb={2} borderBottomWidth={1} >
          <Heading size="2xl" >{name}</Heading>
        </Flex>
        <SkeletonText/>
        <Heading size="lg" mb={4}>Configure Tool</Heading>
        <Skeleton height="200px" />
        </Box>
      </Flex>
    )
  }
  
  return (
    <Flex justify="center">
      <Box maxW="5xl" width="100%" px={4} pt={6} pb={8}>
        <Flex align={'center'} justify={'space-between'} direction={'row'} mb={2} pb={2} borderBottomWidth={1} >
          <Flex whiteSpace={'nowrap'} textOverflow={'ellipsis'} overflow={'hidden'} >
            <Box rounded={'md'} overflow={'hidden'} mr={2} maxW={{base: 10, md: 12}}  maxH={{base: 10, md: 12}} minW={10} minH={10} borderWidth={2} borderColor={"gray.200"} >
              <Image 
                src={tool.image ?? "https://images.unsplash.com/photo-1543145499-8193615267de?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60"}
                alt={tool?.name}
                objectFit='cover'
                h={"100%"}
                w={"100%"}
              />
            </Box>
            <Heading size="2xl"  >{tool?.name}</Heading>
            {tool.version && (
              <Flex direction={'column'}>
                <VersionBadge ml='1' variant='solid' colorScheme='green'>v{tool.version}</VersionBadge>
              </Flex>
            )}
          </Flex>
          { currentUser && (
            <FavouriteButton tool={tool} isFavourited={isFavourited} setIsFavourited={setIsFavourited} />
          )}
        </Flex>
        {/* {tool?.image && (<Image maxH={200} src={tool?.image} alt={tool?.name} mb={4} />)} */}
        <Flex gap={1} wrap={'wrap'} mb={2}>
          {tool?.url && (
            <Badge url={tool.url} value={tool.url} label="home" color="blue" /> 
          )}
          {tool?.docs_url && (
            <Badge url={tool.docs_url} value={tool.docs_url} label="docs" color="purple" /> 
          )}
          {tool?.paper_doi && (
            <Badge url={`https://doi.org/${tool.paper_doi}`} value={tool.paper_doi} label="doi" color="red" /> 
          )
          }
          {tool?.license && (
            <Badge value={tool.license} label="license" color="blue" /> 
          )}
          {tool?.github_repo && (
            <GitHubBadge type="last-commit" githubRepo={tool.github_repo} />
          )}
          {tool?.github_repo && (
            <GitHubBadge type="stars" githubRepo={tool.github_repo} />
          )} 
          {tool?.badges?.map((badge) => (
            (badge.badge && <Link key={badge.badge} href={badge.url ? badge.url : undefined} isExternal>
                <Image src={badge.badge} />
              </Link>
            )
          ))}
          {tool?.tags?.map((tag) => (
            <RouterLink to={`/search/${tag}`} key={tag}>
              <Badge key={tag} label={'%23'} value={tag} />
            </RouterLink>
          ))}
        </Flex>
        <Text mb={4} >{tool.description}</Text>
        <Heading size="lg" mb={4}>Configure Tool</Heading>
        { anonymousUser && (
          <Text color="red.600" mb={4}>
            You must be {" "}
            <RouterLink to="/login" style={{ color: "blue.500", textDecoration: "underline"}} search={{redirect: `/tools/${tool.name}`}}>
            logged in
            </RouterLink> to run this tool
          </Text>
        )}
        <RunToolForm
          toolId={tool.id}
          params={tool.params ? tool.params : []}
          isDisabled={anonymousUser}
          onSuccess={(run) => {
            navigate({
              to: `/runs/${run.id}`,
              params: { runid: run.id },
              replace: false,
              resetScroll: true,
            })
          }}
        />
        {currentUser?.is_superuser && ( 
          <Accordion allowToggle  mt={8}>
            <AccordionItem>
              <AccordionButton>
                <Box as='span' flex='1' textAlign='left'>
                  Admin
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4}>
                <Box>
                  <HStack justify={"space-between"} mb={4}>
                    <InstallToolButton tool={tool} />
                    <HStack>
                    <EnableAISummaryButton tool={tool} />
                    <EnableToolButton tool={tool} />
                    </HStack> 
                  </HStack>
                  <Heading size="sm">Installation Log ({tool.status})</Heading>
                  <CodeBlock code={tool.installation_log ? tool.installation_log : "\n"} language="bash" lineNumbers />
                </Box>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}
      </Box>
    </Flex>
  )
}

export default Tool
