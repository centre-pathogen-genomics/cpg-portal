import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { RiRobot2Line } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Audience } from "../../client"
import { generateRunSummaryMutation } from "../../client/@tanstack/react-query.gen"
import useCustomToast from "../../hooks/useCustomToast"

interface Props {
  runId: string
  onGenerated?: (data: string) => void
}

const GenerateAISummary = ({ runId, onGenerated }: Props) => {
  const [open, setOpen] = useState(false)
  const [audience, setAudience] = useState<Audience>("expert")
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const mutation = useMutation({
    ...generateRunSummaryMutation(),
    onSuccess: (data) => {
      onGenerated?.(data)
      setOpen(false)
    },
    onError: () =>
      showToast(
        "Error",
        "An error occurred while generating the summary. Please try again later.",
        "error",
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["runs"] }),
  })
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Generate LLM Summary"
        variant="ghost"
        disabled={mutation.isPending}
      >
        AI Summary <RiRobot2Line className="size-6" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate AI Summary for Run {runId}?</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to generate an AI-powered summary for this
            run? Your data will be sent to Google servers.
          </p>
          <label htmlFor="summary-audience">
            Select the audience for the summary:
          </label>
          <select
            id="summary-audience"
            required
            className="h-9 rounded-md border bg-background px-3"
            value={audience}
            onChange={(event) => setAudience(event.target.value as Audience)}
          >
            <option value="expert">Expert</option>
            <option value="layman">Layman</option>
          </select>
          <DialogFooter>
            <Button
              onClick={() =>
                mutation.mutate({
                  path: { run_id: runId },
                  query: { audience },
                })
              }
              disabled={mutation.isPending}
            >
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              Generate
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default GenerateAISummary
