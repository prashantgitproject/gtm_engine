'use client'

import { AccountBookProspectsTable } from '@/components/campaigns/AccountBookProspectsTable'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Loader from '@/components/shared/Loader'
import { buildAccountBookCsv, slugifyFilenamePart } from '@/libs/campaignAccountBookCsv'
import { useUser } from '@/context/UserContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiBook,
  FiChevronLeft,
  FiDownload,
  FiLayers,
  FiSend,
  FiZap,
} from 'react-icons/fi'
import { FaLinkedin, FaWhatsapp } from 'react-icons/fa'
import { MdOutlineCampaign, MdOutlineEmail } from 'react-icons/md'
import { toast } from 'sonner'

const STATUS_LABEL = {
  draft: 'Draft',
  paused: 'Paused',
  running: 'Running',
  completed: 'Completed',
}

/** Flip to true when “Rebuild account book” should be offered again. */
const ACCOUNT_BOOK_REBUILD_ENABLED = false

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
  const [dripDesignLoading, setDripDesignLoading] = useState(false)

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
        setCampaign((prev) => {
          if (!prev?._id) return prev
          return {
            ...prev,
            dripCampaignStatus:
              payload.dripCampaignStatus ?? prev.dripCampaignStatus,
            dripCampaignError: payload.dripCampaignError ?? prev.dripCampaignError,
            dripCampaignGeneratedAt:
              payload.dripCampaignGeneratedAt ?? prev.dripCampaignGeneratedAt,
          }
        })
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

  const handleCreateDripCampaign = async () => {
    if (!campaign || !id) return
    if (accountBookProspects.length === 0) {
      toast.message('Account book required', {
        description: 'Add prospects before generating a drip sequence.',
      })
      return
    }
    setDripDesignLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/drip/generate`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      await silentReloadCampaign()
      await loadProspects({ silent: true })
      if (!res.ok) {
        toast.error(body.error || 'Could not create drip campaign')
        return
      }
      toast.success('Drip campaign ready', {
        description: `Personalized sequences saved for ${body.prospectCount ?? accountBookProspects.length} prospects.`,
      })
    } catch (e) {
      toast.error(e?.message || 'Could not create drip campaign')
      await silentReloadCampaign()
      await loadProspects({ silent: true })
    } finally {
      setDripDesignLoading(false)
    }
  }

  const handleLaunchCampaign = () => {
    if (!campaign) return
    if (campaign.dripCampaignStatus !== 'complete') {
      toast.message('Finish drip design first', {
        description: 'Create a drip campaign so every row has channel-specific copy.',
      })
      return
    }
    if (accountBookProspects.length === 0) {
      toast.message('Add an account book before launch', {
        description: 'Prospects power the personalized drip across channels.',
      })
      return
    }
    toast.message('Launch is not wired yet', {
      description:
        'When we ship execution, this will arm email, LinkedIn, and WhatsApp sends with the sequences you edited in each row.',
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
      {dripDesignLoading ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 px-6 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div
            className="size-14 shrink-0 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"
            aria-hidden
          />
          <p className="mt-8 max-w-md text-lg font-semibold text-slate-900">
            Designing a personalised drip campaign for your account book
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            We are generating email, LinkedIn, and WhatsApp steps for every
            prospect using your campaign goal and book context. Large lists can
            take a couple of minutes — keep this tab open.
          </p>
        </div>
      ) : null}
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
                onClick={handleRetryAccountBookBuild}
                disabled={
                  !ACCOUNT_BOOK_REBUILD_ENABLED ||
                  bookStatus === 'running' ||
                  retryingBook
                }
                title={
                  ACCOUNT_BOOK_REBUILD_ENABLED
                    ? undefined
                    : 'Account book rebuild is temporarily unavailable.'
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
                onClick={handleCreateDripCampaign}
                disabled={
                  bookStatus === 'running' ||
                  dripDesignLoading ||
                  accountBookProspects.length === 0
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 lg:flex-none"
              >
                <FiZap className="text-amber-500" aria-hidden />
                {campaign.dripCampaignStatus === 'complete'
                  ? 'Regenerate drip campaign'
                  : 'Create drip campaign'}
              </button>
              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={
                  campaign.dripCampaignStatus !== 'complete' ||
                  accountBookProspects.length === 0 ||
                  bookStatus === 'running'
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-800 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-sky-900 hover:to-cyan-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none lg:flex-none"
              >
                <FiSend aria-hidden />
                Launch campaign
              </button>
            </div>
          </div>
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

        {campaign.dripCampaignStatus === 'failed' &&
          campaign.dripCampaignError?.trim() && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-950 shadow-sm">
              <p className="font-semibold">Drip generation did not finish</p>
              <p className="mt-1 text-xs text-rose-900/90">
                {String(campaign.dripCampaignError).slice(0, 320)}
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
                Channel mix (planned — email · LinkedIn · WhatsApp)
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <MdOutlineEmail className="text-sky-700" />
                    Email
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    45%
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <FaLinkedin className="text-sky-800" />
                    LinkedIn
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    38%
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <FaWhatsapp className="text-emerald-600" aria-hidden />
                    WhatsApp
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
                    disabled={
                      !ACCOUNT_BOOK_REBUILD_ENABLED ||
                      bookStatus === 'running' ||
                      retryingBook
                    }
                    title={
                      ACCOUNT_BOOK_REBUILD_ENABLED
                        ? undefined
                        : 'Account book rebuild is temporarily unavailable.'
                    }
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
            <AccountBookProspectsTable
              campaignId={id}
              rows={accountBookProspects}
              dripReady={campaign.dripCampaignStatus === 'complete'}
              onReload={() => loadProspects({ silent: true })}
            />
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
              Each prospect row gets its own five- to seven-step sequence across
              email, LinkedIn, and WhatsApp, written from your campaign goal and
              account-book context. Open any row to review or edit copy; nothing
              sends until we ship the execution layer.
            </p>
            {campaign.dripCampaignStatus === 'complete' &&
            campaign.dripCampaignGeneratedAt ? (
              <p className="mt-2 text-xs font-medium text-emerald-800">
                Last generated {formatDate(campaign.dripCampaignGeneratedAt)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                channel: 'email',
                title: 'Email — depth and narrative',
                body: 'Multi-touch threads for proof, ROI, and scheduling asks. When live, we will track opens, clicks, bounces, and reply rate per step.',
                Icon: MdOutlineEmail,
                border: 'border-sky-200 bg-sky-50',
              },
              {
                channel: 'linkedin',
                title: 'LinkedIn — timing and trust',
                body: 'Connection notes and short DMs aligned to signals from the book. Execution will enforce daily invite caps and thread state so reps do not double-ping.',
                Icon: FaLinkedin,
                border: 'border-slate-200 bg-white',
              },
              {
                channel: 'whatsapp',
                title: 'WhatsApp — high-intent follow-up',
                body: 'Short, consent-aware nudges after warmer touches. Sending will require opted-in numbers and template compliance; metrics will mirror read receipts and replies.',
                Icon: FaWhatsapp,
                border: 'border-emerald-200 bg-emerald-50/60',
              },
            ].map((step) => {
              const Icon = step.Icon
              return (
                <article
                  key={step.channel}
                  className={`rounded-2xl border p-5 shadow-sm ${step.border}`}
                >
                  <Icon
                    className="shrink-0 text-slate-800"
                    size={24}
                    aria-hidden
                  />
                  <h3 className="mt-3 text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {step.body}
                  </p>
                </article>
              )
            })}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                Metrics we will expose at send time
              </span>
              <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                <li>Per-step delivery, replies, and meetings booked</li>
                <li>Channel lift compared to single-channel baselines</li>
                <li>Time-to-first-reply and sequence completion funnel</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                Guardrails (design + future execution)
              </span>
              <p className="mt-2">
                Copy is grounded in account-book fields (role, company, signals,
                “why this person”). LinkedIn cadence stays conservative; WhatsApp
                only where a number exists and policy allows. Regenerating a drip
                overwrites stored sequences — rebuild the account book first if
                you need a fresh audience.
              </p>
            </div>
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
