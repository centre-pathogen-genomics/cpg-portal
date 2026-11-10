import { createBridge } from "@tabee/browser"
import {
  NEWICK_V1,
  normalizeFormatKey,
  registryCapability,
} from "@tabee/formats"
import { TabeeException } from "@tabee/protocol"
import { useMemo, useRef, useState } from "react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { hasPermission } from "@/lib/permissions"
import trakkaLogoLight from "/assets/images/trakka_logo_small.svg"
import trakkaLogoDark from "/assets/images/trakka_logo_small_dark.svg"

const TRAKKA_URL =
  import.meta.env.VITE_TRAKKA_URL || "https://viz.beta.trakka.org/"

interface SendNewickToTrakkaButtonProps {
  newick: string
}

const SendNewickToTrakkaButton = (props: SendNewickToTrakkaButtonProps) => {
  const { user } = useAuth()

  if (!hasPermission(user, "trakka:send")) return null

  return <TrakkaSender {...props} />
}

const TrakkaSender = ({ newick }: SendNewickToTrakkaButtonProps) => {
  // The bridge is created once, so its export adapter reads the tree through a
  // ref instead of capturing the content from the first render.
  const newickRef = useRef(newick)
  newickRef.current = newick

  const [sending, setSending] = useState(false)
  const notify = useCustomToast()
  const { resolvedTheme } = useTheme()
  const trakkaLogo = resolvedTheme === "dark" ? trakkaLogoDark : trakkaLogoLight

  const bridge = useMemo(
    () =>
      createBridge({
        application: {
          name: "CPG Bioinformatics Portal",
          url: window.location.origin,
        },
        normalizeFormatKey,
        exports: {
          [NEWICK_V1]: () => ({
            name: "tree.newick",
            files: [{ name: "tree.nwk", data: newickRef.current }],
          }),
        },
        exportCapabilities: {
          [NEWICK_V1]: registryCapability(NEWICK_V1),
        },
      }),
    [],
  )

  const handleClick = () => {
    if (sending) return
    setSending(true)

    // tabEE opens the receiving tab synchronously, so sendTo must be called
    // from the click handler before any await; otherwise the popup is blocked.
    bridge
      .sendTo(TRAKKA_URL, { format: NEWICK_V1 })
      .then((receipt) => {
        notify(
          "Sent to Trakka",
          `${receipt.fileCount} file${receipt.fileCount === 1 ? "" : "s"} imported`,
          "success",
        )
      })
      .catch((cause: unknown) => {
        notify(
          "Could not send to Trakka",
          cause instanceof TabeeException || cause instanceof Error
            ? cause.message
            : String(cause),
          "error",
        )
      })
      .finally(() => setSending(false))
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={sending}
      aria-busy={sending}
    >
      <img src={trakkaLogo} alt="" aria-hidden="true" className="size-4" />
      {sending ? "Sending to Trakka…" : "Send to Trakka"}
    </Button>
  )
}

export default SendNewickToTrakkaButton
