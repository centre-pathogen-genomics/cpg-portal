#!/usr/bin/env python3
"""Prerender the public tool pages, for crawlers and social scrapers.

Scrapers never run JavaScript, so they only ever see the HTML they are served:
this writes one file per tool name under `/tools/<name>/index.html` carrying
that tool's title, description, image and a plain-language summary. The file is
the app's own shell, so a browser loads the SPA over it and hydrates as usual -
crawlers and visitors get the same page.

It runs inside the frontend container (see `docker-entrypoint.d`) and asks the
API for the catalogue, so the pages follow the tool list.

Environment:
  PRERENDER_API_URL           API base, default http://backend:8000/api/v1
  PRERENDER_SITE_URL          public origin, e.g. https://portal.example.org.
                              When set, pages carry a canonical URL and
                              sitemap.xml is written with absolute locations.
  PRERENDER_INTERVAL_SECONDS  refresh interval, default 21600 (6 hours);
                              0 prerenders once and exits
  PRERENDER_SITE_DIR          where the site is served from,
                              default /usr/share/nginx/html
"""

import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SITE_DIR = Path(os.environ.get("PRERENDER_SITE_DIR", "/usr/share/nginx/html"))
API_URL = os.environ.get("PRERENDER_API_URL", "http://backend:8000/api/v1").rstrip(
    "/"
)
SITE_URL = (os.environ.get("PRERENDER_SITE_URL") or "").rstrip("/")
INTERVAL = int(os.environ.get("PRERENDER_INTERVAL_SECONDS", "21600"))

# Enough options to describe a parameter without listing a whole reference
# panel, e.g. the sixty-odd primer schemes one tool accepts.
MAX_OPTIONS = 8

PORTAL_NAME = "CPG Portal"
PORTAL_DESCRIPTION = "Centre for Pathogen Genomics Bioinformatics Analysis Portal"
FALLBACK_IMAGE = (
    "https://images.unsplash.com/photo-1543145499-8193615267de"
    "?auto=format&fit=crop&w=800&q=60"
)


def fetch_tools() -> list[dict]:
    """The catalogue, one row per tool name, which is what the list page shows."""
    request = urllib.request.Request(f"{API_URL}/tools/?limit=1000")
    request.add_header("Accept", "application/json")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response).get("data", [])


def fetch_tool(name: str) -> dict:
    """The tool's own page, which carries the links the catalogue row lacks."""
    path = urllib.parse.quote(name, safe="")
    request = urllib.request.Request(f"{API_URL}/tools/name/{path}")
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response) or {}
    except Exception:  # noqa: BLE001 - the page keeps the rest of its summary
        return {}


def fetch_versions(name: str) -> list[dict]:
    """Every version this page can offer, in the order the stack lists them."""
    path = urllib.parse.quote(name, safe="")
    request = urllib.request.Request(f"{API_URL}/tools/name/{path}/versions")
    request.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response) or []
    except Exception:  # noqa: BLE001 - the page keeps the rest of its summary
        return []


def one_line(value: object) -> str:
    """Meta tags carry one line, whatever the description does."""
    return re.sub(r"\s+", " ", str(value or "")).strip()


