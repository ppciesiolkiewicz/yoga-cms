import { describe, it, expect } from "vitest"
import { htmlToMarkdown, extractLinks } from "./playwright-scraper"

describe("htmlToMarkdown", () => {
  it("converts headings and paragraphs to markdown", () => {
    const html = "<html><body><h1>Title</h1><p>Hello <strong>world</strong></p></body></html>"
    const md = htmlToMarkdown(html, false)
    expect(md).toContain("# Title")
    expect(md).toContain("**world**")
  })

  it("strips script and style tags", () => {
    const html = "<html><body><script>alert(1)</script><style>.x{}</style><p>Keep me</p></body></html>"
    const md = htmlToMarkdown(html, false)
    expect(md).not.toContain("alert")
    expect(md).not.toContain(".x{}")
    expect(md).toContain("Keep me")
  })

  it("extracts only main content when onlyMainContent is true", () => {
    const html = `<html><body>
      <nav>Navigation</nav>
      <main><h1>Main Content</h1><p>Body text</p></main>
      <footer>Footer</footer>
    </body></html>`
    const md = htmlToMarkdown(html, true)
    expect(md).toContain("Main Content")
    expect(md).not.toContain("Navigation")
    expect(md).not.toContain("Footer")
  })

  it("falls back to body when no main/article element and onlyMainContent is true", () => {
    const html = "<html><body><h1>Title</h1><p>Text</p></body></html>"
    const md = htmlToMarkdown(html, true)
    expect(md).toContain("Title")
  })
})

describe("extractLinks", () => {
  it("extracts absolute href values", () => {
    const html = `<html><body>
      <a href="https://example.com/about">About</a>
      <a href="https://example.com/contact">Contact</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com/about", "https://example.com/contact"])
  })

  it("skips fragment-only and javascript: links", () => {
    const html = `<html><body>
      <a href="#section">Jump</a>
      <a href="javascript:void(0)">Click</a>
      <a href="https://example.com">Real</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com"])
  })

  it("deduplicates links", () => {
    const html = `<html><body>
      <a href="https://example.com">One</a>
      <a href="https://example.com">Two</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com"])
  })
})
