import {
  Box,
  Container,
  Flex,
  Heading,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { FilePublic } from "../../../client";
import OutputAccordion from "../../../components/Runs/OutputAccordion";
import RunMetadata from "../../../components/Runs/RunMetadata";
import OutputFile from "../../../components/Runs/OutputFile";
import CsvFileToTable from "../../../components/Render/CsvFileToTable";
import JsonFile from "../../../components/Render/JsonFile";
import TextFile from "../../../components/Render/TextFile";
import ImageFile from "../../../components/Render/Image";
import { readRunOptions } from "../../../client/@tanstack/react-query.gen";
import CancelRunButton from "../../../components/Runs/CancelRunButton";
import DeleteRunButton from "../../../components/Runs/DeleteRunButton";
import EditRunName from "../../../components/Runs/EditRunName";
import AISummaryButton from "../../../components/AI/AISummary";
import ShareRunButton from "../../../components/Runs/ShareRunButton";
import ReactMarkdown from "../../../components/Common/Markdown";

export const Route = createFileRoute("/_layout/runs/$runid")({
  component: Run,
});

function renderResult(file: FilePublic) {
  if (file.size && file.size < 500000) {
    switch (file.file_type) {
      case "csv":
        return <CsvFileToTable fileId={file.id} />;
      case "tsv":
        return <CsvFileToTable tsv fileId={file.id} />;
      case "json":
        return <JsonFile fileId={file.id} />;
      case "text":
        return <TextFile fileId={file.id} />;
      case "png":
      case "jpeg":
        return <ImageFile fileId={file.id} />;
      default:
        return null;
    }
  }
}

function RunDetail() {
  const { runid } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });

  // Using useSuspenseQuery for data fetching

  const { data: run } = useSuspenseQuery({
    ...readRunOptions({ path: { id: runid } }),
    refetchInterval: (run) => {
      return (run && run.state.data?.status === "running") ||
        run.state.data?.status === "pending"
        ? 3000
        : false; // Poll every 3 seconds if run is running or pending
    },
    refetchIntervalInBackground: true,
  });

  const [llmSummary, setLlmSummary] = useState<string | null>(
    run.llm_summary || null
  );

  const fileTabs =
    run.files?.filter((file) => file.size && file.size < 500000) || [];

  const command = [];
  if (run?.command) {
    command.push(run.command);
  }

  return (
    <Box maxW={"5xl"} justifySelf={"center"} w={"full"} overflowX={"hidden"} px={2}>
      <Flex align={"center"} justify={'space-between'} gap={2}>
          <Flex
            as={Link}
            to={"/runs"}
            key={"Runs"}
            _hover={{ color: "ui.main" }}
            fontWeight="semibold"
            align="center"
            whiteSpace={'nowrap'}
          >
            <Text>← Back to My Runs</Text>
          </Flex>
          <Flex gap={2} alignItems={"center"}>
            {!run.owner_name && <ShareRunButton run={run} />}
            {["running", "pending"].includes(run.status) ? (
              <CancelRunButton run_id={run.id} />
            ) : (
              <DeleteRunButton
                run_id={run.id}
                onDelete={() => navigate({ to: "/runs" })}
              />
            )}
          </Flex>
        </Flex>
      <Flex
        direction="row"
        borderBottomWidth={1}
        alignItems={"start"}
        mb={2}
        mt={1}
      >
        <EditRunName run={run} />
      </Flex>
      <Box my={4}>
        <RunMetadata run={run} />
      </Box>
      {run.files.length > 0 && (
        <>
          <Heading size="md" mb={4}>
            Files
          </Heading>
          <Flex wrap="nowrap" overflowX={"auto"} mb={4}>
            {run.files.map((file) => (
              <Flex key={file.id} mb={2} mr={2}>
                <OutputFile file={file} copyFile={run.owner_name ? true : false} />
              </Flex>
            ))}
          </Flex>
          {run.files?.filter((file) => file.size && file.size < 500000).length >
            0 && (
            <>
              <Flex
                direction="row"
                justify="space-between"
                align="center"
                justifyItems={"center"}
                alignItems={"center"}
                mb={4}
              >
                <Heading size="md">Results</Heading>
                {run.tool.llm_summary_enabled && !llmSummary && !run.owner_name && (
                  <AISummaryButton
                    runId={run.id}
                    onGenerated={(summary) => {
                      setLlmSummary(summary);
                    }}
                  />
                )}
              </Flex>
              <Tabs variant="enclosed" overflowY={"auto"}>
                <TabList>
                  {run.tool.llm_summary_enabled && llmSummary && (
                    <Tab key="llm_summary">AI Summary</Tab>
                  )}
                  {fileTabs.map((file, index) => (
                    <Tab tabIndex={index} key={file.id}>
                      {file.name.toLocaleUpperCase()}
                    </Tab>
                  ))}
                </TabList>
                <TabPanels>
                  {run.tool.llm_summary_enabled && llmSummary && (
                    <TabPanel>
                      <Text
                        fontWeight="bold"
                        mb={2}
                        fontSize={"sm"}
                        color={"ui.danger"}
                      >
                        Large Language Models (AI) are prone to hallucinations
                        and mistakes. Please use with caution.
                      </Text>
                      <ReactMarkdown markdown={llmSummary} />
                    </TabPanel>
                  )}
                  {fileTabs.map((file) => (
                    <TabPanel key={file.id}>{renderResult(file)}</TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </>
          )}
        </>
      )}
      <OutputAccordion run={run} />
    </Box>
  );
}

function RunSkeleton() {
  return (
    <Container maxW="full">
      <Skeleton height="20px" />
    </Container>
  );
}

function Run() {
  return (
    <Container maxW="full">
      <Suspense fallback={<RunSkeleton />}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Box>
              <Text>Error: {error.message}</Text>
            </Box>
          )}
        >
          <RunDetail />
        </ErrorBoundary>
      </Suspense>
    </Container>
  );
}

export default Run;
