import { NextResponse } from 'next/server'

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

export async function POST(request) {
  try {
    const { icp, signal } = await request.json()

    if (!icp || !signal) {
      return NextResponse.json(
        { error: 'Both icp and signal are required.' },
        { status: 400 }
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENROUTER_API_KEY environment variable.' },
        { status: 500 }
      )
    }

    const prompt = `Find 20 companies matching ICP and signal.
Return valid JSON only (no markdown, no extra text).

ICP: ${icp}
Signal: ${signal}

For each company include:
- name
- reason (pain hypothesis)
- industry

Include industry explicitly.

Return format:
[
  { "name": "", "reason": "", "industry": "" }
]`

    const response = await fetch(OPENROUTER_URL, {
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

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: 'OpenRouter request failed.', details: errorBody },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = extractMessageContent(data?.choices?.[0]?.message?.content) || '[]'
    let accounts = []

    try {
      accounts = parseAccounts(content)
    } catch {
      accounts = null
    }

    if (!Array.isArray(accounts)) {
      accounts = [
        {
          name: 'Mock Payroll Co',
          reason: `Potential fit for ICP "${icp}" and signal "${signal}".`,
          industry: 'General',
        },
        {
          name: 'Mock People Ops Inc',
          reason: `Likely evaluating alternatives related to "${signal}".`,
          industry: 'General',
        },
      ]
    }

    const normalizedAccounts = accounts
      .map((account) => ({
        name: account?.name || '',
        reason: account?.reason || '',
        industry: account?.industry || 'General',
      }))
      .filter((account) => account.name && account.reason)

    return NextResponse.json(normalizedAccounts)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate accounts.', details: error.message },
      { status: 500 }
    )
  }
}
