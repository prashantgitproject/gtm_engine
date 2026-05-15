'use client'

import { FaLinkedin, FaWhatsapp } from 'react-icons/fa'
import { MdOutlineEmail } from 'react-icons/md'
import React, { useCallback, useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'

const CHANNEL_OPTIONS = [
  {
    id: 'email',
    label: 'Email',
    Icon: MdOutlineEmail,
    description: 'Sends from your verified Brevo sender domain.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    Icon: FaLinkedin,
    description: 'Direct messages via your connected Linkup account.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    description: 'Text messages to prospects with a mobile number on file.',
  },
]

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onLaunch: (opts: { channels: string[], deliveryHour: number }) => void,
 *   launching: boolean,
 *   defaultDeliveryHour?: number,
 * }} props
 */
export function LaunchCampaignModal({
  open,
  onClose,
  onLaunch,
  launching,
  defaultDeliveryHour = 11,
}) {
  const [channels, setChannels] = useState({
    email: true,
    linkedin: true,
    whatsapp: false,
  })
  const [integrations, setIntegrations] = useState({
    email: { ready: false, label: 'Loading…' },
    linkedin: { ready: false, label: 'Loading…' },
    whatsapp: { ready: false, label: 'Loading…' },
  })

  const loadIntegrations = useCallback(async () => {
    try {
      const [emailRes, linkedinRes, waRes] = await Promise.all([
        fetch('/api/settings/email-domain'),
        fetch('/api/settings/linkedin'),
        fetch('/api/settings/whatsapp'),
      ])
      const email = await emailRes.json().catch(() => ({}))
      const linkedin = await linkedinRes.json().catch(() => ({}))
      const wa = await waRes.json().catch(() => ({}))

      setIntegrations({
        email: {
          ready: Boolean(email.configured && email.authenticated),
          label: email.configured
            ? email.authenticated
              ? `Ready · ${email.domain}`
              : 'Domain not authenticated'
            : 'Not connected',
        },
        linkedin: {
          ready: Boolean(linkedin.connected && linkedin.linkupAccountId),
          label: linkedin.connected ? 'Connected' : 'Not connected',
        },
        whatsapp: {
          ready: Boolean(wa.connected && wa.phoneNumberId),
          label: wa.connected ? 'Connected' : 'Not connected',
        },
      })
    } catch {
      setIntegrations({
        email: { ready: false, label: 'Could not load' },
        linkedin: { ready: false, label: 'Could not load' },
        whatsapp: { ready: false, label: 'Could not load' },
      })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    loadIntegrations()
  }, [open, loadIntegrations])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const selected = CHANNEL_OPTIONS.filter((c) => channels[c.id]).map((c) => c.id)

  const handleSubmit = (e) => {
    e.preventDefault()
    onLaunch?.({ channels: selected, deliveryHour: defaultDeliveryHour })
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <FiX size={20} />
        </button>

        <h2 id="launch-modal-title" className="text-xl font-bold text-slate-900">
          Launch campaign
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Choose which channels to activate. Each touch is scheduled for{' '}
          <strong className="font-semibold text-slate-800">{defaultDeliveryHour}:00</strong>{' '}
          on its drip day (day 1 = today). To edit copy or timing per prospect, expand a row in
          the account book.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Channels
            </legend>
            {CHANNEL_OPTIONS.map(({ id, label, Icon, description }) => {
              const integ = integrations[id]
              const checked = channels[id]
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                    checked
                      ? 'border-sky-300 bg-sky-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-slate-300 text-sky-800 focus:ring-sky-500"
                    checked={checked}
                    onChange={(e) =>
                      setChannels((prev) => ({ ...prev, [id]: e.target.checked }))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="shrink-0 text-slate-800" size={18} aria-hidden />
                      <span className="font-semibold text-slate-900">{label}</span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                          integ.ready
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                            : 'bg-amber-50 text-amber-700 ring-amber-100'
                        }`}
                      >
                        {integ.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{description}</p>
                  </div>
                </label>
              )
            })}
          </fieldset>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Steps on unchecked channels are skipped. A background job runs every 15 minutes to
            deliver messages that are due.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={launching}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={launching || selected.length === 0}
              className="rounded-xl bg-gradient-to-r from-sky-800 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-sky-900 hover:to-cyan-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
            >
              {launching ? 'Launching…' : 'Start outreach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
