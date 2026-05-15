/**
 * Numbered BODY variables for WhatsApp message templates ({{1}}, {{2}}, …).
 * Meta requires `example.body_text` when the body contains variables.
 * https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/
 */

/**
 * @param {string} bodyText
 * @returns {{ count: number } | { error: string }}
 * `count` is 0 for plain text, or N when {{1}}..{{N}} are used (must be consecutive).
 */
export function analyzeWhatsAppBodyVariables(bodyText) {
  const text = String(bodyText || '')
  const anyBrace = /\{\{[^}]+\}\}/g
  let m
  while ((m = anyBrace.exec(text)) !== null) {
    if (!/^\{\{\d+\}\}$/.test(m[0])) {
      return {
        error: `Only numbered placeholders like {{1}} are supported. Fix: ${m[0]}`,
      }
    }
  }

  const numRe = /\{\{(\d+)\}\}/g
  const nums = new Set()
  while ((m = numRe.exec(text)) !== null) {
    const n = parseInt(m[1], 10)
    if (!Number.isFinite(n) || n < 1) {
      return { error: 'Variable indices must be positive integers ({{1}}, {{2}}, …).' }
    }
    nums.add(n)
  }

  if (nums.size === 0) return { count: 0 }

  const max = Math.max(...nums)
  for (let i = 1; i <= max; i++) {
    if (!nums.has(i)) {
      return {
        error: `Use consecutive variables {{1}} through {{${max}}} — {{${i}}} is missing in the body.`,
      }
    }
  }

  return { count: max }
}

/**
 * @param {string[]} examples One sample per {{1}}..{{N}}, in order
 * @returns {{ body_text: string[][] }}
 */
export function metaBodyExamplePayload(examples) {
  return { body_text: [examples.map((s) => String(s ?? '').trim())] }
}
