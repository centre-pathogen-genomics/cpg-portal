import { createFileRoute } from "@tanstack/react-router";
import {
  Container,
  Heading,
  Text,
  Stack,
  Box,
  Link,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  List,
  ListItem,
  ListIcon,
  Image,
  Flex,
} from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "@tanstack/react-router";
import Logo from "/assets/images/cpg-logo.png";
import MainMenuBar from "../components/Common/MainMenuBar";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      {
        title: "About | CPG Portal",
      },
    ],
  }),
});

function About() {
  return (
    <Box>
    <MainMenuBar />
    <Container maxW="4xl" py={10}>
      <Stack spacing={8}>
        {/* Header */}
        <Flex as={RouterLink} to="/" justify="center" mb={4}>
          <Image
            src={Logo}
            alt="CPG logo"
            height="auto"
            maxW={{ base: "xs", md: "md" }}
            alignSelf="center"
            mb={4}
          />
        </Flex>
        <Box>
          <Heading as="h1" size="xl" mb={2}>
            Bioinformatics Analysis Portal (The Portal)
          </Heading>
          <Heading as="h2" size="md" fontWeight="normal">
            Centre for Pathogen Genomics
          </Heading>
        </Box>

        {/* Introduction */}
        <Text>
          The Portal is a bioinformatics job running platform developed by the
          <Link href="https://cpg.unimelb.edu.au" isExternal color="teal.500">
            {" "}
            Centre for Pathogen Genomics
          </Link>{" "}
          at the University of Melbourne. It is designed to help laboratories
          and public-health teams analyse pathogen genomics data with ease. The
          Portal turns complex genomics pipelines into a{" "}
          <strong>point-and-click web experience</strong>, so laboratorians and
          public-health teams can move from raw reads to actionable
          insight—without touching the command line. Whether you are
          investigating an outbreak in a provincial hospital or curating
          national surveillance data, The Portal lets you focus on science and
          response, not servers.
        </Text>

        {/* What makes The Portal different */}
        <Heading as="h3" size="md">
          What makes The Portal different
        </Heading>
        <List spacing={3} pl={4}>
          <ListItem>
            <ListIcon as={CheckCircleIcon} color="green.500" />
            <strong>Built for real-world labs.</strong> Run QC, consensus
            building, variant calling and phylogenetics through your browser;
            the platform handles the software and provenance under the hood.
          </ListItem>
          <ListItem>
            <ListIcon as={CheckCircleIcon} color="green.500" />
            <strong>Open & sustainable.</strong> The entire code base is
            MIT-licensed on GitHub—free to audit, extend or fork.
          </ListItem>
          <ListItem>
            <ListIcon as={CheckCircleIcon} color="green.500" />
            <strong>Local or hosted—your choice.</strong> Use our University of
            Melbourne instance or deploy on-prem with one Docker command.
          </ListItem>
          <ListItem>
            <ListIcon as={CheckCircleIcon} color="green.500" />
            <strong>Ease of use.</strong> Upload FASTQ files with a simple
            drag-and-drop interface, and run analyses with a click. The Portal
            handles the complexity of bioinformatics pipelines, so you can focus
            on results.
          </ListItem>
        </List>

        {/* Who should use it? */}
        <Heading as="h3" size="md">
          Who should use it?
        </Heading>
        <Text>
          The Portal is designed for wet-lab scientists, pathogen-genomics
          specialists, and public-health laboratories.
        </Text>

        {/* Feature table */}
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>The Portal delivers</Th>
              <Th>Why it matters</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>Browser-based “drag-and-drop” uploads</Td>
              <Td>Eliminates installation hurdles for new users</Td>
            </Tr>
            <Tr>
              <Td>Automated, version-pinned workflows</Td>
              <Td>Ensures reproducibility and audit trails</Td>
            </Tr>
            <Tr>
              <Td>Lightweight Docker deployment</Td>
              <Td>Runs on anything from a laptop to a cluster</Td>
            </Tr>
            <Tr>
              <Td>Modular task registry</Td>
              <Td>Add new assays in minutes—no front-end coding</Td>
            </Tr>
            <Tr>
              <Td>Completely open source</Td>
              <Td>Encourages local ownership and regional collaboration</Td>
            </Tr>
          </Tbody>
        </Table>
        {/* Who is behind it? */}
        <Heading as="h3" size="md">
          CGP Portal Team
        </Heading>
        <Text>
          The Portal is developed with ❤️ by{" "}
          <Link
            href="https://findanexpert.unimelb.edu.au/profile/888836-wytamma-wirth"
            isExternal
            color="teal.500"
          >
            Wytamma Wirth
          </Link>
          , in collaboration with{" "}
          <Link
            href="https://www.doherty.edu.au/people/associate-professor-torsten-seemann"
            isExternal
            color="teal.500"
          >
            Torsten Seemann
          </Link>
          , with the support of a team of talented reachers, scientists,
          bioinformaticians at the Centre for Pathogen Genomics.
        </Text>

        {/* Get started */}
        <Heading as="h3" size="md">
          Get started
        </Heading>
        <Text>
          <strong>Try the hosted portal</strong> –{" "}
          <Link
            href="https://portal.cpg.unimelb.edu.au"
            isExternal
            color="teal.500"
          >
            https://portal.cpg.unimelb.edu.au
          </Link>{" "}
          lets you explore The Portal without installing anything.
        </Text>
        <Text>
          <strong>Deploy your own</strong> – Clone{" "}
          <Link
            href="https://github.com/centre-pathogen-genomics/cpg-portal"
            isExternal
            color="teal.500"
          >
            the repository on GitHub
          </Link>{" "}
          and spin up the full stack with <code>docker compose up -d</code>.
        </Text>

        <Text>
          Together, we can <strong>democratise pathogen-genomics</strong> and
          strengthen outbreak preparedness across the region.
        </Text>
      </Stack>
    </Container>
    </Box>
  );
}

export default About;
