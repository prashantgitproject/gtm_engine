'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import Loader from '@/components/shared/Loader'
import { useUser } from '@/context/UserContext'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import {
  FiBook,
  FiChevronLeft,
  FiLayers,
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

/** Deterministic demo rows so UI matches campaign context before backend exists */
function buildDemoProspects(campaign) {
  const signalPool = Array.isArray(campaign.signals) && campaign.signals.length
    ? campaign.signals
    : ['Hiring spike', 'ATS migration', 'New VP Sales']

  const rows = [
    {
      prospect: 'Northwind Logistics',
      person: 'Jordan Lee',
      role: 'VP Operations',
      email: 'j.lee@northwind-logistics.example',
      why: 'Recent 3PL RFP tied to warehouse automation push; persona matches economic buyer.',
      signals: [signalPool[0] ?? 'Growth signal', 'Series B press'].filter(
        Boolean
      ),
      score: 91,
    },
    {
      prospect: 'Helio Analytics',
      person: 'Samira Khan',
      role: 'Head of RevOps',
      email: 'skhan@helio-analytics.example',
      why: 'Tool stack change window; RevOps lead owns outbound tooling budget.',
      signals: [signalPool[1] ?? 'Stack change', 'New hire in sales ops'],
      score: 86,
    },
    {
      prospect: 'Cedar Retail Co.',
      person: 'Alex Morgan',
      role: 'Director of HRIS',
      email: 'amorgan@cedar-retail.example',
      why: 'Evidence of payroll consolidation plus open reqs in store ops.',
      signals: [signalPool[2] ?? 'HR tech refresh', 'Store expansion'].filter(
        Boolean
      ),
      score: 79,
    },
    {
      prospect: 'Boltline Manufacturing',
      person: 'Chris Ortiz',
      role: 'CIO',
      email: 'c.ortiz@boltline.example',
      why: 'Security questionnaire filed; indicates vendor review for comms tooling.',
      signals: ['Security review', signalPool[0] ?? 'Ops efficiency'],
      score: 74,
    },
    {
      prospect: 'Lumen Health',
      person: 'Priya Shah',
      role: 'Chief of Staff',
      email: 'pshah@lumen-health.example',
      why: 'Calendar density with vendors; stakeholder map shows budget approval path.',
      signals: ['Vendor meetings', 'New compliance initiative'],
      score: 82,
    },
  ]

  const name = campaign.name || 'Campaign'
  return rows.map((row, i) => ({
    ...row,
    prospect:
      i === 0 ? `${row.prospect} · ${name.slice(0, 24)}` : row.prospect,
  }))
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

const CampaignDetailPage = () => {
  const user = useUser()
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [accountBookProspects, setAccountBookProspects] = useState([])
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

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setLoading(false)
      setNotFound(true)
      return
    }
    if (user === undefined || user === null) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await fetch(`/api/campaigns/${id}`)
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
  }, [user, id])

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

  const handleCreateAccountBook = () => {
    if (!campaign) return
    const rows = buildDemoProspects(campaign)
    setAccountBookProspects(rows)
    toast.success('Account book created', {
      description: `${rows.length} demo prospects loaded for this campaign (replace with live enrichment when wired).`,
    })
  }

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
                onClick={handleCreateAccountBook}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 lg:flex-none"
              >
                <FiBook aria-hidden />
                Create account book
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
            {accountBookProspects.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800 ring-1 ring-slate-200">
                  {accountBookProspects.length} prospects
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-100">
                  Avg score {avgScore}
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-900 ring-1 ring-sky-100">
                  {signals.length} campaign signals
                </span>
              </div>
            )}
          </div>

          {accountBookProspects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-inner">
              <p className="text-base font-semibold text-slate-800">
                No account book yet
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
                Run enrichment to attach companies, decision makers, and
                evidence-backed &quot;why this person&quot; rows. This preview
                loads demo rows after you create the book.
              </p>
              <button
                type="button"
                onClick={handleCreateAccountBook}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <FiBook aria-hidden />
                Create account book
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3">Prospect</th>
                      <th className="px-4 py-3">Person</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="min-w-[16rem] px-4 py-3">
                        Why this person
                      </th>
                      <th className="min-w-[10rem] px-4 py-3">Signals</th>
                      <th className="px-4 py-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountBookProspects.map((row) => (
                      <tr
                        key={`${row.email}-${row.person}`}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="align-top px-4 py-3 font-semibold text-slate-900">
                          {row.prospect}
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
                          {row.why}
                        </td>
                        <td className="align-top px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.signals.map((sig) => (
                              <span
                                key={sig}
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
