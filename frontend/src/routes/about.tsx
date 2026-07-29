import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { CheckCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Logo from "/assets/images/cpg-logo.png"
import MainMenuBar from "../components/Common/MainMenuBar"

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({ meta: [{ title: "About | CPG Portal" }] }),
})

const ExternalLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-primary hover:underline"
  >
    {children}
  </a>
)

function About() {
  const features = [
    [
      "Browser-based “drag-and-drop” uploads",
      "Eliminates installation hurdles for new users",
    ],
    [
      "Automated, version-pinned workflows",
      "Ensures reproducibility and audit trails",
    ],
    [
      "Lightweight Docker deployment",
      "Runs on anything from a laptop to a cluster",
    ],
    ["Modular task registry", "Add new assays in minutes—no front-end coding"],
    [
      "Completely open source",
      "Encourages local ownership and regional collaboration",
    ],
  ]
  const differences = [
    [
      "Built for real-world labs.",
      " Run QC, consensus building, variant calling and phylogenetics through your browser; the platform handles the software and provenance under the hood.",
    ],
    [
      "Open & sustainable.",
      " The entire code base is MIT-licensed on GitHub—free to audit, extend or fork.",
    ],
    [
      "Local or hosted—your choice.",
      " Use our University of Melbourne instance or deploy on-prem with one Docker command.",
    ],
    [
      "Ease of use.",
      " Upload FASTQ files with a simple drag-and-drop interface, and run analyses with a click. The Portal handles the complexity of bioinformatics pipelines, so you can focus on results.",
    ],
  ]
  return (
    <div>
      <MainMenuBar />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <RouterLink to="/" className="mb-4 flex justify-center">
          <img
            src={Logo}
            alt="CPG logo"
            className="mb-4 h-auto w-full max-w-xs md:max-w-md"
          />
        </RouterLink>
        <section>
          <h1 className="mb-2 text-3xl font-bold">
            Bioinformatics Analysis Portal (The Portal)
          </h1>
          <h2 className="text-lg">Centre for Pathogen Genomics</h2>
        </section>
        <p>
          The Portal is a bioinformatics job running platform developed by the{" "}
          <ExternalLink href="https://cpg.unimelb.edu.au">
            Centre for Pathogen Genomics
          </ExternalLink>{" "}
          at the University of Melbourne. It is designed to help laboratories
          and public-health teams analyse pathogen genomics data with ease. The
          Portal turns complex genomics pipelines into a{" "}
          <strong>point-and-click web experience</strong>, so laboratorians and
          public-health teams can move from raw reads to actionable
          insight—without touching the command line. Whether you are
          investigating an outbreak in a provincial hospital or curating
          national surveillance data, The Portal lets you focus on science and
          response, not servers.
        </p>
        <h3 className="text-lg font-semibold">
          What makes The Portal different
        </h3>
        <ul className="space-y-3 pl-4">
          {differences.map(([title, text], index) => (
            <li className="flex gap-2" key={index}>
              <CheckCircle className="mt-0.5 size-5 shrink-0 text-green-500" />
              <span>
                <strong>{title}</strong>
                {text}
              </span>
            </li>
          ))}
        </ul>
        <h3 className="text-lg font-semibold">Who should use it?</h3>
        <p>
          The Portal is designed for wet-lab scientists, pathogen-genomics
          specialists, and public-health laboratories.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>The Portal delivers</TableHead>
              <TableHead>Why it matters</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map(([feature, reason]) => (
              <TableRow key={feature}>
                <TableCell>{feature}</TableCell>
                <TableCell>{reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <h3 className="text-lg font-semibold">CPG Portal Team</h3>
        <p>
          The Portal is developed by{" "}
          <ExternalLink href="https://findanexpert.unimelb.edu.au/profile/888836-wytamma-wirth">
            Wytamma Wirth
          </ExternalLink>
          , in collaboration with{" "}
          <ExternalLink href="https://www.doherty.edu.au/people/associate-professor-torsten-seemann">
            Torsten Seemann
          </ExternalLink>
          , with the support of researchers, scientists, and bioinformaticians
          at the Centre for Pathogen Genomics.
        </p>
        <h3 className="text-lg font-semibold">Get started</h3>
        <p>
          <strong>Try the hosted portal</strong> –{" "}
          <ExternalLink href="https://portal.cpg.unimelb.edu.au">
            https://portal.cpg.unimelb.edu.au
          </ExternalLink>{" "}
          lets you explore The Portal without installing anything.
        </p>
        <p>
          <strong>Deploy your own</strong> – Clone{" "}
          <ExternalLink href="https://github.com/centre-pathogen-genomics/cpg-portal">
            the repository on GitHub
          </ExternalLink>{" "}
          and spin up the full stack with <code>docker compose up -d</code>.
        </p>
        <p>
          Together, we can <strong>democratise pathogen-genomics</strong> and
          strengthen outbreak preparedness across the region.
        </p>
      </main>
    </div>
  )
}

export default About
