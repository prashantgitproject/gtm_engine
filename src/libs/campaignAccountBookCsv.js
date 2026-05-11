function csvEscapeCell(val) {
  if (val == null || val === undefined) return ''
  const s = String(val)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Treat UI placeholder em dash as empty in exports. */
function csvCell(v) {
  if (v == null || v === undefined) return ''
  const s = String(v).trim()
  if (s === '—') return ''
  return s
}

function linkedInUrlForKind(urls, kind) {
  if (!Array.isArray(urls)) return ''
  const hit = urls.find((u) => u && u.kind === kind && u.url)
  return hit ? String(hit.url).trim() : ''
}

export function slugifyFilenamePart(name) {
  const base = String(name || 'campaign')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return base || 'campaign'
}

export function buildAccountBookCsv(rows) {
  const headers = [
    'Prospect',
    'Person',
    'Role',
    'Email',
    'Phone',
    'Company email',
    'Company phone',
    'Website',
    'LinkedIn (person)',
    'LinkedIn (company)',
    'Location',
    'PIN / ZIP',
    'Why this person',
    'Signals',
    'LinkedIn headline',
    'About (snippet)',
    'Total experience (yrs)',
    'Education',
    'Work history',
    'Skills',
    'Company dossier',
    'Score',
    'Maps rating',
    'Maps reviews',
    'Primary source',
  ]
  const lines = [headers.map(csvEscapeCell).join(',')]
  for (const row of rows) {
    const signals = Array.isArray(row.signals) ? row.signals.join('; ') : ''
    const yrs =
      typeof row.totalExperienceYears === 'number' &&
      Number.isFinite(row.totalExperienceYears)
        ? String(row.totalExperienceYears)
        : ''
    lines.push(
      [
        csvCell(row.prospect),
        csvCell(row.person),
        csvCell(row.role),
        csvCell(row.email),
        csvCell(row.phone),
        csvCell(row.companyEmail),
        csvCell(row.companyPhone),
        csvCell(row.website),
        linkedInUrlForKind(row.linkedinUrls, 'person'),
        linkedInUrlForKind(row.linkedinUrls, 'company'),
        csvCell(row.location),
        csvCell(row.pincode),
        csvCell(row.why),
        signals,
        csvCell(row.linkedinHeadline),
        csvCell(row.aboutSummary),
        yrs,
        csvCell(row.educationSummary),
        csvCell(row.experienceSummary),
        csvCell(row.skillsSummary),
        csvCell(row.companyDossier),
        row.score != null ? String(row.score) : '',
        typeof row.mapsRating === 'number' ? String(row.mapsRating) : '',
        typeof row.mapsReviewsCount === 'number'
          ? String(row.mapsReviewsCount)
          : '',
        csvCell(row.primarySource),
      ]
        .map(csvEscapeCell)
        .join(',')
    )
  }
  return `\uFEFF${lines.join('\r\n')}`
}
