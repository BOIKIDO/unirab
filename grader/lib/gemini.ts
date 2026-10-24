import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// gemini-2.5-flash with Google Search grounding — real web results like a user would see
export async function queryGeminiWithSearch(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearchRetrieval: {} }],
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// gemini-2.5-flash-lite for high-volume audit queries (~20× per report)
export async function queryGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// gemini-2.5-flash for single high-quality calls (narrative, insights)
export async function queryGeminiFlash(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

export async function queryGeminiJSON(prompt: string, timeoutMs = 15000): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini JSON call timed out')), timeoutMs)
    ),
  ])
  return result.response.text()
}
