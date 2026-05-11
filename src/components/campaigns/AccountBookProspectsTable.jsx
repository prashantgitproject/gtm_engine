'use client'

import { FaLinkedin, FaWhatsapp } from 'react-icons/fa'
import { FiChevronDown, FiChevronRight, FiGlobe, FiPhone } from 'react-icons/fi'
import { MdOutlineEmail } from 'react-icons/md'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

const LINKEDIN_KIND_LABEL = { person: 'Person', company: 'Company' }

const CHANNEL_META = {
  email: {
    label: 'Email',
    Icon: MdOutlineEmail,
    bar: 'bg-sky-600',
  },
  linkedin: {
    label: 'LinkedIn',
    Icon: FaLinkedin,
    bar: 'bg-sky-800',
  },
  whatsapp: {
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    bar: 'bg-emerald-600',
  },
}

function scoreClass(score) {
  if (score >= 85) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (score >= 78) return 'bg-sky-50 text-sky-800 ring-sky-100'
  return 'bg-amber-50 text-amber-800 ring-amber-100'
}

function hrefForWebsite(display) {
  if (typeof display !== 'string') return null
  const s = display.trim()
  if (!s || s === '—') return null
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

function websiteLinkLabel(display) {
  const href = hrefForWebsite(display)
  if (!href) return display
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return display
  }
}

function telHref(phoneDisplay) {
  if (typeof phoneDisplay !== 'string') return null
  const digits = phoneDisplay.replace(/[^\d+]/g, '')
  return digits.length > 3 ? digits : null
}

function cloneSequence(seq) {
  if (!Array.isArray(seq)) return []
  return seq.map((s) => ({
    day: Number(s.day) || 1,
    channel: s.channel,
    subject: s.subject ?? '',
    body: s.body ?? '',
  }))
}

function isFilledCell(v) {
  if (v == null) return false
  const s = String(v).trim()
  return s !== '' && s !== '—'
}

