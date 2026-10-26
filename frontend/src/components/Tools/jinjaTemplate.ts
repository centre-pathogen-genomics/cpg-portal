/**
 * Tokenise a Jinja2 template enough to highlight it and to tell which
 * parameters a command uses.
 *
 * The templates tool authors write are arbitrary Jinja, so this is a scanner
 * rather than a parser: it tracks the delimiters, string literals, filters and
 * loop/set variables, and marks the identifiers that name a tool parameter.
 */

export type JinjaToken =
  | { kind: "text"; text: string }
  | { kind: "delimiter"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "operator"; text: string }
  | { kind: "literal"; text: string }
  | { kind: "keyword"; text: string }
  | { kind: "filter"; text: string }
  /** An identifier, with `param` set when it names a tool parameter. */
  | { kind: "name"; text: string; param?: string }

const KEYWORDS: Record<string, true> = {
  and: true,
  as: true,
  block: true,
  call: true,
  do: true,
  else: true,
  elif: true,
  endblock: true,
  endcall: true,
  endfilter: true,
  endfor: true,
  endif: true,
  endmacro: true,
  endraw: true,
  endset: true,
  endwith: true,
  extends: true,
  false: true,
  filter: true,
  for: true,
  from: true,
  if: true,
  import: true,
  in: true,
  include: true,
  is: true,
  loop: true,
  macro: true,
  none: true,
  not: true,
  null: true,
  or: true,
  raw: true,
  recursive: true,
  self: true,
  set: true,
  true: true,
  with: true,
}

const isIdentifierStart = (character: string) => /[A-Za-z_]/.test(character)
const isIdentifierPart = (character: string) => /[A-Za-z0-9_]/.test(character)

function nextDelimiter(template: string, from: number): number {
  for (let index = from; index < template.length - 1; index += 1) {
    if (template[index] !== "{") continue
    const next = template[index + 1]
    if (next === "{" || next === "%" || next === "#") return index
  }
  return -1
}

/** The names a `{% for a, b in … %}` or `{% set x = … %}` introduces. */
function declaredNames(words: string[]): string[] {
  const head = words[0]
  if (head === "for") {
    const names: string[] = []
    for (const word of words.slice(1)) {
      if (word === "in") break
      if (isIdentifierStart(word[0])) names.push(word)
    }
    return names
  }
  if (
    head === "set" &&
    words[2] === "=" &&
    isIdentifierStart(words[1]?.[0] ?? "")
  ) {
    return [words[1]]
  }
  return []
}

function tokenizeBlock(
  body: string,
  paramNames: Set<string>,
  locals: Set<string>,
  statement: boolean,
): JinjaToken[] {
  const tokens: JinjaToken[] = []
  const words: string[] = []
  let index = 0

  while (index < body.length) {
    const character = body[index]
    if (character === '"' || character === "'") {
      let end = index + 1
      while (end < body.length && body[end] !== character) end += 1
      const text = body.slice(index, Math.min(end + 1, body.length))
      tokens.push({ kind: "literal", text })
      index += text.length
      continue
    }
    if (/[0-9]/.test(character)) {
      let end = index
      while (end < body.length && /[0-9._]/.test(body[end])) end += 1
      tokens.push({ kind: "literal", text: body.slice(index, end) })
      index = end
      continue
    }
    if (isIdentifierStart(character)) {
      let end = index
      while (end < body.length && isIdentifierPart(body[end])) end += 1
      const text = body.slice(index, end)
      const previous = [...tokens]
        .reverse()
        .find((token) => token.kind !== "text")
      const afterPipe =
        previous?.kind === "operator" && previous.text.trim() === "|"
      const afterDot =
        previous?.kind === "operator" && previous.text.trim().endsWith(".")
      if (afterPipe) {
        tokens.push({ kind: "filter", text })
      } else if (afterDot) {
        tokens.push({ kind: "name", text })
      } else if (KEYWORDS[text]) {
        tokens.push({ kind: "keyword", text })
        words.push(text)
      } else {
        tokens.push({
          kind: "name",
          text,
          param: paramNames.has(text) && !locals.has(text) ? text : undefined,
        })
        words.push(text)
      }
      index = end
      continue
    }
    let end = index
    while (
      end < body.length &&
      !isIdentifierStart(body[end]) &&
      !/[0-9]/.test(body[end]) &&
      body[end] !== '"' &&
      body[end] !== "'"
    ) {
      end += 1
    }
    tokens.push({ kind: "operator", text: body.slice(index, end) })
    index = end
  }

  if (statement) {
    // `{% for item in items %}` names a loop variable that shadows a parameter
    // of the same name; `{% endfor %}` gives the name back.
    const head = words[0]
    if (head === "for" || head === "set") {
      for (const name of declaredNames(words)) {
        locals.add(name)
        for (const token of tokens) {
          if (token.kind === "name" && token.text === name) {
            token.param = undefined
          }
        }
      }
    }
  }

  return tokens
}

export function tokenizeJinja(
  template: string,
  paramNames: string[],
): JinjaToken[] {
  const params = new Set(paramNames)
  const locals = new Set<string>()
  const tokens: JinjaToken[] = []
  let index = 0

  while (index < template.length) {
    const start = nextDelimiter(template, index)
    if (start === -1) {
      tokens.push({ kind: "text", text: template.slice(index) })
      break
    }
    if (start > index) {
      tokens.push({ kind: "text", text: template.slice(index, start) })
    }
    const open = template.slice(start, start + 2)
    const close = open === "{{" ? "}}" : open === "{%" ? "%}" : "#}"
    const end = template.indexOf(close, start + 2)
    const bodyEnd = end === -1 ? template.length : end
    const body = template.slice(start + 2, bodyEnd)

    tokens.push({ kind: "delimiter", text: open })
    if (open === "{#") {
      tokens.push({ kind: "comment", text: body })
    } else {
      tokens.push(...tokenizeBlock(body, params, locals, open === "{%"))
    }
    if (end !== -1) tokens.push({ kind: "delimiter", text: close })

    index = end === -1 ? template.length : end + 2
  }

  return tokens
}