def absolute(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    return f"{SITE_URL}{url}" if SITE_URL else None


def tool_path(name: str) -> str:
    return f"/tools/{urllib.parse.quote(name, safe='')}"


def meta_tags(properties: dict[str, str]) -> str:
    return "\n".join(
        f'    <meta property="{html.escape(key, quote=True)}" '
        f'content="{html.escape(value, quote=True)}" />'
        for key, value in properties.items()
    )


def versions_summary(tool: dict, versions: list[dict]) -> list[str]:
    # A tool without versions is one row with an empty version, which is nothing
    # worth listing.
    named = [version for version in versions if one_line(version.get("version"))]
    if not named:
        version = one_line(tool.get("version"))
        return [f"      <p>Version {html.escape(version)}</p>"] if version else []
    items = [
        "        <li>v"
        + html.escape(one_line(version.get("version")))
        + (" (default)" if version.get("is_default") else "")
        + "</li>"
        for version in named
    ]
    return ["      <h2>Versions</h2>", "      <ul>", *items, "      </ul>"]


def links_summary(detail: dict) -> list[str]:
    if not detail:
        return []
    items = []
    if detail.get("url"):
        items.append(
            f'        <li><a href="{html.escape(detail["url"], quote=True)}">Home page</a></li>'
        )
    if detail.get("docs_url"):
        items.append(
            f'        <li><a href="{html.escape(detail["docs_url"], quote=True)}">Documentation</a></li>'
        )
    if detail.get("github_repo"):
        repo = html.escape(one_line(detail["github_repo"]), quote=True)
        items.append(
            f'        <li><a href="https://github.com/{repo}">GitHub repository</a></li>'
        )
    if detail.get("paper_doi"):
        doi = html.escape(one_line(detail["paper_doi"]), quote=True)
        items.append(
            f'        <li><a href="https://doi.org/{doi}">Publication (DOI)</a></li>'
        )
    if detail.get("license"):
        items.append(
            f"        <li>License: {html.escape(one_line(detail['license']))}</li>"
        )
    citation = one_line(detail.get("citation_markdown"))
    if citation:
        items.append(f"        <li>Cite as: {html.escape(citation)}</li>")
    if not items:
        return []
    return ["      <h2>Links</h2>", "      <ul>", *items, "      </ul>"]


def params_summary(tool: dict) -> list[str]:
    params = [param for param in (tool.get("params") or []) if param.get("name")]
    if not params:
        return []
    items = []
    for param in params:
        name = one_line(param.get("name"))
        kind = one_line(param.get("param_type")) or "str"
        line = f"<strong>{html.escape(name)}</strong> ({html.escape(kind)}"
        if param.get("multiple"):
            line += ", multiple"
        line += ")"
        if param.get("required"):
            line += " required"
        description = one_line(param.get("description"))
        if description:
            line += f": {html.escape(description)}"
        options = [one_line(option) for option in (param.get("options") or []) if option]
        if options:
            shown = ", ".join(html.escape(option) for option in options[:MAX_OPTIONS])
            remaining = len(options) - MAX_OPTIONS
            # The description may already end in a full stop.
            line += " " if line.endswith(".") else ". "
            line += f"Options: {shown}"
            if remaining > 0:
                line += f" and {remaining} more"
        items.append(f"        <li>{line}</li>")
    return ["      <h2>Parameters</h2>", "      <ul>", *items, "      </ul>"]


def render(shell: str, tool: dict, versions: list[dict], detail: dict) -> str:
    name = one_line(tool.get("name")) or "Tool"
    description = one_line(tool.get("description")) or PORTAL_DESCRIPTION
    title = f"{name} | {PORTAL_NAME}"
    image = absolute(tool.get("image")) or FALLBACK_IMAGE
    path = tool_path(name)
    canonical = f"{SITE_URL}{path}" if SITE_URL else None
    tags = [tag for tag in (tool.get("tags") or []) if tag]
    version = one_line(tool.get("version"))

    # Social cards: og:* for Facebook, LinkedIn and Slack, twitter:* for X.
    properties = {
        "og:type": "website",
        "og:site_name": PORTAL_NAME,
        "og:title": title,
        "og:description": description,
        "twitter:card": "summary_large_image",
        "twitter:title": title,
        "twitter:description": description,
    }
    if canonical:
        properties["og:url"] = canonical
    if image:
        properties["og:image"] = image
        properties["twitter:image"] = image

    # What a crawler that runs no JavaScript reads, in place of the app.
    summary = [
        f"      <h1>{html.escape(name)}</h1>",
        f"      <p>{html.escape(description)}</p>",
    ]
    summary.extend(versions_summary(tool, versions))
    if tags:
        summary.append(f"      <p>Tags: {html.escape(', '.join(tags))}</p>")
    summary.extend(params_summary(tool))
    summary.extend(links_summary(detail))
    summary.append(
        f'      <p><a href="{html.escape(path, quote=True)}">'
        f"Open {html.escape(name)} in the {PORTAL_NAME}</a>. "
        "Configuring and running a tool needs JavaScript.</p>"
    )

    structured = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": name,
        "description": description,
        "applicationCategory": "ScienceApplication",
        "operatingSystem": "Web",
    }
    if canonical:
        structured["url"] = canonical
    if image:
        structured["image"] = image
    if version:
        structured["softwareVersion"] = version
    if tags:
        structured["keywords"] = ", ".join(tags)
    same_as = [value for value in (detail.get("docs_url"), detail.get("url")) if value]
    if same_as:
        structured["sameAs"] = same_as
    if detail.get("github_repo"):
        structured["codeRepository"] = (
            f"https://github.com/{one_line(detail['github_repo'])}"
        )
    if detail.get("license"):
        structured["license"] = one_line(detail["license"])
    # `</` would end the script element early.
    structured_json = json.dumps(structured, ensure_ascii=False).replace(
        "</", "<\\/"
    )

    head = [meta_tags(properties)]
    if canonical:
        head.append(
            f'    <link rel="canonical" href="{html.escape(canonical, quote=True)}" />'
        )
    head.append(
        f'    <script type="application/ld+json">{structured_json}</script>'
    )

    page = re.sub(
        r"<title>.*?</title>",
        f"<title>{html.escape(title)}</title>",
        shell,
        count=1,
        flags=re.S,
    )
    page = re.sub(
        r'<meta name="description" content="[^"]*"\s*/?>',
        f'<meta name="description" content="{html.escape(description, quote=True)}" />',
        page,
        count=1,
    )
    page = page.replace("</head>", "\n".join(head) + "\n  </head>", 1)
    # Outside #root: React owns that element's children.
    page = page.replace(
        '<div id="root"></div>',
        '<div id="root"></div>\n    <noscript>\n'
        + "\n".join(summary)
        + "\n    </noscript>",
        1,
    )
    return page