function ProspectContextCard({ row }) {
  const hasLinkedInBlock =
    isFilledCell(row.linkedinHeadline) ||
    (typeof row.totalExperienceYears === 'number' &&
      Number.isFinite(row.totalExperienceYears))
  const has =
    hasLinkedInBlock ||
    isFilledCell(row.aboutSummary) ||
    isFilledCell(row.educationSummary) ||
    isFilledCell(row.experienceSummary) ||
    isFilledCell(row.skillsSummary) ||
    isFilledCell(row.companyDossier)

  const skillTokens = isFilledCell(row.skillsSummary)
    ? row.skillsSummary
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 40)
    : []

  if (!has) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Profile & company</span>{' '}
        No LinkedIn profile payload on this row yet. When the account book run
        enriches a person URL, education, experience, skills, and a fuller company
        dossier appear here and in CSV export.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Profile & company context
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Pulled from lead data and LinkedIn profile enrichment (Apify).
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {hasLinkedInBlock || isFilledCell(row.aboutSummary) ? (
          <div className="space-y-3 lg:col-span-2">
            {isFilledCell(row.linkedinHeadline) ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  LinkedIn headline
                </p>
                <p className="mt-1 text-sm font-medium leading-snug text-slate-900">
                  {row.linkedinHeadline}
                </p>
              </div>
            ) : null}
            {typeof row.totalExperienceYears === 'number' &&
            Number.isFinite(row.totalExperienceYears) ? (
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Total experience:</span>{' '}
                ~{row.totalExperienceYears} yrs (profile estimate)
              </p>
            ) : null}
            {isFilledCell(row.aboutSummary) ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  About
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {row.aboutSummary}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        {isFilledCell(row.educationSummary) ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Education
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {row.educationSummary}
            </p>
          </div>
        ) : null}
        {isFilledCell(row.experienceSummary) ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Work history
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {row.experienceSummary}
            </p>
          </div>
        ) : null}
      </div>
      {skillTokens.length > 0 ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skillTokens.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {isFilledCell(row.companyDossier) ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Company dossier
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {row.companyDossier}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function DripStepEditor({ step, index, onChange, disabled }) {
  const meta = CHANNEL_META[step.channel] || CHANNEL_META.email
  const Icon = meta.Icon
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.bar}`}
          aria-hidden
        />
        <Icon className="text-slate-700" size={18} aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Day {step.day}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
          {meta.label}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Day offset
          </span>
          <input
            type="number"
            min={1}
            max={90}
            disabled={disabled}
            value={step.day}
            onChange={(e) =>
              onChange(index, { day: Number(e.target.value) || 1 })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Channel
          </span>
          <select
            disabled={disabled}
            value={step.channel}
            onChange={(e) =>
              onChange(index, {
                channel: e.target.value,
                subject: e.target.value === 'email' ? step.subject : '',
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          >
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        {step.channel === 'email' ? (
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Subject
            </span>
            <input
              type="text"
              disabled={disabled}
              value={step.subject}
              onChange={(e) => onChange(index, { subject: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
            />
          </label>
        ) : null}
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {step.channel === 'email' ? 'Body' : 'Message'}
          </span>
          <textarea
            disabled={disabled}
            value={step.body}
            onChange={(e) => onChange(index, { body: e.target.value })}
            rows={step.channel === 'email' ? 5 : 4}
            className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          />
        </label>
      </div>
    </div>
  )
}

export function AccountBookProspectsTable({
  campaignId,
  rows,
  dripReady,
  onReload,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)

  const expandedRow = useMemo(
    () => rows.find((r) => r._id === expandedId) || null,
    [rows, expandedId]
  )

  useEffect(() => {
    if (!expandedRow) {
      setDraft([])
      return
    }
    setDraft(cloneSequence(expandedRow.dripSequence))
  }, [expandedRow])

  const toggleExpand = useCallback(
    (row, e) => {
      if (e?.target?.closest?.('a, button, input, textarea, select')) return
      setExpandedId((cur) => (cur === row._id ? null : row._id))
    },
    []
  )

  const updateStep = useCallback((index, patch) => {
    setDraft((prev) => {
      const next = [...prev]
      if (!next[index]) return prev
      next[index] = { ...next[index], ...patch }
      return next
    })
  }, [])

  const handleSaveDrip = useCallback(async () => {
    if (!campaignId || !expandedId) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/prospects/${expandedId}/drip`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence: draft }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not save drip content')
        return
      }
      toast.success('Drip sequence updated')
      await onReload?.()
    } catch (err) {
      toast.error(err?.message || 'Could not save drip content')
    } finally {
      setSaving(false)
    }
  }, [campaignId, expandedId, draft, onReload])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
        {dripReady
          ? 'Click a row to expand and view the full email, LinkedIn, and WhatsApp sequence. Edit copy and save — sending is not enabled yet.'
          : 'Create a drip campaign from the header to generate a personalized sequence for each prospect.'}
      </p>
      <div
        className="h-[90vh] overflow-auto overscroll-contain"
        role="region"
        aria-label="Account book prospects"
      >
        <table className="min-w-[1560px] w-full border-collapse text-left text-sm">
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-slate-50">
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="w-10 px-2 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]" />
              <th className="px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Prospect
              </th>
              <th className="px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Person
              </th>
              <th className="px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Email
              </th>
              <th className="min-w-[7.5rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Phone
              </th>
              <th className="min-w-[8rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Company email
              </th>
              <th className="min-w-[7.5rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Company phone
              </th>
              <th className="min-w-[6.5rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Website
              </th>
              <th className="min-w-[7rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                LinkedIn
              </th>
              <th className="min-w-[12rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Location
              </th>
              <th className="min-w-[5rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                PIN / ZIP
              </th>
              <th className="min-w-[16rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Why this person
              </th>
              <th className="min-w-[10rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Signals
              </th>
              <th className="min-w-[7rem] px-4 py-3 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Drip
              </th>
              <th className="px-4 py-3 text-right shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              const open = expandedId === row._id
              const n = Array.isArray(row.dripSequence) ? row.dripSequence.length : 0
              return (
                <React.Fragment
                  key={row._id || `${idx}-${row.email}-${row.person}`}
                >
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={(e) => toggleExpand(row, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleExpand(row, e)
                      }
                    }}
                    className={`cursor-pointer hover:bg-slate-50/80 ${open ? 'bg-sky-50/40' : ''}`}
                  >
                    <td className="px-2 py-3 align-top text-slate-500">
                      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                        {open ? (
                          <FiChevronDown aria-hidden />
                        ) : (
                          <FiChevronRight aria-hidden />
                        )}
                      </span>
                    </td>
                    <td className="align-top px-4 py-3 font-semibold text-slate-900">
                      <span>{row.prospect}</span>
                      {typeof row.mapsRating === 'number' && (
                        <span className="mt-1 block text-[11px] font-medium text-amber-800">
                          ★{row.mapsRating.toFixed(1)}
                          {typeof row.mapsReviewsCount === 'number'
                            ? ` · ${row.mapsReviewsCount.toLocaleString()} reviews`
                            : ''}
                        </span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-800">
                      <span className="font-medium">{row.person}</span>
                      <span className="block text-xs text-slate-500">
                        {row.role}
                      </span>
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      <span className="break-all">{row.email}</span>
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {row.phone && row.phone !== '—' && telHref(row.phone) ? (
                        <a
                          href={`tel:${telHref(row.phone)}`}
                          className="inline-flex items-center gap-1 break-all text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FiPhone
                            className="shrink-0 text-sky-600"
                            aria-hidden
                          />
                          {row.phone}
                        </a>
                      ) : (
                        <span className="break-all">{row.phone ?? '—'}</span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {row.companyEmail &&
                      row.companyEmail !== '—' &&
                      /^\S+@\S+\.\S+$/.test(String(row.companyEmail).trim()) ? (
                        <a
                          href={`mailto:${String(row.companyEmail).trim()}`}
                          className="inline-flex items-center gap-1 break-all text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MdOutlineEmail
                            className="shrink-0 text-sky-600"
                            aria-hidden
                          />
                          {row.companyEmail}
                        </a>
                      ) : (
                        <span className="break-all">
                          {row.companyEmail ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {row.companyPhone &&
                      row.companyPhone !== '—' &&
                      telHref(row.companyPhone) ? (
                        <a
                          href={`tel:${telHref(row.companyPhone)}`}
                          className="inline-flex items-center gap-1 break-all text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FiPhone
                            className="shrink-0 text-sky-600"
                            aria-hidden
                          />
                          {row.companyPhone}
                        </a>
                      ) : (
                        <span className="break-all">
                          {row.companyPhone ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {hrefForWebsite(row.website) ? (
                        <a
                          href={hrefForWebsite(row.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[14rem] items-center gap-1 truncate text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                          title={row.website}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FiGlobe
                            className="shrink-0 text-sky-600"
                            aria-hidden
                          />
                          <span className="truncate">
                            {websiteLinkLabel(row.website)}
                          </span>
                        </a>
                      ) : (
                        <span>{row.website ?? '—'}</span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {Array.isArray(row.linkedinUrls) &&
                      row.linkedinUrls.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {row.linkedinUrls.map((entry, li) => (
                            <a
                              key={`${entry.url}-${li}`}
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FaLinkedin
                                className="shrink-0 text-[13px]"
                                aria-hidden
                              />
                              {LINKEDIN_KIND_LABEL[entry.kind] ||
                                entry.kind ||
                                'Profile'}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      <span className="break-words text-slate-800">
                        {row.location ?? '—'}
                      </span>
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700 tabular-nums">
                      {row.pincode ?? '—'}
                    </td>
                    <td className="align-top px-4 py-3 text-slate-700">
                      {row.why}
                    </td>
                    <td className="align-top px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(row.signals || []).map((sig, i) => (
                          <span
                            key={`${sig}-${i}`}
                            className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-100"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="align-top px-4 py-3">
                      {dripReady && n > 0 ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-100">
                          {n} steps
                        </span>
                      ) : dripReady ? (
                        <span className="text-xs text-amber-700">—</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="align-top px-4 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ${scoreClass(row.score)}`}
                      >
                        {row.score}
                      </span>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="bg-slate-50/90">
                      <td colSpan={15} className="px-4 py-5">
                        {!dripReady ? (
                          <div className="space-y-4">
                            <ProspectContextCard row={row} />
                            <p className="text-sm text-slate-600">
                              Drip content will appear here after you run{' '}
                              <strong>Create drip campaign</strong> in the header.
                            </p>
                          </div>
                        ) : n === 0 ? (
                          <div className="space-y-4">
                            <ProspectContextCard row={row} />
                            <p className="text-sm text-amber-900">
                              No sequence stored for this prospect. Regenerate the
                              drip campaign from the header.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <ProspectContextCard row={row} />
                            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  Drip sequence · {row.person} @ {row.prospect}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  Planned touches only — delivery, tracking, and
                                  reply metrics will connect in a later release.
                                  Today you can refine copy before we wire
                                  execution.
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveDrip()
                                }}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {saving ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                                      aria-hidden
                                    />
                                    Saving…
                                  </span>
                                ) : (
                                  'Save changes'
                                )}
                              </button>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                              {draft.map((step, si) => (
                                <DripStepEditor
                                  key={`${step.channel}-${si}-${step.day}`}
                                  step={step}
                                  index={si}
                                  disabled={saving}
                                  onChange={updateStep}
                                />
                              ))}
                            </div>
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-600">
                              <span className="font-semibold text-slate-800">
                                Execution preview (not live):{' '}
                              </span>
                              Email steps would log opens/clicks; LinkedIn steps
                              would respect weekly invite limits; WhatsApp would
                              require opt-in numbers only. No messages are sent
                              from this screen yet.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
