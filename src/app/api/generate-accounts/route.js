import { NextResponse } from 'next/server'
import { scrapeCompanies } from '../../../utils/apify'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function extractMessageContent(messageContent) {
  if (typeof messageContent === 'string') return messageContent

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
  }

  return ''
}

function parseAccounts(content) {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function POST(req) {
  try {
    const { keyword, location, signal } = await req.json()

    if (!keyword || !location || !signal) {
      return NextResponse.json(
        { error: 'Keyword, location, and signal are required.' },
        { status: 400 }
      )
    }

    const companies = await scrapeCompanies(keyword, location)

    console.log('Scraped companies:', companies)

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENROUTER_API_KEY environment variable.' },
        { status: 500 }
      )
    }

  const prompt = `
  You are enriching real company data for outbound targeting.

  Search keyword:
  ${keyword}

  Search location:
  ${location}

  Signal:
  ${signal}

  For each company:
  - DO NOT change or remove existing fields
  - Add:
    - industry
    - reason (why they are a good target)
    - score (1–10 based on targeting strength)

  Use available signals like rating, reviews, keyword relevance, and location.

  Companies:
  ${JSON.stringify(companies, null, 2)}

  Return STRICT JSON array with SAME structure + added fields:

  [
    {
      "name": "",
      "address": "",
      "city": "",
      "rating": "",
      "reviews": "",
      "website": "",
      "phone": "",
      "postalCode": "",
      "industry": "",
      "reason": "",
      "score": ""
    }
  ]
  `

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return NextResponse.json(
        { error: 'OpenRouter request failed.', details: errorBody },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = extractMessageContent(data?.choices?.[0]?.message?.content) || '[]'

    let parsed = parseAccounts(content)

    if (!Array.isArray(parsed)) {
      parsed = companies.map((company) => ({
        ...company,
        industry: 'Unknown',
        reason: `Potential fit for "${keyword}" in ${location}.`,
        score: '',
      }))
    }

    return NextResponse.json(parsed)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate accounts.', details: error.message },
      { status: 500 }
    )
  }
}
