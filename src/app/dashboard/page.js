'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import React from 'react'
import {
  MdOutlineCampaign,
  MdOutlineEmail,
  MdOutlineHub,
  MdOutlineTrendingUp,
} from 'react-icons/md'
import { FaLinkedin } from 'react-icons/fa'
import { SiHubspot, SiOpenai, SiSlack } from 'react-icons/si'
import { FiActivity, FiCheckCircle, FiSend } from 'react-icons/fi'

const runningMetrics = [
  {
    label: 'Active sends (24h)',
    value: '1,284',
    delta: '+12% vs prior day',
    positive: true,
    icon: FiSend,
  },
  {
    label: 'Reply rate',
    value: '6.4%',
    delta: '+0.8 pts',
    positive: true,
    icon: MdOutlineEmail,
  },
  {
    label: 'Meetings booked',
    value: '14',
    delta: '3 from LinkedIn',
    positive: true,
    icon: FiCheckCircle,
  },
  {
    label: 'Pipeline influenced',
    value: '$480k',
    delta: 'Demo — not live data',
    positive: null,
    icon: MdOutlineTrendingUp,
  },
]

const runningCampaigns = [
  {
    name: 'Q2 — HRIS expansion',
    status: 'Running',
    channels: 'Email · LinkedIn',
    progress: 72,
    sent: '612 / 850',
  },
  {
    name: 'Signal follow-up — fintech',
    status: 'Running',
    channels: 'Email · Reddit',
    progress: 41,
    sent: '214 / 520',
  },
  {
    name: 'SMB warm intro drip',
    status: 'Paused',
    channels: 'Email',
    progress: 18,
    sent: '94 / 500',
  },
]

const demoCampaigns = [
  {
    name: 'Clay → Bitscale enrichment path',
    blurb:
      'Sample flow that merges firmographics plus contact hygiene before sequencing.',
    badge: 'Template',
    tone: 'cyan',
  },
  {
    name: 'Executive multi-thread (3 touches)',
    blurb:
      'Demonstrates pacing across DM, email opener, and a light nudge cadence.',
    badge: 'Playbook',
    tone: 'violet',
  },
  {
    name: 'Conference follow-up cohort',
    blurb:
      'Reuse post-event replies with placeholders for booth scans and titles.',
    badge: 'Cohort',
    tone: 'slate',
  },
]

const integrations = [
  {
    name: 'HubSpot CRM',
    state: 'Connected',
    detail: 'Write-back for qualified replies',
    icon: SiHubspot,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    connected: true,
  },
  {
    name: 'LinkedIn Outreach',
    state: 'Connected',
    detail: 'Connection requests & DMs scoped',
    icon: FaLinkedin,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    connected: true,
  },
  {
    name: 'Slack Alerts',
    state: 'Not connected',
    detail: 'Notify #gtm when a hot reply lands',
    icon: SiSlack,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    connected: false,
  },
  {
    name: 'OpenAI drafting',
    state: 'Connected',
    detail: 'Context-grounded variants per persona',
    icon: SiOpenai,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    connected: true,
  },
]

const page = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              Operations overview
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Demo workspace: live-feeling metrics, active runs, sandbox
              campaigns, and integration health in one glance.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            <FiActivity className="text-emerald-600" aria-hidden />
            <span>Pipelines syncing on schedule</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8 sm:px-8 lg:py-10">
        <section aria-labelledby="running-metrics-heading">
          <div className="mb-4 flex items-center gap-2">
            <MdOutlineHub className="text-sky-800" size={22} aria-hidden />
            <h2
              id="running-metrics-heading"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              Running metrics
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {runningMetrics.map((metric) => {
              const Icon = metric.icon
              return (
                <article
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-600">
                      {metric.label}
                    </p>
                    <span className="rounded-lg bg-slate-50 p-2 text-slate-700">
                      <Icon size={18} aria-hidden />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    {metric.value}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      metric.positive === true
                        ? 'text-emerald-700'
                        : metric.positive === false
                          ? 'text-rose-600'
                          : 'text-slate-500'
                    }`}
                  >
                    {metric.delta}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="running-campaigns-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <MdOutlineCampaign className="text-sky-800" size={24} aria-hidden />
              <h2
                id="running-campaigns-heading"
                className="text-lg font-bold text-slate-900 sm:text-xl"
              >
                Running campaigns
              </h2>
            </div>
            <Link
              href="/campaigns"
              className="inline-flex w-full items-center justify-center rounded-xl border border-sky-800 bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-50 sm:w-auto"
            >
              Show all campaigns
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {runningCampaigns.map((campaign) => (
              <article
                key={campaign.name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {campaign.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {campaign.channels}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      campaign.status === 'Running'
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                        : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Progress</span>
                    <span className="font-medium text-slate-800">
                      {campaign.sent}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-800 to-cyan-500"
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="demo-campaigns-heading">
          <div className="mb-4 flex items-center gap-2">
            <FiActivity className="text-violet-700" size={22} aria-hidden />
            <h2
              id="demo-campaigns-heading"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              Demo campaigns
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {demoCampaigns.map((item) => {
              const badgeStyles =
                item.tone === 'cyan'
                  ? 'bg-cyan-50 text-cyan-900 ring-cyan-100'
                  : item.tone === 'violet'
                    ? 'bg-violet-50 text-violet-900 ring-violet-100'
                    : 'bg-slate-100 text-slate-800 ring-slate-200'
              return (
                <article
                  key={item.name}
                  className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 shadow-inner"
                >
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badgeStyles}`}
                  >
                    {item.badge}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.blurb}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="integrations-heading">
          <div className="mb-4 flex items-center gap-2">
            <MdOutlineHub className="text-slate-800" size={22} aria-hidden />
            <h2
              id="integrations-heading"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              Integrations
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map((integration) => {
              const Icon = integration.icon
              return (
                <article
                  key={integration.name}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${integration.bg}`}
                  >
                    <Icon
                      className={integration.color}
                      size={24}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {integration.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          integration.connected
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {integration.state}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {integration.detail}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DashboardLayout()(page)
