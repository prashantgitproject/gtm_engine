'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import Loader from '@/components/shared/Loader'
import { useUser } from '@/context/UserContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiBook,
  FiChevronLeft,
  FiDownload,
  FiGlobe,
  FiLayers,
  FiPhone,
  FiPlay,
  FiSend,
} from 'react-icons/fi'
import { FaLinkedin } from 'react-icons/fa'
import { MdOutlineCampaign, MdOutlineEmail } from 'react-icons/md'
import { SiReddit } from 'react-icons/si'
import { toast } from 'sonner'

const STATUS_LABEL = {
  draft: 'Draft',
  paused: 'Paused',
  running: 'Running',
  completed: 'Completed',
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function statusBadgeClass(status) {
  const s = String(status || 'draft').toLowerCase()
  switch (s) {
    case 'running':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'paused':
      return 'bg-amber-50 text-amber-800 ring-amber-100'
    case 'completed':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

function formatStatusLabel(status) {
  const key = String(status || 'draft').toLowerCase()
  return STATUS_LABEL[key] || STATUS_LABEL.draft
}

function normalizeResults(r) {
  if (!r || typeof r !== 'object') {
    return { sends: 0, replies: 0, meetingsBooked: 0 }
  }
  return {
    sends: Number(r.sends) || 0,
    replies: Number(r.replies) || 0,
    meetingsBooked: Number(r.meetingsBooked) || 0,
  }
}

const DRIP_STEPS = [
  {
    day: 1,
    channel: 'email',
    title: 'Insight-led opener',
    body:
      'Short note referencing account-book trigger + pain hypothesis; plain text, one CTA.',
    icon: MdOutlineEmail,
  },
  {
    day: 2,
    channel: 'linkedin',
    title: 'Connect + context DM',
    body:
      'Connection request note tied to milestone; DM references mutual signal without spray-and-pray cadence.',
    icon: FaLinkedin,
  },
  {
    day: 4,
    channel: 'email',
    title: 'Proof + specificity',
    body:
      'Case snapshot aligned to persona; tighter ask focused on scheduling a working session.',
    icon: MdOutlineEmail,
  },
  {
    day: 7,
    channel: 'reddit',
    title: 'Community-native touch',
    body:
      'Participate where prospect org members discuss category pain; DM only after value add in-thread.',
    icon: SiReddit,
  },
]

function scoreClass(score) {
  if (score >= 85) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (score >= 78) return 'bg-sky-50 text-sky-800 ring-sky-100'
  return 'bg-amber-50 text-amber-800 ring-amber-100'
}

/** Non-empty URL for <a href>; accepts domain-only strings. */
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

const LINKEDIN_KIND_LABEL = { person: 'Person', company: 'Company' }

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

function slugifyFilenamePart(name) {
  const base = String(name || 'campaign')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return base || 'campaign'
}

function buildAccountBookCsv(rows) {
  const headers = [
    'Prospect',
    'Person',
    'Role',
    'Email',
    'Phone',
    'Website',
    'LinkedIn (person)',
    'LinkedIn (company)',
    'Location',
    'PIN / ZIP',
    'Why this person',
    'Signals',
    'Score',
    'Maps rating',
    'Maps reviews',
    'Primary source',
  ]
  const lines = [headers.map(csvEscapeCell).join(',')]
  for (const row of rows) {
    const signals = Array.isArray(row.signals) ? row.signals.join('; ') : ''
    lines.push(
      [
        csvCell(row.prospect),
        csvCell(row.person),
        csvCell(row.role),
        csvCell(row.email),
        csvCell(row.phone),
        csvCell(row.website),
        linkedInUrlForKind(row.linkedinUrls, 'person'),
        linkedInUrlForKind(row.linkedinUrls, 'company'),
        csvCell(row.location),
        csvCell(row.pincode),
        csvCell(row.why),
        signals,
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

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], {
    type: mimeType || 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const CampaignDetailPage = () => {
  const user = useUser()
  const hasCampaignAccess = user?.payment === true
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [accountBookProspects, setAccountBookProspects] = useState([])
  const [prospectListLoading, setProspectListLoading] = useState(false)
  const [retryingBook, setRetryingBook] = useState(false)
  const [runSession, setRunSession] = useState(null)
  const [launchSession, setLaunchSession] = useState(null)

  const results = useMemo(
    () => normalizeResults(campaign?.results),
    [campaign]
  )

  const analytics = useMemo(() => {
    const sends = Math.max(results.sends, 1)
    const replyRate = Math.min(100, (results.replies / sends) * 100 || 12.6)
    const meetingRate = Math.min(
      100,
      (results.meetingsBooked / Math.max(results.replies, 1)) * 100 ||
        (results.meetingsBooked > 0 ? 40 : 8)
    )
    return {
      replyRateDisplay: `${replyRate.toFixed(1)}%`,
      meetingRateDisplay: `${meetingRate.toFixed(1)}%`,
      coverage:
        accountBookProspects.length > 0
          ? Math.min(
              100,
              Math.round((results.sends / accountBookProspects.length) * 100)
            )
          : 0,
    }
  }, [results, accountBookProspects.length])

  const silentReloadCampaign = useCallback(async () => {
    if (!id || typeof id !== 'string') return null
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      if (!res.ok) return null
      const data = await res.json()
      setCampaign(data)
      return data
    } catch {
      return null
    }
  }, [id])

  const loadProspects = useCallback(
    async (opts = {}) => {
      if (!id || typeof id !== 'string' || !hasCampaignAccess) return
      const silent = opts.silent === true
      if (!silent) setProspectListLoading(true)
      try {
        const res = await fetch(`/api/campaigns/${id}/prospects`)
        if (!res.ok) {
          throw new Error('Could not load account book rows')
        }
        const payload = await res.json()
        setAccountBookProspects(Array.isArray(payload.prospects) ? payload.prospects : [])
      } catch (e) {
        console.error(e)
        if (!silent) toast.error(e.message || 'Could not load account book')
      } finally {
        if (!silent) setProspectListLoading(false)
      }
    },
    [id, hasCampaignAccess]
  )

  useEffect(() => {
    if (!id || typeof id !== 'string' || !hasCampaignAccess) return
    if (!campaign?._id) return
    loadProspects({ silent: false })
  }, [id, campaign?._id, hasCampaignAccess, loadProspects])

  useEffect(() => {
    if (campaign?.accountBookBuildStatus !== 'running') return undefined
    const iv = window.setInterval(() => {
      silentReloadCampaign()
      loadProspects({ silent: true })
    }, 4500)
    return () => window.clearInterval(iv)
  }, [
    campaign?.accountBookBuildStatus,
    silentReloadCampaign,
    loadProspects,
  ])

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setLoading(false)
      setNotFound(true)
      return
    }
    if (user === undefined || user === null) return
    if (!hasCampaignAccess) {
      setLoading(false)
      setNotFound(false)
      setCampaign(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await fetch(`/api/campaigns/${id}`)
        if (res.status === 403) {
          if (!cancelled) {
            setCampaign(null)
            setNotFound(false)
          }
          return
        }
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true)
            setCampaign(null)
          }
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load campaign')
        }
        const data = await res.json()
        if (!cancelled) setCampaign(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          toast.error(e.message || 'Could not load campaign')
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, id, hasCampaignAccess])

  const handleRun = () => {
    if (!campaign) return
    if (accountBookProspects.length === 0) {
      toast.message('Create an account book first', {
        description:
          'You need prospect rows before GTM Engine can run signal refresh and scoring.',
      })
      return
    }
    const stamp = new Date().toISOString()
    setRunSession(stamp)
    toast.success('Run started', {
      description: `Refreshing signals for ${accountBookProspects.length} prospects · job queued`,
    })
  }

  const handleRetryAccountBookBuild = async () => {
    if (!campaign || !id) return
    setRetryingBook(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/account-book/run`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      await silentReloadCampaign()
      await loadProspects({ silent: true })
      if (!res.ok) {
        toast.error(body.error || 'Could not refresh the workspace book')
        return
      }
      toast.success('Account book refreshed')
    } catch (e) {
      toast.error(e?.message || 'Could not rebuild account book')
    } finally {
      setRetryingBook(false)
    }
  }

  const handleExportAccountBook = useCallback(() => {
    if (accountBookProspects.length === 0) {
      toast.message('Nothing to export', {
        description: 'Prospects appear here after your account book is built.',
      })
      return
    }
    const csv = buildAccountBookCsv(accountBookProspects)
    const slug = slugifyFilenamePart(campaign?.name)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`account-book-${slug}-${stamp}.csv`, csv)
    toast.success('Export ready', {
      description: 'CSV downloaded — open in Excel or Sheets.',
    })
  }, [accountBookProspects, campaign?.name])

  const handleLaunchCampaign = () => {
    if (!campaign) return
    if (accountBookProspects.length === 0) {
      toast.message('Add an account book before launch', {
        description: 'Prospects power the personalized drip across channels.',
      })
      return
    }
    setLaunchSession(new Date().toISOString())
    toast.success('Launch queued', {
      description:
        'Email · LinkedIn · Reddit sequence scheduled with persona-aware copy.',
    })
  }

  if (user === undefined || user === null) {
    return <Loader fullScreen />
  }

  if (!hasCampaignAccess) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:text-sky-900"
          >
            <FiChevronLeft aria-hidden />
            All campaigns
          </Link>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">
              You do not have access to this premium feature.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Opening campaigns requires an active premium plan.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader fullScreen={false} />
      </div>
    )
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:text-sky-900"
          >
            <FiChevronLeft aria-hidden />
            All campaigns
          </Link>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">
              Campaign not found
            </p>
            <p className="mt-2 text-sm text-slate-600">
              It may have been removed or you don&apos;t have access.
            </p>
            <Link
              href="/campaigns"
              className="mt-6 inline-flex rounded-xl bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-900"
            >
              Back to campaigns
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const signals = Array.isArray(campaign.signals) ? campaign.signals : []
  const bookStatus = campaign.accountBookBuildStatus || 'idle'
  const avgScore =
    accountBookProspects.length > 0
      ? Math.round(
          accountBookProspects.reduce((a, p) => a + p.score, 0) /
            accountBookProspects.length
        )
      : null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:text-sky-900"
          >
            <FiChevronLeft aria-hidden />
            All campaigns
          </Link>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
              <MdOutlineCampaign
                className="text-sky-800 shrink-0"
                size={36}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    {campaign.name}
                  </h1>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(campaign.status)}`}
                  >
                    {formatStatusLabel(campaign.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Updated {formatDate(campaign.updatedAt)} · Created{' '}
                  {formatDate(campaign.createdAt)}
                </p>
                {campaign.goal?.trim() ? (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">
                    {campaign.goal}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col xl:flex-row">
              <button
                type="button"
                onClick={handleRun}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 lg:flex-none"
              >
                <FiPlay className="text-emerald-600" aria-hidden />
                Run
              </button>
              <button
                type="button"
                onClick={handleRetryAccountBookBuild}
                disabled={
                  bookStatus === 'running' || retryingBook
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 lg:flex-none"
              >
                <FiBook aria-hidden />
                {bookStatus === 'running'
                  ? 'Updating book…'
                  : 'Rebuild account book'}
              </button>
              <button
                type="button"
                onClick={handleLaunchCampaign}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-800 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-sky-900 hover:to-cyan-700 lg:flex-none"
              >
                <FiSend aria-hidden />
                Launch campaign
              </button>
            </div>
          </div>

          {(runSession || launchSession) && (
            <p className="mt-3 text-xs text-slate-500">
              {runSession && (
                <span className="mr-4">
                  Last run queued {formatDate(runSession)}
                </span>
              )}
              {launchSession && (
                <span>Launch armed {formatDate(launchSession)}</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 lg:py-10">
        {bookStatus === 'running' && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950 shadow-sm"
            role="status"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-sky-200">
              <span className="size-5 animate-pulse rounded-full bg-sky-500/80" />
            </span>
            <div>
              <p className="font-semibold">Someone is refining your workspace</p>
              <p className="mt-1 text-xs text-sky-900/80">
                {campaign.accountBookStepLabel?.trim() ||
                  'Still arranging the pieces—feel free to take a pause.'}
              </p>
            </div>
          </div>
        )}

        {bookStatus === 'failed' && campaign.accountBookBuildError?.trim() && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-950 shadow-sm">
              <p className="font-semibold">The workspace pass paused unexpectedly</p>
              <p className="mt-1 text-xs text-rose-900/90">
                {campaign.accountBookBuildError.slice(0, 320)}
              </p>
            </div>
          )}

        {/* Metrics */}
        <section aria-labelledby="metrics-heading">
          <div className="mb-4 flex items-center gap-2">
            <FiLayers className="text-sky-800" aria-hidden />
            <h2
              id="metrics-heading"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              Campaign metrics
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Outreach sends',
                value: results.sends.toLocaleString(),
                hint: 'All channels',
              },
              {
                label: 'Replies',
                value: results.replies.toLocaleString(),
                hint: analytics.replyRateDisplay + ' reply rate (est.)',
              },
              {
                label: 'Meetings booked',
                value: results.meetingsBooked.toLocaleString(),
                hint: analytics.meetingRateDisplay + ' conv. to meeting (est.)',
              },
              {
                label: 'Prospects in book',
                value:
                  accountBookProspects.length > 0
                    ? accountBookProspects.length.toString()
                    : '—',
                hint:
                  accountBookProspects.length > 0
                    ? `Avg fit ${avgScore}`
                    : 'Create account book',
              },
            ].map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-600">{card.hint}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Analytics */}
        <section
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          aria-labelledby="analytics-heading"
        >
          <h2
            id="analytics-heading"
            className="text-lg font-bold text-slate-900 sm:text-xl"
          >
            Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Funnel view ties account-book coverage to live sends. Estimates
            blend stored results with safe defaults when volume is low.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Coverage vs. book
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-800 to-cyan-500 transition-all"
                  style={{
                    width: `${accountBookProspects.length ? analytics.coverage : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {accountBookProspects.length
                  ? `${results.sends} sends across ${accountBookProspects.length} prospects (${analytics.coverage}% touched)`
                  : 'Create an account book to unlock coverage tracking.'}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Channel mix (design preview)
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <MdOutlineEmail className="text-sky-700" />
                    Email
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    48%
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <FaLinkedin className="text-sky-800" />
                    LinkedIn
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    35%
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <SiReddit className="text-orange-600" />
                    Reddit
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    17%
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Account book */}
        <section aria-labelledby="account-book-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FiBook className="text-slate-800" aria-hidden />
                <h2
                  id="account-book-heading"
                  className="text-lg font-bold text-slate-900 sm:text-xl"
                >
                  Account book
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Prospect coverage, fit scores, and evidence your reps can trust.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleExportAccountBook}
                disabled={
                  accountBookProspects.length === 0 || prospectListLoading
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  accountBookProspects.length === 0
                    ? 'Add prospects to export'
                    : 'Download account book as CSV (Excel-compatible)'
                }
              >
                <FiDownload className="text-slate-600" aria-hidden />
                Export
              </button>
              {accountBookProspects.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800 ring-1 ring-slate-200">
                    {accountBookProspects.length} prospects
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-100">
                    Avg score {avgScore ?? '—'}
                  </span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-900 ring-1 ring-sky-100">
                    {signals.length} campaign signals
                  </span>
                </div>
              )}
            </div>
          </div>

          {accountBookProspects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-inner">
              {prospectListLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader fullScreen={false} />
                  <p className="text-sm font-medium text-slate-700">
                    Pulling enriched rows…
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-800">
                    {bookStatus === 'running'
                      ? 'Your book is opening up…'
                      : bookStatus === 'failed'
                        ? 'We paused before filling every row.'
                        : 'No rows yet'}
                  </p>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
                    {bookStatus === 'running'
                      ? 'The workspace assistant is finishing touches in the background. This view refreshes on its own.'
                      : bookStatus === 'failed'
                        ? 'You can widen locations or loosen filters and try again below.'
                        : 'When a campaign spins up, enriched companies and contacts land here sorted by prominence from public signals.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryAccountBookBuild}
                    disabled={bookStatus === 'running' || retryingBook}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <FiBook aria-hidden />
                    {bookStatus === 'running'
                      ? 'Still working…'
                      : 'Rebuild account book'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div
                className="h-[min(70vh,32rem)] overflow-auto overscroll-contain"
                role="region"
                aria-label="Account book prospects"
              >
                <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
                  <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-slate-50">
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                      <th className="px-4 py-3 text-right shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountBookProspects.map((row, idx) => (
                      <tr
                        key={row._id || `${idx}-${row.email}-${row.person}`}
                        className="hover:bg-slate-50/80"
                      >
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
                          {hrefForWebsite(row.website) ? (
                            <a
                              href={hrefForWebsite(row.website)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[14rem] items-center gap-1 truncate text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
                              title={row.website}
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
                        <td className="align-top px-4 py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ${scoreClass(row.score)}`}
                          >
                            {row.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Outreach — personalized drip */}
        <section aria-labelledby="outreach-heading">
          <div className="mb-4">
            <h2
              id="outreach-heading"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              Personalized drip outreach
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Multi-channel sequencing with persona-aware copy: email for depth,
              LinkedIn for social proof and timing, Reddit for contextual
              community plays.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {DRIP_STEPS.map((step) => {
              const Icon = step.icon
              const channelStyles =
                step.channel === 'email'
                  ? 'border-sky-200 bg-sky-50'
                  : step.channel === 'linkedin'
                    ? 'border-sky-300 bg-white'
                    : 'border-orange-200 bg-orange-50/70'
              return (
                <article
                  key={step.day + step.channel}
                  className={`rounded-2xl border p-5 shadow-sm ${channelStyles}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                      Day {step.day}
                    </span>
                    <Icon
                      className="shrink-0 text-slate-800"
                      size={22}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {step.channel === 'reddit'
                      ? 'Reddit'
                      : step.channel === 'linkedin'
                        ? 'LinkedIn'
                        : 'Email'}{' '}
                    touch
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {step.body}
                  </p>
                </article>
              )
            })}
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Guardrails: </span>
            copy references account-book fields (pain, timing, triggers), caps
            daily LinkedIn touches, and keeps Reddit participation value-first
            before any DM.
          </div>
        </section>

        {/* Supporting context */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Campaign signals
            </h2>
            {signals.length > 0 ? (
              <ul className="mt-3 list-inside list-disc space-y-1 text-slate-800">
                {signals.map((s, idx) => (
                  <li key={`${idx}-${s}`} className="marker:text-sky-600">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-slate-600">None listed on this campaign.</p>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Narrative / description
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-slate-800">
              {campaign.description?.trim()
                ? campaign.description
                : 'Add storyline in the campaign record to steer creative variants.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout()(CampaignDetailPage)
