import OpenAI from 'openai'

let _client: OpenAI | null = null

function getDeepSeek() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: 'https://api.deepseek.com',
      timeout: 180_000, // 3 min — reasoning model can be slow on big prompts
      maxRetries: 0, // we retry ourselves below so we can log
    })
  }
  return _client
}

// deepseek-v4-pro is a reasoning model: it spends tokens on internal
// `reasoning_content` before producing `content`. max_tokens must include
// both, so we give it generous headroom or the actual output comes back empty.
// deepseek-flash: non-reasoning, supports JSON mode (v4-pro burns its token
// budget on reasoning_content and returns empty content in JSON mode)
const MODEL = 'deepseek-flash'

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[deepseek] ${label} attempt ${i + 1}/${attempts} failed: ${msg}`)
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw lastErr
}

export async function queryDeepSeek(prompt: string): Promise<string> {
  return withRetry('queryDeepSeek', async () => {
    const res = await getDeepSeek().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
    })
    return res.choices[0]?.message?.content ?? ''
  })
}

export async function queryDeepSeekJSON(prompt: string): Promise<string> {
  return withRetry('queryDeepSeekJSON', async () => {
    const res = await getDeepSeek().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.2,
    })
    const raw = res.choices[0]?.message?.content ?? '{}'
    // Validate it's parseable JSON — DeepSeek may not support json_object natively
    try { JSON.parse(raw) } catch {
      console.error('[deepseek] json_object response was not valid JSON, retrying...')
      throw new Error('Invalid JSON response from DeepSeek')
    }
    return raw
  })
}