def write_page(name: str, page: str) -> None:
    """One file per tool, which nginx serves for /tools/<name> via $uri.html."""
    tools_dir = SITE_DIR / "tools"
    tools_dir.mkdir(parents=True, exist_ok=True)
    (tools_dir / f"{name}.html").write_text(page, encoding="utf-8")


def prune(names: list[str]) -> None:
    """Drop the pages of tools that are no longer listed."""
    tools_dir = SITE_DIR / "tools"
    if not tools_dir.is_dir():
        return
    keep = {f"{name}.html" for name in names}
    for entry in tools_dir.iterdir():
        if entry.name in keep:
            continue
        if entry.is_dir():
            for child in entry.iterdir():
                child.unlink()
            entry.rmdir()
            continue
        entry.unlink()


def write_sitemap(names: list[str]) -> None:
    if not SITE_URL:
        # Locations have to be absolute, so there is nothing to write without
        # knowing where the site is served from.
        return
    locations = [f"{SITE_URL}/"] + [f"{SITE_URL}{tool_path(name)}" for name in names]
    body = "".join(
        f"  <url><loc>{html.escape(location)}</loc></url>\n"
        for location in locations
    )
    (SITE_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}</urlset>\n",
        encoding="utf-8",
    )


def write_robots() -> None:
    lines = ["User-agent: *", "Allow: /"]
    if SITE_URL:
        lines.append(f"Sitemap: {SITE_URL}/sitemap.xml")
    (SITE_DIR / "robots.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def prerender() -> None:
    shell = (SITE_DIR / "index.html").read_text(encoding="utf-8")
    entries = []
    for tool in fetch_tools():
        name = one_line(tool.get("name"))
        # A name is one path segment; anything else cannot be addressed.
        if not name or "/" in name or "\\" in name or name in {".", ".."}:
            continue
        entries.append((name, tool))

    # The tool and its stack are two small requests each, so ask side by side.
    with ThreadPoolExecutor(max_workers=8) as pool:
        stacks = list(pool.map(lambda entry: fetch_versions(entry[0]), entries))
        details = list(pool.map(lambda entry: fetch_tool(entry[0]), entries))

    names = []
    for (name, tool), versions, detail in zip(
        entries, stacks, details, strict=True
    ):
        write_page(name, render(shell, tool, versions, detail))
        names.append(name)
    prune(names)
    write_sitemap(names)
    write_robots()
    print(f"prerendered {len(names)} tool pages", flush=True)


def main() -> None:
    attempts = 0
    while True:
        try:
            prerender()
            attempts = 0
        except Exception as error:  # noqa: BLE001 - nginx serves regardless
            attempts += 1
            print(f"prerender failed: {error}", flush=True)
            if attempts < 20:
                # The API may still be starting up.
                time.sleep(15)
                continue
        if INTERVAL <= 0:
            return
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
