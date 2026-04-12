import type { AnalyzeInput } from "../../../scripts/core/types"
import { Card } from "@/components/ui/Card"

export function ReviewSection({ input }: { input: AnalyzeInput }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Review</h2>
      <Card className="p-4">
        <pre className="overflow-x-auto text-xs text-gray-800">
          {JSON.stringify(input, null, 2)}
        </pre>
      </Card>
    </section>
  )
}
