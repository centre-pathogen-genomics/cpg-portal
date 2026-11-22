// The two faces of the app, in the portal's palette: what the splash shows
// has to match the window it hands over to, which follows the user's theme.
const PALETTES = {
  light: { background: "#f5f9fb", ink: "#10222e", muted: "#5b7080" },
  dark: { background: "#0d1b26", ink: "#e6edf2", muted: "#9db8c9" },
}

/**
 * The window shown while the runner starts: the portal's mark, and a hint that
 * the first start can take a while because the tool environment is installed.
 */
export function splashHtml(logoSrc: string, dark: boolean): string {
  const palette = dark ? PALETTES.dark : PALETTES.light
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"
    />
    <style>
      :root {
        --accent: #0f7c9c;
        --ink: ${palette.ink};
        --muted: ${palette.muted};
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        height: 100%;
        margin: 0;
      }
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        background: ${palette.background};
        color: var(--ink);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          Helvetica, Arial, sans-serif;
        -webkit-user-select: none;
        user-select: none;
      }
      .logo {
        width: 90%;
        height: auto;
      }
      .logo[src=""] {
        display: none;
      }
      .spinner {
        width: 22px;
        height: 22px;
        border: 3px solid color-mix(in srgb, var(--accent) 22%, transparent);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      .caption {
        margin: 0;
        color: var(--muted);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation-duration: 3s;
        }
      }
    </style>
  </head>
  <body>
    <img class="logo" src="${logoSrc}" alt="CPG Bioinformatics Portal" />
    <p class="caption">Starting CPG Runner…</p>
    <div class="spinner" role="progressbar" aria-label="Starting"></div>
  </body>
</html>`
}
