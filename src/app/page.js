'use client'

import { Fragment, useState } from 'react'
import { FaLinkedin } from 'react-icons/fa'
import { IoMdMail } from 'react-icons/io'

const SIGNAL_OPTIONS = [
  'Unhappy with ADP/Paychex',
  'Hiring rapidly',
  'Recent funding',
  'New leadership hire',
]

export default function Page() {
  const [icp, setIcp] = useState('')
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
    setLoading(true)
    setLoadingMessage('Scanning market signals...')
    setAccounts([])
    setMessages({})
    setOutreachLoading({})
    setCopiedState({})
    setActionStatus('')
    setExpandedRow(null)
    console.log(icp, signal)

    try {
      const response = await fetch('/api/generate-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ icp, signal }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate accounts')
      }

      setLoadingMessage('Building account book...')
      const data = await response.json()
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setAccounts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setAccounts([])
    } finally {
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
          linkedin: data?.linkedin || '',
          email: data?.email || '',
          email1: data?.email1 || data?.email_1 || data?.email || '',
          email2: data?.email2 || data?.email_2 || data?.followup || data?.email || '',
        },
      }))
    } catch (error) {
      console.error(error)
      setMessages((prev) => ({
        ...prev,
        [company]: {
          linkedin: '',
          email: '',
          email1: '',
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
            Add your ICP and signal to generate target accounts.
          </p>
        </div>

        <section className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-800" htmlFor="icp">
                ICP Input
              </label>
              <textarea
                id="icp"
                value={icp}
                onChange={(event) => setIcp(event.target.value)}
                placeholder="Example: 100-500 employee US-based fintech companies with distributed teams..."
                className="h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2"
              />
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
              disabled={loading}
            >
              Generate Accounts
            </button>
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
            <p className="mt-2 text-sm text-slate-600">{loadingMessage}</p>
          ) : accounts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No accounts generated yet. Add ICP details, choose a signal, and click Generate Accounts.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="table-auto w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                      Company
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                      Industry
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                      Reason
                    </th>
                    <th className="border border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account, index) => (
                    <Fragment key={`${account.name}-${index}`}>
                      <tr className="align-top even:bg-gray-50 hover:bg-gray-100">
                        <td className="border border-slate-200 p-3 text-sm font-medium text-slate-900">
                          {account.name}
                        </td>
                        <td className="border border-slate-200 p-3 text-sm text-slate-700">
                          {account.industry || 'General'}
                        </td>
                        <td className="border border-slate-200 p-3 text-sm leading-6 text-slate-700">
                          <p className="whitespace-nowrap">
                            {account.reason}
                          </p>
                        </td>
                        <td className="border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                          {/* <button
                            type="button"
                            onClick={() => handleGenerateOutreach(account.name, account.reason)}
                            disabled={Boolean(outreachLoading[account.name])}
                            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {outreachLoading[account.name] ? 'Generating...' : 'Generate Outreach'}
                          </button> */}
                          <button
                            type="button"
                            onClick={() => toggleExpandedRow(account.name)}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            {expandedRow === account.name ? 'Collapse' : 'Expand'}
                          </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === account.name ? (
                        <tr>
                          <td colSpan={4} className="border border-slate-200 bg-slate-50 p-4">
                            {outreachLoading[account.name] ? (
                              <p className="text-xs text-slate-500">Writing outreach...</p>
                            ) : messages[account.name] ? (
                              <div className="space-y-4 rounded-md bg-white p-3">
                                <div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      LinkedIn DM
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopy(account.name, 'linkedin', messages[account.name].linkedin)
                                      }
                                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      {copiedState[`${account.name}-linkedin`] ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {messages[account.name].linkedin}
                                  </p>
                                </div>
                                <hr className="my-2 border-slate-200" />
                                <div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Email 1
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopy(
                                          account.name,
                                          'email1',
                                          messages[account.name].email1 || messages[account.name].email
                                        )
                                      }
                                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      {copiedState[`${account.name}-email1`] ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {messages[account.name].email1 || messages[account.name].email}
                                  </p>
                                </div>
                                <hr className="my-2 border-slate-200" />
                                <div>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Email 2
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopy(
                                          account.name,
                                          'email2',
                                          messages[account.name].email2 || messages[account.name].email
                                        )
                                      }
                                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      {copiedState[`${account.name}-email2`] ? 'Copied!' : 'Copy'}
                                    </button>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {messages[account.name].email2 || messages[account.name].email}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-500">
                                  Outreach not generated yet.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateOutreach(account.name, account.reason)}
                                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                                >
                                  Generate Outreach
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