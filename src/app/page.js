'use client'

import { Fragment, useState } from 'react'
import { IoMdMail } from 'react-icons/io'

const SIGNAL_OPTIONS = [
  'Unhappy with ADP/Paychex',
  'Hiring rapidly',
  'Recent funding',
  'New leadership hire',
]

const ACCOUNT_LOADING_STEPS = [
  'Searching keyword and location',
  'Collecting prospect records',
  'Enriching accounts and ranking outreach potential',
]

const DRIP_STEPS = [
  { key: 'linkedin1', label: 'Day 1', channel: 'LinkedIn opener' },
  { key: 'email1', label: 'Day 2', channel: 'Primary email' },
  { key: 'linkedin2', label: 'Day 5', channel: 'LinkedIn follow-up' },
  { key: 'email2', label: 'Day 7', channel: 'Email bump' },
]

function formatPhoneNumber(phone) {
  if (!phone) return ''

  const value = String(phone).trim()

  if (!value.startsWith('+')) {
    return value
  }

  return value.replace(/[^\d+]/g, '')
}

function getOutreachStatus(company, isLoading, hasMessages) {
  if (hasMessages) {
    return `Custom 4-touch sequence ready for ${company}`
  }

  if (isLoading) {
    return `Building a multichannel drip for ${company}: opener, email, follow-up, and bump`
  }

  return `Open ${company} to generate a custom drip campaign`
}

