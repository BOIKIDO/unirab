import { tavily } from '@tavily/core'

let client: ReturnType<typeof tavily> | null = null

function getClient() {
  if (!client) client = tavily({ apiKey: process.env.TAVILY_API_KEY! })
  return client
}

export async function searchWeb(query: string): Promise<string> {
  const data = await getClient().search(query, {
    searchDepth: 'basic',
    maxResults: 5,
    includeAnswer: true,
    timeout: 15000, // 15s timeout — don't hang the worker
  })

  const parts: string[] = []

  if (data.answer) parts.push(`Summary: ${data.answer}`)

  const snippets = data.results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join('\n\n')

  if (snippets) parts.push(`Web results:\n${snippets}`)

  return parts.join('\n\n')
}
