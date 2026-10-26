import { useQuery } from "@tanstack/react-query"
import type { RunPublic, RunPublicMinimal } from "../client"
import { readToolVersionsOptions } from "../client/@tanstack/react-query.gen"

/**
 * The version to open for a run: the one the run recorded while this user can
 * still open it, else the tool row's current label, which is the same
 * configuration when the row was renamed, else `undefined` and the stack's
 * default answers.
 */
export default function useRunToolVersion(
  run: RunPublic | RunPublicMinimal,
): string | undefined {
  const { data: versions } = useQuery({
    ...readToolVersionsOptions({ path: { tool_name: run.tool.name } }),
  })
  return [run.tool_version, run.tool.version].find(
    (candidate) =>
      !!candidate &&
      (versions ?? []).some((version) => version.version === candidate),
  )
}
