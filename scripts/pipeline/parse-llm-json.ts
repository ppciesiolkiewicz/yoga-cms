export function parseLlmJson<T = unknown>(raw: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim()

  const candidates = [stripped, extractFirstJson(stripped)].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  )

  let firstError: unknown
  for (const candidate of candidates) {
    for (const attempt of [candidate, stripTrailingCommas(candidate)]) {
      try {
        return JSON.parse(attempt) as T
      } catch (err) {
        if (firstError === undefined) firstError = err
      }
    }
  }
  throw firstError
}

function extractFirstJson(input: string): string | null {
  const start = input.search(/[{[]/)
  if (start < 0) return null

  const open = input[start]
  const close = open === "{" ? "}" : "]"
  let depth = 0
  let inString = false
  let stringQuote = ""
  let escaped = false

  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === stringQuote) inString = false
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return input.slice(start, i + 1)
    }
  }
  return null
}

function stripTrailingCommas(input: string): string {
  let out = ""
  let inString = false
  let stringQuote = ""
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === stringQuote) {
        inString = false
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      out += ch
      continue
    }

    if (ch === ",") {
      let j = i + 1
      while (j < input.length && /\s/.test(input[j])) j++
      if (input[j] === "}" || input[j] === "]") continue
    }

    out += ch
  }

  return out
}
