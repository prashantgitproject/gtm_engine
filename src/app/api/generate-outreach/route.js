import { NextResponse } from 'next/server'
import { getSystemPrompt } from '../../../../lib/prompts'

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

function parseOutreach(content) {
  try {
    return JSON.parse(content)
  } catch {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // continue to text parsing fallback
    }

    try {
      const linkedinMatch = content.match(
        /(?:^|\n)\s*(?:\d+[\).\s-]*)?(?:linkedin(?:\s*dm|\s*message)?(?:\s*1)?)\s*:\s*([\s\S]*?)(?=\n\s*(?:\d+[\).\s-]*)?(?:email(?:\s*1)?|cold\s*email)\s*:|$)/i
      )
      const emailMatch = content.match(
        /(?:^|\n)\s*(?:\d+[\).\s-]*)?(?:email(?:\s*1)?|cold\s*email)\s*:\s*([\s\S]*)$/i
      )

      const linkedin1 = linkedinMatch?.[1]?.trim() || ''
      const email1 = emailMatch?.[1]?.trim() || ''

      if (linkedin1 || email1) {
        return { linkedin1, email1 }
      }

      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const splitIndex = Math.ceil(lines.length / 2)
      return {
        linkedin1: lines.slice(0, splitIndex).join('\n').trim(),
        email1: lines.slice(splitIndex).join('\n').trim(),
      }
    } catch {
      return null
    }
  }
}

function inferIndustry(reason) {
  const text = reason.toLowerCase()

  if (text.includes('construction') || text.includes('contractor') || text.includes('job site')) {
    return 'Construction'
  }
  if (text.includes('hospitality') || text.includes('hotel') || text.includes('restaurant')) {
    return 'Hospitality'
  }
  if (text.includes('healthcare') || text.includes('clinic') || text.includes('hospital')) {
    return 'Healthcare'
  }
  if (text.includes('manufacturing') || text.includes('factory') || text.includes('plant')) {
    return 'Manufacturing'
  }
  if (text.includes('retail') || text.includes('store') || text.includes('ecommerce')) {
    return 'Retail'
  }

  return 'General'
}

function pickTone() {
  const tones = ['direct', 'curious', 'insight-led']
  return tones[Math.floor(Math.random() * tones.length)]
}

export async function POST(request) {
  try {
    const { company, reason } = await request.json()

    if (!company || !reason) {
      return NextResponse.json(
        { error: 'Both company and reason are required.' },
        { status: 400 }
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENROUTER_API_KEY environment variable.' },
        { status: 500 }
      )
    }

    const industry = inferIndustry(reason)
    const tone = pickTone()

    const userPrompt = `Context:
- Company: ${company}
- Reason they are a target: ${reason}
- Industry: ${industry}
- Tone: ${tone}

Instructions:
Write output in strict JSON:
{
  "linkedin1": "",
  "email1": "",
  "linkedin2": "",
  "email2": ""
}

Rules for each email:
- First line MUST be: Subject: ...
- Then a blank line
- Then the email body
- End with:

Best,  
[Name]
Wardell  
+91-XXXXXXXXXX

Rules for each LinkedIn touch:
- No subject
- No signature
- Short and conversational

Campaign sequencing:
- linkedin1: initial light opener
- email1: primary problem-led email
- linkedin2: follow-up after no reply
- email2: short bump with a fresh angle

Ensure formatting is clean and consistent.`

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: getSystemPrompt() },
          { role: 'user', content: userPrompt },
        ],
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
    const content = extractMessageContent(data?.choices?.[0]?.message?.content) || '{}'
    let outreach = null
    try {
      outreach = parseOutreach(content)
    } catch {
      outreach = null
    }

    if (
      !outreach ||
      typeof (outreach.linkedin1 || outreach.linkedin) !== 'string' ||
      typeof (outreach.email1 || outreach.email) !== 'string'
    ) {
      outreach = {
        linkedin1: `Hi ${company} team - noticed ${reason}. Open to a quick chat this week to compare options?`,
        email1: `Subject: Quick idea for ${company}

Hi team,

I noticed ${reason} and thought this might be relevant.
We help teams in similar situations evaluate options quickly with minimal disruption.

Would you be open to a short 15-minute intro this week?

Best,
[Your Name]`,
        linkedin2: `Circling back in case this is timely for ${company}. Happy to share a quick point of view if helpful.`,
        email2: `Subject: Re: Quick idea for ${company}

Hi team,

Following up in case this slipped through. We often see teams dealing with ${reason.toLowerCase()} wait too long before pressure builds.

Worth sending over a few ideas?

Best,
[Your Name]`,
      }
    }

    return NextResponse.json({
      linkedin1: outreach.linkedin1 || outreach.linkedin || '',
      email1: outreach.email1 || outreach.email || '',
      linkedin2: outreach.linkedin2 || outreach.followupLinkedin || '',
      email2: outreach.email2 || outreach.followup || outreach.email || '',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate outreach.', details: error.message },
      { status: 500 }
    )
  }
}
