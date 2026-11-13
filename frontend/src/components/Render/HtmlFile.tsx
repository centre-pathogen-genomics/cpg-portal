import { type RenderableFile, useFileText } from "./fileSource"

interface HtmlFileProps {
  file: RenderableFile
  height?: string | number
}

const HtmlFile = ({ file, height = 500 }: HtmlFileProps) => {
  const html = useFileText(file)

  return (
    <iframe
      title="Untrusted HTML"
      // DO NOT include allow-same-origin
      sandbox="allow-scripts allow-forms allow-modals allow-popups-by-user-activation"
      // Prevent cookies/referrers from leaking on subrequests
      referrerPolicy="no-referrer"
      // Permissions-Policy for this frame (modern 'allow' attribute)
      allow="
        geolocation 'none'; microphone 'none'; camera 'none'; payment 'none';
        usb 'none'; xr-spatial-tracking 'none'; clipboard-read *; clipboard-write *
      "
      // Feed the user HTML directly; no same-origin blob URL
      srcDoc={html}
      height={height}
      className="w-full rounded-md border"
    />
  )
}

export default HtmlFile
