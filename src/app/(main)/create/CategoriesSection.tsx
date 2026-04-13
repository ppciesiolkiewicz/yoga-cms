"use client"

import { type ChangeEvent, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Checkbox } from "@/components/ui/Checkbox"
import { Card } from "@/components/ui/Card"
import { Collapsible } from "@/components/ui/Collapsible"
import { Modal, ModalTitle, ModalDescription, ModalClose } from "@/components/ui/Modal"

export interface CategoryDraft {
  id: string
  name: string
  extraInfo: string
  prompt: string
  model: "haiku" | "sonnet" | "opus"
  wappalyzer: boolean
  lighthouse: boolean
  removable: boolean
  enabled: boolean
}

export interface CategoryTemplate {
  name: string
  description: string
  extraInfo: string
  prompt: string
  wappalyzer: boolean
  lighthouse: boolean
}

export const categoryTemplates: CategoryTemplate[] = [
  {
    name: "Pricing",
    description: "Pricing pages, plans, and rate cards",
    extraInfo: "pricing, plans, rates, packages, cost, fees",
    prompt: "Extract pricing tiers, plan names, prices, billing frequency, and what's included in each tier. Note any free trials, money-back guarantees, or enterprise/custom pricing options. Summarize how pricing is structured and whether it's easy to compare options.",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "Services",
    description: "Service offerings and descriptions",
    extraInfo: "services, offerings, what we do, solutions",
    prompt: "List each service or offering with its description, target audience, and any stated outcomes or benefits. Note how services are organized and whether there are clear next steps for interested visitors.",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "About",
    description: "About the company, team, and mission",
    extraInfo: "about, team, our story, mission, values, who we are",
    prompt: "Summarize the company story, mission, and values. List key team members with their roles. Note founding year, location, company size if mentioned, and any unique differentiators or credentials highlighted.",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "Blog",
    description: "Blog posts, articles, and news",
    extraInfo: "blog, articles, news, insights, resources, posts",
    prompt: "Summarize the blog's main topics, posting frequency, and content quality. List recent post titles with dates. Note whether posts have authors, categories, and engagement signals (comments, shares).",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "FAQ",
    description: "Frequently asked questions and help pages",
    extraInfo: "faq, frequently asked questions, help, support, knowledge base",
    prompt: "Extract all questions and their answers. Group by topic if categories exist. Note how comprehensive the FAQ is and whether it addresses common buyer concerns like pricing, refunds, support, and getting started.",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "Testimonials",
    description: "Reviews, testimonials, and case studies",
    extraInfo: "testimonials, reviews, case studies, success stories, clients",
    prompt: "Extract testimonials with the reviewer's name, role, company, and quote. For case studies, summarize the challenge, solution, and results. Note any ratings, metrics, or before/after comparisons.",
    wappalyzer: false,
    lighthouse: false,
  },
  {
    name: "Careers",
    description: "Job openings and career information",
    extraInfo: "careers, jobs, openings, hiring, work with us, join us",
    prompt: "List open positions with title, department, location, and employment type. Summarize company culture highlights, benefits, and perks mentioned. Note the application process and any stated values around workplace culture.",
    wappalyzer: false,
    lighthouse: false,
  },
]

function BuiltInCategory({
  cat,
  onUpdate,
}: {
  cat: CategoryDraft
  onUpdate: (id: string, patch: Partial<CategoryDraft>) => void
}) {
  const description = cat.name.toLowerCase() === "home"
    ? "Analyzes the homepage URL for each site"
    : "Looks for contact, about, and location pages"

  const features = [
    cat.wappalyzer && "Wappalyzer",
    cat.lighthouse && "Lighthouse",
  ].filter((f): f is string => !!f)

  return (
    <Card className="p-0 overflow-hidden">
      <Collapsible
        trigger={
          <div className="flex items-center gap-3 px-4 py-3 w-full">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                label=""
                checked={cat.enabled}
                onCheckedChange={(v: boolean) => onUpdate(cat.id, { enabled: v })}
              />
            </div>
            <div className="flex-1 flex items-center gap-2 text-left" onClick={(e) => e.stopPropagation()}>
              <Input
                value={cat.name}
                disabled
                className="w-32"
              />
              <span className="text-xs text-foreground-faint">{description}</span>
            </div>
            {features.length > 0 && (
              <div className="flex gap-1">
                {features.map((f) => (
                  <span key={f} className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-foreground-muted">{f}</span>
                ))}
              </div>
            )}
          </div>
        }
        className="w-full"
      >
        <div className="space-y-2 border-t border-border-subtle px-4 py-3">
          {cat.name.toLowerCase() !== "home" && (
            <div>
              <Input
                value={cat.extraInfo}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate(cat.id, { extraInfo: e.target.value })}
                placeholder="Keywords to help classify pages into this category"
                className="w-full"
              />
              <span className="mt-0.5 block text-xs text-foreground-faint">
                Used to match navigation links to this category
              </span>
            </div>
          )}
          <div>
            <Textarea
              value={cat.prompt}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onUpdate(cat.id, { prompt: e.target.value })}
              placeholder="Describe what information to extract and how to summarize it"
              rows={3}
              className="w-full"
            />
            <span className="mt-0.5 block text-xs text-foreground-faint">
              Tell the AI what to look for and how to summarize the page content
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-foreground-faint">Model</span>
              <select
                value={cat.model}
                onChange={(e) => onUpdate(cat.id, { model: e.target.value as CategoryDraft["model"] })}
                className="h-7 rounded border border-accent-fg/30 bg-surface px-1.5 text-xs text-foreground hover:border-accent-fg/50 focus:border-accent-fg focus:ring-1 focus:ring-accent-fg/30 focus:outline-none"
              >
                <option value="haiku">Haiku</option>
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
              </select>
            </div>
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
            <span className="text-xs text-foreground-faint self-center">Run tech detection / performance audit for this category</span>
          </div>
        </div>
      </Collapsible>
    </Card>
  )
}

