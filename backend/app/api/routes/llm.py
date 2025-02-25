import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from google import genai
from jinja2 import Environment as JinjaEnvironment

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import File, Run

router = APIRouter()


def get_file_content_for_prompt(file: File, threshold: int = 10000) -> str:
    """
    Get the content of a file for use in a prompt.
    """
    supported_types = ["text", "tsv", "csv", "json"]
    # Only process if the file type is supported
    if file.file_type in supported_types:
        # If the file is too big, provide a head+tail preview
        if file.size > threshold:
            half_preview = threshold // 2
            with open(file.location, "rb") as f:
                # Read the first half of the preview
                head = f.read(half_preview)
                # Seek to the last half_preview bytes of the file
                f.seek(max(file.size - half_preview, 0))
                tail = f.read(half_preview)
            # Decode bytes to string (handling any decoding issues)
            head_decoded = head.decode("utf-8", errors="replace")
            tail_decoded = tail.decode("utf-8", errors="replace")
            return (
                head_decoded +
                "\n\n[...truncated...]\n\n" +
                tail_decoded +
                f"\n\n[Preview truncated: file size is {file.size} bytes, showing first {half_preview} bytes and last {half_preview} bytes.]"
            )
        else:
            # For smaller files, read the entire content in text mode
            with open(file.location, encoding="utf-8") as f:
                return f.read()
    return "File type not supported, content not included."




@router.post("/summary/{run_id}", response_model=str)
async def generate_run_summary(
    session: SessionDep,
    current_user: CurrentUser,
    run_id: uuid.UUID,
) -> Any:
    """
    Generate run summary using AI.
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Summary generation is disabled")
    # Counting for pagination
    run: Run = session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if run.tool.llm_summary_enabled is False:
        raise HTTPException(status_code=400, detail="Summary generation is disabled for this tool")
    if run.status in ["pending", "running"]:
        raise HTTPException(status_code=400, detail="Run is not finished yet")
    if run.llm_summary:
        return run.llm_summary


    default_prompt = """
    --- Description ---
    {{ name }}
    {{ description }}
    --- COMMAND ---
    {{ command }}
    --- STATUS ---
    {{ status }}
    --- LOGS ---
    {{ logs }}
    --- RESULTS ---
    {% for result in results %}
    --- {{ result["name"] }} ---
    {{ result["content"] }}
    {% endfor %}
    --- RULES ---
    1. Remove any UUIDs from the report.
    2. Only return Markdown.
    3. Include a plain language summary of results.
    4. If required suggest follow-up steps.
    5. Start with an informative title.
    """

    env = JinjaEnvironment()
    template = env.from_string(default_prompt)
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    results = []
    for file in run.files:
        content = get_file_content_for_prompt(file)
        results.append({"name": file.name, "content": content})
    prompt = template.render(
        name=run.tool.name,
        description=run.tool.description,
        command=run.command,
        status=run.status,
        logs=run.stdout,
        results=results,
    )
    print(prompt)
    try:
        response = await client.aio.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    system_instruction="Acting as bioinformatics expert generate a short summary report of the following analysis."
                )
            )
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Failed to generate summary. Please try again later.")
    run.llm_summary = response.text
    session.add(run)
    session.commit()
    return response.text
