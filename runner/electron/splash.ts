/**
 * The window shown while the runner starts: the portal's mark, and a hint that
 * the first start can take a while because the tool environment is installed.
 */
export function splashHtml(logoSrc: string): string {
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
        --ink: #e6edf2;
        --muted: #9db8c9;
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
        background: #0d1b26;
        color: var(--ink);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          Helvetica, Arial, sans-serif;
        -webkit-user-select: none;
        user-select: none;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: #0d1b26;
          color: #e6edf2;
        }
        .caption {
          color: #9db8c9;
        }
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
