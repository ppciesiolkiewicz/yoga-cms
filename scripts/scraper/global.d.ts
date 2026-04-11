declare module "simple-wappalyzer"
declare module "simple-wappalyzer/src/technologies.json" {
  const value: Record<string, unknown>
  export default value
}
declare module "simple-wappalyzer/src/categories.json" {
  const value: Record<string, unknown>
  export default value
}
declare module "wappalyzer-core" {
  interface Detection {
    technology: unknown
    pattern: unknown
    version?: string
  }
  interface Wappalyzer {
    setTechnologies(technologies: unknown): void
    setCategories(categories: unknown): void
    analyze(input: {
      url?: string
      meta?: Record<string, string[]>
      headers?: Record<string, string[]>
      scriptSrc?: string[]
      scripts?: string[]
      cookies?: Array<{ name: string; value?: string }>
      html?: string
      dom?: unknown
      css?: string
    }): Promise<Detection[]> | Detection[]
    resolve(detections: Detection[]): unknown[]
  }
  const wappalyzer: Wappalyzer
  export default wappalyzer
}
