'use client'

import { useState } from 'react'
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

  const handleGenerateAccounts = async () => {
    setLoading(true)
    setLoadingMessage('Scanning market signals...')
    setAccounts([])
    setMessages({})
    setOutreachLoading({})
    setCopiedState({})
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
        },
      }))
    } catch (error) {
      console.error(error)
      setMessages((prev) => ({
        ...prev,
        [company]: {
          linkedin: '',
          email: '',
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">GTM Account Generator</h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600">
            Add your ICP and signal to generate target accounts.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium text-slate-900">Results</h2>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <IoMdMail className="h-4 w-4" />
              Bulk Outreach Email
            </button>
          </div>
          {loading ? (
            <p className="mt-2 text-sm text-slate-600">{loadingMessage}</p>
          ) : accounts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No accounts generated yet. Add ICP details, choose a signal, and click Generate Accounts.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {accounts.map((account, index) => (
                <div
                  key={`${account.name}-${index}`}
                  className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
                >
                  <h3 className="text-base font-semibold text-slate-900">{account.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{account.reason}</p>
                  <button
                    type="button"
                    onClick={() => handleGenerateOutreach(account.name, account.reason)}
                    disabled={Boolean(outreachLoading[account.name])}
                    className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {outreachLoading[account.name] ? 'Generating...' : 'Generate Outreach'}
                  </button>

                  {outreachLoading[account.name] ? (
                    <p className="mt-3 text-xs text-slate-500">Writing outreach...</p>
                  ) : messages[account.name] ? (
                    <div className="mt-4 space-y-4 rounded-md bg-slate-50 p-4">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            LinkedIn message
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(account.name, 'linkedin', messages[account.name].linkedin)
                            }
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {copiedState[`${account.name}-linkedin`] ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {messages[account.name].linkedin}
                        </p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <FaLinkedin size={15} />
                          Send LinkedIn
                        </button>
                      </div>
                      <hr className="my-2 border-slate-200" />
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Email
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(account.name, 'email', messages[account.name].email)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {copiedState[`${account.name}-email`] ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {messages[account.name].email}
                        </p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <IoMdMail size={15} />
                          Send Mail
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}