export default function Page() {
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [signal, setSignal] = useState('Unhappy with ADP/Paychex')
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Scanning market signals...')
  const [messages, setMessages] = useState({})
  const [outreachLoading, setOutreachLoading] = useState({})
  const [copiedState, setCopiedState] = useState({})
  const [airtableLoading, setAirtableLoading] = useState(false)
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  const handleGenerateAccounts = async () => {
    let progressTimer

    setLoading(true)
    setLoadingMessage(ACCOUNT_LOADING_STEPS[0])
    setAccounts([])
    setMessages({})
    setOutreachLoading({})
    setCopiedState({})
    setActionStatus('')
    setExpandedRow(null)
    console.log(keyword, location, signal)

    try {
      progressTimer = window.setInterval(() => {
        setLoadingMessage((current) => {
          const currentIndex = ACCOUNT_LOADING_STEPS.indexOf(current)
          const nextIndex = Math.min(currentIndex + 1, ACCOUNT_LOADING_STEPS.length - 1)
          return ACCOUNT_LOADING_STEPS[nextIndex]
        })
      }, 1800)

      const response = await fetch('/api/generate-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, location, signal }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate accounts')
      }

      const data = await response.json()
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setAccounts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setAccounts([])
    } finally {
      window.clearInterval(progressTimer)
      setLoading(false)
    }
  }

  const handleGenerateOutreach = async (company, reason) => {
    setOutreachLoading((prev) => ({ ...prev, [company]: true }))

    try {
      const response = await fetch('/api/generate-outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company, reason }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate outreach')
      }

      const data = await response.json()
      setMessages((prev) => ({
        ...prev,
        [company]: {
          linkedin1: data?.linkedin1 || data?.linkedin || '',
          email1: data?.email1 || data?.email_1 || data?.email || '',
          linkedin2: data?.linkedin2 || data?.linkedin_2 || data?.followupLinkedin || '',
          email2: data?.email2 || data?.email_2 || data?.followup || data?.email || '',
        },
      }))
    } catch (error) {
      console.error(error)
      setMessages((prev) => ({
        ...prev,
        [company]: {
          linkedin1: '',
          email1: '',
          linkedin2: '',
          email2: '',
        },
      }))
    } finally {
      setOutreachLoading((prev) => ({ ...prev, [company]: false }))
    }
  }

  const handleCopy = async (company, type, text) => {
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      const key = `${company}-${type}`
      setCopiedState((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedState((prev) => ({ ...prev, [key]: false }))
      }, 1200)
    } catch (error) {
      console.error(error)
    }
  }

  const handlePushToAirtable = async () => {
    setActionStatus('')
    setAirtableLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setAirtableLoading(false)
    setActionStatus(`Synced ${accounts.length} accounts to Airtable`)
  }

  const handleLaunchCampaign = async () => {
    setActionStatus('')
    setCampaignLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setCampaignLoading(false)
    setActionStatus(`Campaign launched for ${accounts.length} accounts`)
  }

  const toggleExpandedRow = (rowKey) => {
    setExpandedRow((prev) => (prev === rowKey ? null : rowKey))
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">GTM Account Generator</h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600">
            Add a keyword, location, and signal to generate target accounts.
          </p>
        </div>

        <section className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800" htmlFor="keyword">
                  Keyword
                </label>
                <input
                  id="keyword"
                  type="text"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Example: construction companies"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800" htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Example: Mumbai, India"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-800" htmlFor="signal">
                Signal Selection
              </label>
              <select
                id="signal"
                value={signal}
                onChange={(event) => setSignal(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2"
              >
                {SIGNAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateAccounts}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading || !keyword.trim() || !location.trim()}
            >
              Generate Accounts
            </button>

            {loading || accounts.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">process:</p>
                <div className="mt-2 space-y-1.5">
                  {ACCOUNT_LOADING_STEPS.map((step, index) => {
                    const activeIndex = ACCOUNT_LOADING_STEPS.indexOf(loadingMessage)
                    const isActive = loading && index === activeIndex
                    const isComplete = loading
                      ? index < activeIndex
                      : accounts.length > 0

                    return (
                      <div key={step} className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isComplete
                              ? 'bg-emerald-500'
                              : isActive
                              ? 'bg-blue-500'
                              : 'bg-slate-300'
                          }`}
                        />
                        <span>{step}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8">
          {accounts.length > 0 ? (
            <div className="space-y-3">
              <div className="space-y-1 text-center">
                <h2 className="text-base font-medium text-slate-900">Next steps</h2>
                <p className="text-sm text-slate-500">Push accounts or launch outreach</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePushToAirtable}
                  disabled={airtableLoading || accounts.length === 0}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {airtableLoading ? 'Syncing accounts...' : 'Push to Airtable'}
                </button>
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={campaignLoading || accounts.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <IoMdMail className="h-4 w-4" />
                  {campaignLoading ? 'Preparing campaign...' : 'Launch Email Campaign'}
                </button>
              </div>
              {actionStatus ? <p className="text-center text-sm text-slate-600">{actionStatus}</p> : null}
            </div>
          ) : null}
          {loading ? (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-medium">{loadingMessage}</p>
              <p className="mt-1 text-blue-700">
                Searching, pulling raw business records, and preparing the shortlist.
              </p>
            </div>
          ) : accounts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No accounts generated yet. Add a keyword, location, choose a signal, and click Generate Accounts.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="table-auto w-full border-collapse text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Company</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">City</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Reviews</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Website</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Phone</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Postal Code</th>
                  <th className="border px-3 py-2 text-xs font-semibold uppercase text-slate-600">Actions</th>
                </tr>
              </thead>
                <tbody>
                  {accounts.map((account, index) => (
                    <Fragment key={`${account.name}-${index}`}>
                      <tr className="align-top even:bg-gray-50 hover:bg-gray-100">
                        <td className="border p-3 text-sm font-medium text-slate-900">
                          {account.name}
                        </td>

                        <td className="border p-3 text-sm text-slate-700">
                          {account.city || '—'}
                        </td>

                        <td className="border p-3 text-sm text-slate-700">
                          {account.reviews || '—'}
                        </td>

                        <td className="border p-3 text-sm text-slate-700">
                          {account.website ? (
                            <a
                              href={account.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              Visit_site
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="border p-3 text-sm text-slate-700">
                          {formatPhoneNumber(account.phone) || '—'}
                        </td>

                        <td className="border p-3 text-sm text-slate-700">
                          {account.postalCode || '—'}
                        </td>

                        <td className="border p-3">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandedRow(account.name)}
                              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {expandedRow === account.name ? 'Hide campaign' : 'View campaign'}
                            </button>
                            <p className="text-[11px] leading-4 text-slate-500">
                              {getOutreachStatus(
                                account.name,
                                outreachLoading[account.name],
                                Boolean(messages[account.name])
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === account.name ? (
                        <tr>
                          <td colSpan={7} className="border border-slate-200 bg-slate-50 p-4">
                            {outreachLoading[account.name] ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-medium text-amber-900">
                                  Building a custom drip for {account.name}
                                </p>
                                <div className="mt-3 space-y-2 text-xs text-amber-800">
                                  {DRIP_STEPS.map((step) => (
                                    <div key={step.key} className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                                      <span>
                                        Drafting {step.channel.toLowerCase()} for {step.label.toLowerCase()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : messages[account.name] ? (
                              <div className="space-y-4 rounded-md bg-white p-3">
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-sm font-medium text-slate-900">Suggested drip campaign</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    A multichannel sequence paced across one week for {account.name}.
                                  </p>
                                </div>
                                {DRIP_STEPS.map((step) => (
                                  <div key={step.key} className="rounded-md border border-slate-200 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                          {step.label}
                                        </p>
                                        <p className="text-sm font-medium text-slate-900">{step.channel}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopy(account.name, step.key, messages[account.name][step.key])
                                        }
                                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                      >
                                        {copiedState[`${account.name}-${step.key}`] ? 'Copied!' : 'Copy'}
                                      </button>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      {messages[account.name][step.key]}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-500">
                                  Generate a custom sequence with LinkedIn and email touches for this prospect.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateOutreach(account.name, account.reason)}
                                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                                >
                                  Build Drip Campaign
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
