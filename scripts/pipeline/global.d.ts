declare module "wappalyzer-core" {
  const wappalyzer: {
    setTechnologies(technologies: unknown): void
    setCategories(categories: unknown): void
    analyze(options: {
      url: string
      meta: Record<string, string[]>
      headers: Record<string, string[]>
      scriptSrc: string[]
      cookies: Array<{ name: string; value?: string }>
      html: string
    }): Promise<unknown[]>
    resolve(detections: unknown[]): unknown[]
  }
  export default wappalyzer
}
