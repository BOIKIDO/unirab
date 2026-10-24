import { searchWeb } from '../lib/tavily'
import { queryGemini } from '../lib/gemini'
import { getOpenAI } from '../lib/openai'

const TARGET = 'hoboken general contractor'
const QUERIES = [
  'Who are the best general contractor companies in Hoboken, NJ? Give me specific local business names, not national chains. List 3-5 real companies.',
  'Who are the best basement finishing companies in Hoboken, NJ? Give me specific local business names. List 3-5 real companies.',
  'Who are the best home addition companies in Hoboken, NJ? Give me specific local business names. List 3-5 real companies.',
]

async function main() {
  const openai = getOpenAI()

  for (const prompt of QUERIES) {
    console.log(`\nQuery: "${prompt.slice(0, 60)}..."`)
    const webContext = await searchWeb(prompt)

    // ChatGPT lane
    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Analyze web search results to answer questions about local businesses. Base your answer only on the provided search results.' },
        { role: 'user', content: `Search results:\n${webContext}\n\nQuestion: ${prompt}\n\nList the specific local businesses mentioned in these search results.` },
      ],
      max_tokens: 300,
      temperature: 0.3,
    })
    const chatText = chatRes.choices[0]?.message?.content ?? ''
    const chatHit = chatText.toLowerCase().includes(TARGET)

    // Gemini lane
    const geminiText = await queryGemini(prompt)
    const geminiHit = geminiText.toLowerCase().includes(TARGET)

    console.log(`  ChatGPT: ${chatHit ? '✓ FOUND' : '✗ not found'}`)
    console.log(`  Gemini:  ${geminiHit ? '✓ FOUND' : '✗ not found'}`)
    if (chatHit || geminiHit) {
      if (chatHit) {
        const line = chatText.split('\n').find(l => /hoboken general contractor/i.test(l))
        console.log(`    GPT > ${line?.trim().slice(0, 120)}`)
      }
      if (geminiHit) {
        const line = geminiText.split('\n').find(l => /hoboken general contractor/i.test(l))
        console.log(`    GEM > ${line?.trim().slice(0, 120)}`)
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
