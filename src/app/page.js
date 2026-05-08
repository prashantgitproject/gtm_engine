'use client'
import AppLayout from '@/components/layout/AppLayout'
import React from 'react'
import Link from 'next/link'

const page = () => {
  const highlights = [
    { label: 'Signal-Matched Companies', value: '362' },
    { label: 'Qualified Prospects', value: '87' },
    { label: 'Active Signals', value: '5 of 6' },
    { label: 'Channels Per Prospect', value: 'Up to 3' },
  ];

  const accountBookSteps = [
    {
      title: 'Signal Match Intake',
      detail:
        'Bring in companies that hit your GTM triggers, then filter by ICP fit and dedupe against your active pipeline.',
    },
    {
      title: 'Dual Enrichment (Bitscale + Clay)',
      detail:
        'Enrich firmographics, HRIS stack, contact roles, verified emails, LinkedIn URLs, and buying context in one flow.',
    },
    {
      title: 'Proof-Backed Account Book',
      detail:
        'Create a ready-to-use account book with fit score, why-now reason, triggered signals, and supporting evidence.',
    },
  ];

  const outreachSteps = [
    {
      title: 'Context-First Message Drafting',
      detail:
        'Generate outreach tailored to each prospect using account-book insights like pain, timing window, and trigger events.',
    },
    {
      title: 'Multi-Channel Sequence',
      detail:
        'Launch coordinated touches across Email, LinkedIn, and Reddit community plays with channel-specific messaging.',
    },
    {
      title: 'Launch + CRM Write-Back',
      detail:
        'Sync qualified prospects and outreach context back to CRM so sales can track progress without manual copy-paste.',
    },
  ];

  const featureCards = [
    {
      title: 'Account Book Creation',
      points: [
        'Prospect scoring based on ICP + signal weight',
        'Decision-maker mapping with verified contact paths',
        'Evidence snippets that explain why each account is in-book',
      ],
    },
    {
      title: 'Outreach Engine',
      points: [
        'Personalized message drafts per prospect and channel',
        'Touch sequencing by day and channel type',
        'Brand-safe tone with practical call-to-action framing',
      ],
    },
    {
      title: 'Execution Readiness',
      points: [
        'Deduping logic to avoid pipeline overlap',
        'Fast handoff from research to outbound action',
        'Mobile-friendly visibility for founders and sales leads',
      ],
    },
  ];

  const faqs = [
    {
      q: 'What is GTM Engine built for?',
      a: 'GTM Engine helps teams create account books from buying signals and run personalized outreach without losing execution speed.',
    },
    {
      q: 'Does this include full-funnel automation?',
      a: 'No. This experience is focused only on top-of-funnel account book creation and outreach execution.',
    },
    {
      q: 'How does GTM Engine improve outreach quality?',
      a: 'Every message is generated from real account context such as pain points, recent events, and role-level priorities.',
    },
    {
      q: 'Can teams use this on mobile?',
      a: 'Yes. The homepage is designed mobile-first with responsive sections for quick scanning and action.',
    },
  ];

  return (
    <div className='min-h-screen bg-slate-50'>
      <section className='mx-auto w-full max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-8'>
        <div className='rounded-3xl bg-gradient-to-r from-cyan-900 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-10'>
          <p className='mb-3 inline-flex rounded-full border border-cyan-300/40 bg-cyan-900/30 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100'>
            GTM Engine Product Playbook
          </p>
          <h1 className='text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl'>
            Build Account Books Fast.
            <br />
            Launch Outreach That Converts.
          </h1>
          <p className='mt-4 max-w-2xl text-sm text-cyan-50 sm:text-base'>
            GTM Engine turns market signals into qualified account books and personalized outreach workflows. Built for teams that want focused, top-of-funnel execution.
          </p>
          <div className='mt-6 flex flex-col gap-3 sm:flex-row'>
            <Link href='/dashboard' className='rounded-xl bg-cyan-400 px-5 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-cyan-300'>
              Start Building Account Book
            </Link>
            <Link href='/dashboard' className='rounded-xl border border-cyan-200/40 px-5 py-3 text-center text-sm font-semibold text-cyan-100 hover:bg-white/10'>
              Explore Outreach Flow
            </Link>
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {highlights.map((item) => (
            <div key={item.label} className='rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm'>
              <p className='text-lg font-bold text-slate-900 sm:text-2xl'>{item.value}</p>
              <p className='mt-1 text-xs text-slate-600 sm:text-sm'>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8'>
        <div className='grid gap-6 lg:grid-cols-2'>
          <div className='rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm'>
            <h2 className='text-2xl font-bold text-slate-900'>Account Book Creation</h2>
            <p className='mt-2 text-sm text-slate-600'>
              Convert raw signal hits into high-confidence prospect records your team can immediately act on.
            </p>
            <div className='mt-5 space-y-4'>
              {accountBookSteps.map((step, index) => (
                <div key={step.title} className='rounded-xl bg-cyan-50 p-4'>
                  <p className='text-sm font-semibold text-cyan-900'>{`Step ${index + 1}: ${step.title}`}</p>
                  <p className='mt-1 text-sm text-slate-700'>{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded-2xl border border-violet-200 bg-white p-6 shadow-sm'>
            <h2 className='text-2xl font-bold text-slate-900'>Outreach Execution</h2>
            <p className='mt-2 text-sm text-slate-600'>
              Turn every qualified account into personalized multi-channel outreach with clear sequencing.
            </p>
            <div className='mt-5 space-y-4'>
              {outreachSteps.map((step, index) => (
                <div key={step.title} className='rounded-xl bg-violet-50 p-4'>
                  <p className='text-sm font-semibold text-violet-900'>{`Step ${index + 1}: ${step.title}`}</p>
                  <p className='mt-1 text-sm text-slate-700'>{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8'>
        <h2 className='text-2xl font-bold text-slate-900 sm:text-3xl'>Why Teams Choose GTM Engine</h2>
        <p className='mt-2 max-w-3xl text-sm text-slate-600 sm:text-base'>
          Everything is optimized for one job: help you find the right accounts and execute outreach with better context and less manual work.
        </p>
        <div className='mt-6 grid gap-4 md:grid-cols-3'>
          {featureCards.map((card) => (
            <div key={card.title} className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
              <h3 className='text-lg font-bold text-slate-900'>{card.title}</h3>
              <ul className='mt-3 space-y-2 text-sm text-slate-700'>
                {card.points.map((point) => (
                  <li key={point} className='flex items-start gap-2'>
                    <span className='mt-1 h-2 w-2 rounded-full bg-cyan-500' />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className='mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8'>
        <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8'>
          <h2 className='text-2xl font-bold text-slate-900 sm:text-3xl'>Frequently Asked Questions</h2>
          <div className='mt-6 space-y-4'>
            {faqs.map((item) => (
              <div key={item.q} className='rounded-xl border border-slate-200 p-4'>
                <h3 className='text-base font-semibold text-slate-900'>{item.q}</h3>
                <p className='mt-2 text-sm text-slate-700'>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8'>
        <div className='rounded-2xl bg-slate-900 p-6 text-center text-white sm:p-8'>
          <h2 className='text-2xl font-bold sm:text-3xl'>Ready to run focused top-of-funnel GTM?</h2>
          <p className='mx-auto mt-2 max-w-2xl text-sm text-slate-300 sm:text-base'>
            Start with account book creation, then move into targeted outreach sequences in one streamlined workflow.
          </p>
          <div className='mt-6'>
            <Link href='/dashboard' className='inline-flex rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300'>
              Get Started with GTM Engine
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AppLayout()(page);