function CustomCategory({
  cat,
  onUpdate,
  onRemove,
}: {
  cat: CategoryDraft
  onUpdate: (id: string, patch: Partial<CategoryDraft>) => void
  onRemove: (id: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="w-48">
              <Input
                value={cat.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate(cat.id, { name: e.target.value })}
                placeholder="Category name"
                className="w-full"
              />
              <span className="mt-0.5 block text-xs text-foreground-faint">
                Short label (e.g. &quot;Pricing&quot;, &quot;Services&quot;)
              </span>
            </div>
            <div className="w-28">
              <select
                value={cat.model}
                onChange={(e) => onUpdate(cat.id, { model: e.target.value as CategoryDraft["model"] })}
                className="h-9 w-full rounded-md border border-accent-fg/30 bg-surface px-2 text-sm text-foreground hover:border-accent-fg/50 focus:border-accent-fg focus:ring-1 focus:ring-accent-fg/30 focus:outline-none"
              >
                <option value="haiku">Haiku</option>
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
              </select>
              <span className="mt-0.5 block text-xs text-foreground-faint">
                AI model
              </span>
            </div>
            <div className="flex-1">
              <Input
                value={cat.extraInfo}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate(cat.id, { extraInfo: e.target.value })}
                placeholder="Keywords to help classify pages into this category"
                className="w-full"
              />
              <span className="mt-0.5 block text-xs text-foreground-faint">
                Used to match navigation links to this category
              </span>
            </div>
          </div>
          <div>
            <Textarea
              value={cat.prompt}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onUpdate(cat.id, { prompt: e.target.value })}
              placeholder="Describe what information to extract and how to summarize it"
              rows={3}
              className="w-full"
            />
            <span className="mt-0.5 block text-xs text-foreground-faint">
              Tell the AI what to look for and how to summarize the page content
            </span>
          </div>
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
            <span className="text-xs text-foreground-faint self-center">Run tech detection / performance audit for this category</span>
          </div>
        </div>
        <Button variant="ghost" onClick={() => onRemove(cat.id)} className="text-error hover:text-error">
          &times;
        </Button>
      </div>
    </Card>
  )
}

export function CategoriesSection({
  categories,
  onAdd,
  onRemove,
  onUpdate,
}: {
  categories: CategoryDraft[]
  onAdd: (template?: CategoryTemplate) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<CategoryDraft>) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const builtIn = categories.filter((c) => !c.removable)
  const custom = categories.filter((c) => c.removable)
  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()))

  function handleSelect(template?: CategoryTemplate) {
    onAdd(template)
    setModalOpen(false)
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>Add category</Button>
      </div>
      <p className="mb-4 text-sm text-foreground-muted">
        What types of pages to look for on each site.
      </p>

      <div className="space-y-2 mb-4">
        {builtIn.map((cat) => (
          <BuiltInCategory key={cat.id} cat={cat} onUpdate={onUpdate} />
        ))}
      </div>

      {custom.length > 0 && (
        <div className="space-y-3">
          {custom.map((cat) => (
            <CustomCategory key={cat.id} cat={cat} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <div className="p-6">
          <ModalTitle>Add Category</ModalTitle>
          <ModalDescription className="mt-1">
            Choose a template to get started, or create a blank category.
          </ModalDescription>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelect()}
              className="rounded-lg border-2 border-accent-muted bg-accent-subtle p-3 text-left transition-colors hover:border-focus hover:bg-surface-raised"
            >
              <div className="text-sm font-medium text-accent-fg">Blank category</div>
              <div className="mt-0.5 text-xs text-accent-fg">Start from scratch with your own settings</div>
            </button>
            {categoryTemplates
              .slice()
              .sort((a, b) => {
                const aAdded = existingNames.has(a.name.toLowerCase()) ? 1 : 0
                const bAdded = existingNames.has(b.name.toLowerCase()) ? 1 : 0
                return aAdded - bAdded
              })
              .map((t) => {
                const alreadyAdded = existingNames.has(t.name.toLowerCase())
                return (
                  <button
                    key={t.name}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => handleSelect(t)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      alreadyAdded
                        ? "cursor-not-allowed border-border-subtle bg-surface-alt/60 text-foreground-faint"
                        : "border-border-default bg-surface shadow-sm hover:border-accent-muted hover:bg-accent-subtle hover:shadow"
                    }`}
                  >
                    <div className={`text-sm font-medium ${alreadyAdded ? "text-foreground-faint" : "text-foreground"}`}>
                      {t.name}
                      {alreadyAdded && <span className="ml-1.5 text-xs font-normal text-foreground-faint">added</span>}
                    </div>
                    <div className={`mt-0.5 text-xs ${alreadyAdded ? "text-foreground-faint" : "text-foreground-muted"}`}>{t.description}</div>
                  </button>
                )
              })}
          </div>

          <div className="mt-4 flex justify-end border-t border-border-subtle pt-4">
            <ModalClose>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
          </div>
        </div>
      </Modal>
    </section>
  )
}
