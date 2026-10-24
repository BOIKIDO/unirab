import OpenAI from 'openai'

let _client: OpenAI | null = null
export function getOpenAI() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export const openai = new Proxy({} as OpenAI, {
  get(_, prop) { return getOpenAI()[prop as keyof OpenAI] },
})

export async function queryOpenAI(prompt: string): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.3,
  })
  return res.choices[0]?.message?.content ?? ''
}

// gpt-4o-search-preview — real web search, like a user on ChatGPT
export async function queryOpenAISearch(prompt: string): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-search-preview',
    messages: [{ role: 'user', content: prompt }],
    web_search_options: {},
  })
  return res.choices[0]?.message?.content ?? ''
}
