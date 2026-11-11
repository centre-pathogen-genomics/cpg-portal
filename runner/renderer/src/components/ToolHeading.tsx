import type { ComponentType, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type HeadingProps = {
  className?: string;
  id?: string;
  children?: ReactNode;
};

/**
 * A tool's name block: its picture, the name and version, a rule, then its
 * badges. The tool page and the portal dialog use the same one, so a tool looks
 * the same wherever it is shown.
 */
export function ToolHeading({
  image,
  name,
  version,
  badges,
  heading: Heading = "h1",
  children,
}: {
  image: string;
  name: string;
  version?: string | null;
  badges?: ReactNode;
  /** "h1" on a page, `DialogTitle` inside a dialog. */
  heading?: "h1" | "h2" | ComponentType<HeadingProps>;
  /** Right-hand actions, e.g. the page's buttons. */
  children?: ReactNode;
}) {
  const Title = Heading as ComponentType<HeadingProps>;
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 items-center">
          <img
            src={image}
            alt={name}
            className="mr-2 size-12 shrink-0 rounded-md border-2 object-cover"
          />
          <Title className="truncate text-3xl font-bold">{name}</Title>
          {version && (
            <Badge className="ml-1 bg-green-500 text-white">v{version}</Badge>
          )}
        </div>
        {children}
      </div>
      {badges && <div className="mt-2">{badges}</div>}
    </>
  );
}
