"use client"

import { type ChangeEvent } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Checkbox } from "@/components/ui/Checkbox"
import { Card } from "@/components/ui/Card"

export interface CategoryDraft {
  id: string
  name: string
  extraInfo: string
  prompt: string
  wappalyzer: boolean
  lighthouse: boolean
  removable: boolean
}

export function CategoriesSection({
  categories,
  onAdd,
  onRemove,
  onUpdate,
}: {
  categories: CategoryDraft[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<CategoryDraft>) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button variant="secondary" onClick={onAdd}>+ Add category</Button>
      </div>
      <div className="space-y-3">
        {categories.map((cat) => (
          <Card key={cat.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={cat.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate(cat.id, { name: e.target.value })}
                    placeholder="Category name"
                    className="w-48"
                    disabled={!cat.removable}
                  />
                  <Input
                    value={cat.extraInfo}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate(cat.id, { extraInfo: e.target.value })}
                    placeholder="Extra info (keywords, description)"
                    className="flex-1"
                  />
                </div>
                <Textarea
                  value={cat.prompt}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onUpdate(cat.id, { prompt: e.target.value })}
                  placeholder="Assessment prompt..."
                  rows={3}
                  className="w-full"
                />
                <div className="flex gap-4">
                  <Checkbox
                    label="Wappalyzer"
                    checked={cat.wappalyzer}
                    onCheckedChange={(v: boolean) => onUpdate(cat.id, { wappalyzer: v })}
                  />
                  <Checkbox
                    label="Lighthouse"
                    checked={cat.lighthouse}
                    onCheckedChange={(v: boolean) => onUpdate(cat.id, { lighthouse: v })}
                  />
                </div>
              </div>
              {cat.removable && (
                <Button variant="ghost" onClick={() => onRemove(cat.id)} className="text-red-500 hover:text-red-700">
                  &times;
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
