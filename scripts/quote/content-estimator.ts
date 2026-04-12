export interface ContentEstimate {
  url: string
  charCount: number
}

export interface ContentEstimatorService {
  estimatePages(urls: string[]): Promise<ContentEstimate[]>
}

export class MockContentEstimator implements ContentEstimatorService {
  async estimatePages(urls: string[]): Promise<ContentEstimate[]> {
    return urls.map(url => ({
      url,
      charCount: 3000 + Math.floor(Math.random() * 5000),
    }))
  }
}
