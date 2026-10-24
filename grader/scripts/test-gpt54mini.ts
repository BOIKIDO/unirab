import { getOpenAI } from '../lib/openai'

async function main() {
  const openai = getOpenAI()

  // Try via Responses API (newer models live here)
  try {
    const res = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: 'Who are the best general contractor companies in Hoboken, NJ? List 3-5 real local businesses.',
    })
    console.log('✓ gpt-5.4-mini (Responses API)')
    console.log(res.output_text)
  } catch (e: unknown) {
    const err = e as { status?: number; error?: { message?: string } }
    console.log(`✗ gpt-5.4-mini (Responses API): ${err.status} — ${err.error?.message}`)
  }

  // Also try chat completions just in case
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: 'Who are the best general contractor companies in Hoboken, NJ? List 3-5 real local businesses.' }],
      max_tokens: 300,
    })
    console.log('✓ gpt-5.4-mini (Chat Completions)')
    console.log(res.choices[0]?.message?.content)
  } catch (e: unknown) {
    const err = e as { status?: number; error?: { message?: string } }
    console.log(`✗ gpt-5.4-mini (Chat Completions): ${err.status} — ${err.error?.message}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
