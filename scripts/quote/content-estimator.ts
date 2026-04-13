export interface ContentEstimate {
  url: string
  charCount: number
}

export interface ContentEstimatorService {
  estimatePages(urls: string[]): Promise<ContentEstimate[]>
}

const MOCK_CHAR_COUNT = 5000

export class MockContentEstimator implements ContentEstimatorService {
  async estimatePages(urls: string[]): Promise<ContentEstimate[]> {
    return urls.map(url => ({
      url,
      charCount: MOCK_CHAR_COUNT,
    }))
  }
}
