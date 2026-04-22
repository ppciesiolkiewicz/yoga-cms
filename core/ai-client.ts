import Anthropic from "@anthropic-ai/sdk"
import Groq from "groq-sdk"

export type Provider = "anthropic" | "groq"

export interface CompleteRequest {
  model: string
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  maxTokens: number
}

export interface CompleteResponse {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "done" }

export abstract class AIClient {
  abstract readonly provider: Provider
  abstract complete(req: CompleteRequest): Promise<CompleteResponse>
  abstract stream(req: CompleteRequest): AsyncIterable<StreamEvent>
}

class AnthropicClient extends AIClient {
  readonly provider: Provider = "anthropic"
  private client = new Anthropic()

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const res = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    return {
      text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    }
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamEvent> {
    const stream = this.client.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    })
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        yield { type: "text", delta: ev.delta.text }
      }
    }
    yield { type: "done" }
  }
}

class GroqClient extends AIClient {
  readonly provider: Provider = "groq"
  private client = new Groq()

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
    })
    const text = res.choices[0]?.message?.content ?? ""
    return {
      text,
      usage: {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      },
    }
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      stream: true,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
    })
    for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield { type: "text", delta }
    }
    yield { type: "done" }
  }
}

const cache: Partial<Record<Provider, AIClient>> = {}

export function getClient(provider: Provider): AIClient {
  if (!cache[provider]) {
    cache[provider] = provider === "anthropic" ? new AnthropicClient() : new GroqClient()
  }
  return cache[provider]!
}
