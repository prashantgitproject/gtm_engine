'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import Loader from '@/components/shared/Loader'
import { useUser } from '@/context/UserContext'
import { analyzeWhatsAppBodyVariables } from '@/libs/whatsappTemplateBodyVariables'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiCheck, FiChevronDown, FiCopy, FiLink, FiMail } from 'react-icons/fi'
import { FaLinkedin } from 'react-icons/fa'
import { SiWhatsapp } from 'react-icons/si'
import { toast } from 'sonner'

function DnsRecordCard({ label, record }) {
  if (!record) return null
  const type = (record.type && String(record.type).trim()) || 'TXT'
  const host =
    record.host_name != null && String(record.host_name).trim() !== ''
      ? String(record.host_name)
      : '—'
  const value =
    record.value != null && String(record.value).trim() !== ''
      ? String(record.value)
      : '—'
  const ok = Boolean(record.status)
  const registrarBlock = `Type: ${type}\nHost: ${host}\nValue: ${value}`
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
            ok
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
              : 'bg-amber-50 text-amber-900 ring-amber-100'
          }`}
        >
          {ok ? (
            <>
              <FiCheck className="inline" size={14} aria-hidden />
              Verified
            </>
          ) : (
            'Pending'
          )}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Add this record at your DNS provider using the type, host, and value below.
      </p>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-900 sm:text-xs">
        {registrarBlock}
      </pre>
      <div className="mt-3 flex flex-wrap gap-3">
        {host !== '—' ? (
          <button
            type="button"
            onClick={() => copyValue(host, 'Host copied')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 hover:text-sky-950"
          >
            <FiCopy size={14} aria-hidden />
            Copy host
          </button>
        ) : null}
        {value !== '—' ? (
          <button
            type="button"
            onClick={() => copyValue(value, 'Value copied')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 hover:text-sky-950"
          >
            <FiCopy size={14} aria-hidden />
            Copy value
          </button>
        ) : null}
      </div>
    </div>
  )
}

async function copyValue(text, msg) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success(msg || 'Copied')
  } catch {
    toast.error('Could not copy to clipboard')
  }
}

function templateBodyPreview(components) {
  if (!Array.isArray(components)) return '—'
  const body = components.find((c) => c && String(c.type).toUpperCase() === 'BODY')
  const t = body?.text != null ? String(body.text) : ''
  if (!t) return '—'
  return t.length > 140 ? `${t.slice(0, 137)}…` : t
}

function IntegrationAccordion({
  iconSlot,
  title,
  description,
  expanded,
  onToggle,
  statusLabel,
  statusTone,
  statusDetail,
  busy,
  children,
}) {
  const badgeClass =
    statusTone === 'ok'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
      : statusTone === 'pending'
        ? 'bg-amber-50 text-amber-900 ring-amber-100'
        : 'bg-slate-100 text-slate-600 ring-slate-200'

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={busy}
        className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50/80 disabled:opacity-60 sm:gap-5 sm:p-6"
      >
        <div className="shrink-0">{iconSlot}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{description}</p>
            </div>
            <FiChevronDown
              className={`mt-1 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              size={22}
              aria-hidden
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badgeClass}`}
            >
              {statusLabel}
            </span>
            {statusDetail ? (
              <span className="line-clamp-1 text-sm text-slate-600">{statusDetail}</span>
            ) : null}
          </div>
        </div>
      </button>
      {expanded ? <div className="border-t border-slate-100 px-5 pb-6 pt-4 sm:px-8 sm:pb-8">{children}</div> : null}
    </div>
  )
}

const SettingsPage = () => {
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [emailState, setEmailState] = useState(null)
  const [linkedinState, setLinkedinState] = useState(null)
  const [linkedinLoading, setLinkedinLoading] = useState(false)
  const [whatsappState, setWhatsappState] = useState(null)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('')
  const [waAccessToken, setWaAccessToken] = useState('')
  const [waDisplayPhone, setWaDisplayPhone] = useState('')
  const [waBusinessAccountId, setWaBusinessAccountId] = useState('')
  const [waWabaPatch, setWaWabaPatch] = useState('')
  const [openIntegration, setOpenIntegration] = useState({
    linkedin: false,
    whatsapp: false,
    email: false,
  })
  const [waTemplates, setWaTemplates] = useState([])
  const [waTemplatesPaging, setWaTemplatesPaging] = useState(null)
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false)
  const [waTemplateCreateBusy, setWaTemplateCreateBusy] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplLang, setTplLang] = useState('en_US')
  const [tplCategory, setTplCategory] = useState('UTILITY')
  const [tplBody, setTplBody] = useState('')
  const [tplVarExamples, setTplVarExamples] = useState([])

  const tplBodyAnalysis = useMemo(() => analyzeWhatsAppBodyVariables(tplBody), [tplBody])

  const toggleIntegration = (key) => {
    setOpenIntegration((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const loadEmail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/email-domain')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not load email settings')
        setEmailState(null)
        return
      }
      setEmailState(data)
      if (data.domain && !data.configured) {
        setDomainInput('')
      }
    } catch (e) {
      console.error(e)
      toast.error('Could not load email settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user === undefined || user === null) return
    loadEmail()
  }, [user, loadEmail])

  const loadLinkedin = useCallback(async () => {
    setLinkedinLoading(true)
    try {
      const res = await fetch('/api/settings/linkedin')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkedinState(null)
        return
      }
      setLinkedinState(data)
    } catch {
      setLinkedinState(null)
    } finally {
      setLinkedinLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user === undefined || user === null) return
    loadLinkedin()
  }, [user, loadLinkedin])

  const loadWhatsapp = useCallback(async () => {
    setWhatsappLoading(true)
    try {
      const res = await fetch('/api/settings/whatsapp')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWhatsappState(null)
        return
      }
      setWhatsappState(data)
    } catch {
      setWhatsappState(null)
    } finally {
      setWhatsappLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user === undefined || user === null) return
    loadWhatsapp()
  }, [user, loadWhatsapp])

  const loadWaTemplates = useCallback(
    async (opts) => {
      const appendAfter =
        opts && typeof opts === 'object' && 'appendAfter' in opts ? opts.appendAfter : undefined
      if (!whatsappState?.connected) return
      setWaTemplatesLoading(true)
      try {
        const qs = appendAfter ? `?after=${encodeURIComponent(appendAfter)}` : ''
        const res = await fetch(`/api/settings/whatsapp/templates${qs}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const desc = data.hint ? `${data.hint}` : undefined
          toast.error(data.error || 'Could not load templates from Meta', desc ? { description: desc } : undefined)
          if (!appendAfter) {
            setWaTemplates([])
            setWaTemplatesPaging(null)
          }
          return
        }
        const rows = Array.isArray(data.data) ? data.data : []
        setWaTemplates((prev) => (appendAfter ? [...prev, ...rows] : rows))
        setWaTemplatesPaging(data.paging || null)
      } catch (e) {
        console.error(e)
        toast.error('Could not load templates')
        if (!appendAfter) {
          setWaTemplates([])
          setWaTemplatesPaging(null)
        }
      } finally {
        setWaTemplatesLoading(false)
      }
    },
    [whatsappState?.connected]
  )

  useEffect(() => {
    if (!whatsappState?.connected) {
      setWaTemplates([])
      setWaTemplatesPaging(null)
      return
    }
    loadWaTemplates()
  }, [whatsappState?.connected, loadWaTemplates])

  useEffect(() => {
    const a = analyzeWhatsAppBodyVariables(tplBody)
    if ('error' in a) {
      setTplVarExamples([])
      return
    }
    const n = a.count
    setTplVarExamples((prev) => Array.from({ length: n }, (_, i) => (i < prev.length ? prev[i] : '')))
  }, [tplBody])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('linkedin')
    if (!status) return
    if (status === 'connected') {
      toast.success('LinkedIn connected successfully.')
    } else if (status === 'oauth_error') {
      toast.error('LinkedIn authorization was denied or failed.')
    } else {
      toast.error('Could not connect LinkedIn. Please try again.')
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('linkedin')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const summary = useMemo(() => {
    if (!emailState?.configured) {
      return { tone: 'muted', label: 'Not connected', detail: 'Add your sending domain.' }
    }
    if (emailState.authenticated) {
      return {
        tone: 'ok',
        label: 'Connected',
        detail: `Sending domain: ${emailState.domain}`,
      }
    }
    return {
      tone: 'pending',
      label: 'DNS setup pending',
      detail: `Add the records below at ${emailState.domain}, then verify.`,
    }
  }, [emailState])

  const handleSaveDomain = async (e) => {
    e.preventDefault()
    const raw = domainInput.trim()
    if (!raw) {
      toast.error('Enter your domain')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: raw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not save domain')
        return
      }
      toast.success('Domain saved')
      setDomainInput('')
      await loadEmail()
    } catch (err) {
      console.error(err)
      toast.error('Could not save domain')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/settings/email-domain/verify', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Verification failed')
        await loadEmail()
        return
      }
      if (data.authenticated) {
        toast.success('Domain authenticated — email channel is ready.')
      } else if (data.authenticateFailed) {
        const pending = Array.isArray(data.pendingRecordHints)
          ? data.pendingRecordHints.filter(Boolean)
          : []
        if (pending.length > 0) {
          toast.error('The domain is not fully authenticated yet.', {
            description: `Still needed: ${pending.join(', ')}. Check the host and value at your DNS host, wait for propagation, then verify again.`,
          })
        } else if (data.allRecordsReportedOk) {
          toast.error(data.authenticateError || 'Authentication failed', {
            description:
              'DNS looks correct from here, but authentication did not complete. Wait a few minutes and try again. If it persists, check the DKIM value for extra quotes, spaces, or line breaks.',
          })
        } else {
          toast.error(data.authenticateError || 'Could not authenticate domain.')
        }
      } else {
        toast('Still waiting on DNS', {
          description:
            'Propagation can take a few minutes to hours. Confirm records match exactly, then try again.',
        })
      }
      await loadEmail()
    } catch (err) {
      console.error(err)
      toast.error('Verification request failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleDisconnect = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Remove this sender domain from your workspace? You can add it again later.'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email-domain', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not remove domain')
        return
      }
      toast.success('Sender domain removed')
      await loadEmail()
    } catch (err) {
      console.error(err)
      toast.error('Could not remove domain')
    } finally {
      setSaving(false)
    }
  }

  const handleWhatsappSave = async (e) => {
    e.preventDefault()
    const pid = waPhoneNumberId.trim()
    const tok = waAccessToken.trim()
    if (!pid || !tok) {
      toast.error('Enter Phone number ID and access token.')
      return
    }
    setWhatsappSaving(true)
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: pid,
          accessToken: tok,
          displayPhone: waDisplayPhone.trim() || undefined,
          whatsappBusinessAccountId: waBusinessAccountId.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const parts = [
          data.hint,
          data.metaDisplayPhone ? `Meta reports: ${data.metaDisplayPhone}` : '',
        ].filter(Boolean)
        const desc = parts.length ? parts.join(' ') : undefined
        toast.error(data.error || 'Could not connect WhatsApp', desc ? { description: desc } : undefined)
        return
      }
      toast.success('WhatsApp connected — token stored encrypted.')
      setWaAccessToken('')
      setWaBusinessAccountId('')
      await loadWhatsapp()
      setOpenIntegration((o) => ({ ...o, whatsapp: true }))
    } catch (err) {
      console.error(err)
      toast.error('Could not connect WhatsApp')
    } finally {
      setWhatsappSaving(false)
    }
  }

  const handleWhatsappDisconnect = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Disconnect WhatsApp from this workspace? Campaign sends will stop using this number.')
    ) {
      return
    }
    setWhatsappSaving(true)
    try {
      const res = await fetch('/api/settings/whatsapp', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not disconnect WhatsApp')
        return
      }
      toast.success('WhatsApp disconnected')
      setWaPhoneNumberId('')
      setWaDisplayPhone('')
      setWaBusinessAccountId('')
      await loadWhatsapp()
    } catch {
      toast.error('Could not disconnect WhatsApp')
    } finally {
      setWhatsappSaving(false)
    }
  }

  const handleWhatsappWabaPatch = async (e) => {
    e.preventDefault()
    const raw = waWabaPatch.trim()
    if (!/^\d+$/.test(raw)) {
      toast.error('WhatsApp Business Account ID must be digits only (no spaces or letters).')
      return
    }
    setWhatsappSaving(true)
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappBusinessAccountId: raw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not update WhatsApp Business Account ID')
        return
      }
      toast.success('WhatsApp Business Account ID saved.')
      setWaWabaPatch('')
      await loadWhatsapp()
    } catch {
      toast.error('Request failed')
    } finally {
      setWhatsappSaving(false)
    }
  }

  const handleLinkedinDisconnect = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Disconnect LinkedIn from this workspace?')
    ) {
      return
    }
    setLinkedinLoading(true)
    try {
      const res = await fetch('/api/settings/linkedin', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not disconnect LinkedIn')
        return
      }
      toast.success('LinkedIn disconnected')
      await loadLinkedin()
    } catch {
      toast.error('Could not disconnect LinkedIn')
    } finally {
      setLinkedinLoading(false)
    }
  }

  const dns = emailState?.dns_records
  const dkimEntries = useMemo(() => {
    if (!dns) return []
    if (Array.isArray(dns.dkim_records) && dns.dkim_records.length > 0) return dns.dkim_records
    if (dns.dkim_record) return [dns.dkim_record]
    return []
  }, [dns])

  const linkedinSummary = useMemo(() => {
    if (linkedinState?.connected) {
      return {
        tone: 'ok',
        label: 'Connected',
        detail: linkedinState?.linkupAccountId
          ? `Linkup: ${linkedinState.linkupAccountId}`
          : 'Token saved (encrypted)',
      }
    }
    return { tone: 'muted', label: 'Not connected', detail: 'OAuth connect required' }
  }, [linkedinState])

  const whatsappSummary = useMemo(() => {
    if (whatsappState?.connected) {
      return {
        tone: 'ok',
        label: 'Connected',
        detail: whatsappState?.displayPhone
          ? `Number: ${whatsappState.displayPhone}`
          : 'Cloud API linked',
      }
    }
    return { tone: 'muted', label: 'Not connected', detail: 'Phone number ID + token' }
  }, [whatsappState])

  const handleCreateWaTemplate = async (e) => {
    e.preventDefault()
    const name = tplName.trim()
    const body = tplBody.trim()
    if (!name || !body) {
      toast.error('Template name and body are required.')
      return
    }
    const analysis = analyzeWhatsAppBodyVariables(body)
    if ('error' in analysis) {
      toast.error(analysis.error)
      return
    }
    if (analysis.count > 0) {
      const samples = tplVarExamples.slice(0, analysis.count).map((s) => String(s ?? '').trim())
      if (samples.length !== analysis.count || samples.some((s) => !s)) {
        toast.error(`Add a non-empty sample for each placeholder {{1}} … {{${analysis.count}}} (required by Meta).`)
        return
      }
    }
    setWaTemplateCreateBusy(true)
    try {
      const payload = {
        name,
        language: tplLang.trim(),
        category: tplCategory,
        body,
      }
      if (analysis.count > 0) {
        payload.bodyExamples = tplVarExamples.slice(0, analysis.count).map((s) => String(s ?? '').trim())
      }
      const res = await fetch('/api/settings/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const desc = data.hint ? String(data.hint) : undefined
        toast.error(data.error || 'Meta rejected the template', desc ? { description: desc } : undefined)
        return
      }
      toast.success('Template submitted to Meta for review.')
      setTplName('')
      setTplBody('')
      setTplVarExamples([])
      await loadWaTemplates()
    } catch (err) {
      console.error(err)
      toast.error('Could not create template')
    } finally {
      setWaTemplateCreateBusy(false)
    }
  }

  if (user === undefined || user === null) {
    return <Loader fullScreen />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Connect outbound channels for campaigns. Email uses your domain with DNS records for
            deliverability. WhatsApp uses the official{' '}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
            >
              WhatsApp Cloud API
            </a>{' '}
            (WhatsApp Business Platform).
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-5 py-8 sm:px-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
          <p className="mt-1 text-sm text-slate-600">
            LinkedIn, WhatsApp, and email in one place. Expand a row for setup; collapsed rows show
            connection status.
          </p>
        </div>

        <div className="space-y-4">
          <IntegrationAccordion
            iconSlot={
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF6FF] text-[#0A66C2]">
                <FaLinkedin size={22} aria-hidden />
              </div>
            }
            title="LinkedIn"
            description="OAuth connect; access token stored encrypted for your workspace."
            expanded={openIntegration.linkedin}
            onToggle={() => toggleIntegration('linkedin')}
            statusLabel={linkedinSummary.label}
            statusTone={linkedinSummary.tone}
            statusDetail={linkedinSummary.detail}
            busy={linkedinLoading}
          >
            <p className="mt-4 text-sm text-slate-600">
              Single-click connect sends you to LinkedIn, then we store your token encrypted.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {!linkedinState?.connected ? (
                <a
                  href="/api/settings/linkedin/connect"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A66C2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0958A6]"
                >
                  <FiLink size={16} aria-hidden />
                  {linkedinLoading ? 'Checking…' : 'Connect LinkedIn'}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkedinDisconnect}
                  disabled={linkedinLoading}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Disconnect LinkedIn
                </button>
              )}
              <button
                type="button"
                onClick={loadLinkedin}
                disabled={linkedinLoading}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh status
              </button>
            </div>
          </IntegrationAccordion>

          <IntegrationAccordion
            iconSlot={
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <SiWhatsapp size={22} aria-hidden />
              </div>
            }
            title="WhatsApp"
            description="WhatsApp Business Platform (Cloud API). Phone number ID and system-user token."
            expanded={openIntegration.whatsapp}
            onToggle={() => toggleIntegration('whatsapp')}
            statusLabel={whatsappSummary.label}
            statusTone={whatsappSummary.tone}
            statusDetail={whatsappSummary.detail}
            busy={whatsappLoading}
          >
            <p className="mt-4 text-sm text-slate-600">
              Use a number on the <strong>WhatsApp Business Platform</strong>, not a personal account. See{' '}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
              >
                Cloud API overview
              </a>
              .
            </p>
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Credentials (Meta for Developers)</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed">
                <li>
                  <a
                    href="https://developers.facebook.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                  >
                    developers.facebook.com
                  </a>{' '}
                  → your app with the <strong>WhatsApp</strong> product.
                </li>
                <li>
                  <strong>WhatsApp</strong> → <strong>API Setup</strong> for Phone number ID and token.{' '}
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                  >
                    Get started
                  </a>
                  .
                </li>
                <li>
                  Templates need{' '}
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/access-tokens/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                  >
                    whatsapp_business_management
                  </a>{' '}
                  on the token.
                </li>
              </ol>
            </div>

            {whatsappLoading ? (
              <div className="mt-6 flex justify-center py-6">
                <Loader fullScreen={false} />
              </div>
            ) : null}

            {!whatsappLoading && whatsappState?.connected ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Three different Meta IDs</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
                    <li>
                      <strong>Phone number ID</strong> — path for <span className="font-mono">…/messages</span>{' '}
                      (sending). From <strong>WhatsApp → API Setup</strong>.
                    </li>
                    <li>
                      <strong>WhatsApp Business Account ID (WABA)</strong> — path for{' '}
                      <span className="font-mono">…/message_templates</span>. From Business settings → WhatsApp
                      accounts (not the App ID).
                    </li>
                    <li>
                      <strong>Facebook App ID</strong> — identifies your app; <em>not</em> used as the Graph path
                      segment for these calls.
                    </li>
                  </ul>
                  {whatsappState.idsDocUrl ? (
                    <p className="mt-2 text-xs">
                      <a
                        href={whatsappState.idsDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                      >
                        Meta: Phone number ID vs WhatsApp Business Account ID
                      </a>
                    </p>
                  ) : null}
                </div>

                {whatsappState.wabaLooksSameAsPhoneNumberId ? (
                  <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
                    <p className="font-semibold">Stored WABA matches Phone number ID</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      That usually means the wrong ID was saved for templates. Enter the real{' '}
                      <strong>WhatsApp Business Account ID</strong> below (from Business Manager), then save.
                    </p>
                    <form onSubmit={handleWhatsappWabaPatch} className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <label htmlFor="wa-waba-patch" className="text-xs font-medium text-red-950">
                          Correct WhatsApp Business Account ID
                        </label>
                        <input
                          id="wa-waba-patch"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Digits only"
                          value={waWabaPatch}
                          onChange={(e) => setWaWabaPatch(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-red-200/80 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={whatsappSaving}
                        className="rounded-xl bg-red-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-900 disabled:opacity-60"
                      >
                        {whatsappSaving ? 'Saving…' : 'Fix WABA'}
                      </button>
                    </form>
                  </div>
                ) : null}

                <dl className="grid gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Business display number
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">{whatsappState.displayPhone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Phone number ID <span className="font-normal normal-case text-slate-400">(sending)</span>
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-slate-800">{whatsappState.phoneNumberId || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      WhatsApp Business Account ID{' '}
                      <span className="font-normal normal-case text-slate-400">(templates)</span>
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-slate-800">
                      {whatsappState.whatsappBusinessAccountId || '—'}
                    </dd>
                  </div>
                  {whatsappState.verifiedName ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Verified name (from Meta)
                      </dt>
                      <dd className="mt-1 text-slate-900">{whatsappState.verifiedName}</dd>
                    </div>
                  ) : null}
                </dl>
                {!whatsappState.whatsappBusinessAccountId && !whatsappState.wabaLooksSameAsPhoneNumberId ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                    <p className="font-semibold">WhatsApp Business Account ID missing</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Template APIs need the WABA (not the Phone number ID). Paste it from Business settings →
                      WhatsApp accounts, then save.
                    </p>
                    <form onSubmit={handleWhatsappWabaPatch} className="mt-3 flex flex-wrap items-end gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="WhatsApp Business Account ID"
                        value={waWabaPatch}
                        onChange={(e) => setWaWabaPatch(e.target.value)}
                        className="min-w-[12rem] flex-1 rounded-lg border border-amber-200/80 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                      <button
                        type="submit"
                        disabled={whatsappSaving || !waWabaPatch.trim()}
                        className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950 disabled:opacity-50"
                      >
                        {whatsappSaving ? 'Saving…' : 'Save WABA'}
                      </button>
                    </form>
                  </div>
                ) : null}
                <p className="text-xs text-slate-500">
                  Token is encrypted. Rotate by disconnecting and connecting again with a new token.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleWhatsappDisconnect}
                    disabled={whatsappSaving}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Disconnect WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={loadWhatsapp}
                    disabled={whatsappLoading}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Refresh status
                  </button>
                </div>
              </div>
            ) : null}

            {!whatsappLoading && !whatsappState?.connected ? (
              <form onSubmit={handleWhatsappSave} className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Use the right ID in each field</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
                    <li>
                      <strong>Phone number ID</strong> is only for sending (
                      <span className="font-mono">POST /{'{phone-number-id}'}/messages</span>).
                    </li>
                    <li>
                      <strong>WhatsApp Business Account ID</strong> is for templates (
                      <span className="font-mono">…/message_templates</span>) — only needed if Meta does not
                      return it for your number.
                    </li>
                    <li>
                      <strong>App ID</strong> from the app dashboard is not pasted here.
                    </li>
                  </ul>
                  <p className="mt-2">
                    <a
                      href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#phone-number-id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                    >
                      Meta: Phone number ID vs WhatsApp Business Account ID
                    </a>
                  </p>
                </div>
                <div>
                  <label htmlFor="wa-display-phone" className="text-sm font-medium text-slate-800">
                    WhatsApp Business number <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    E.164 (e.g. <span className="font-mono">15551234567</span>). We confirm it matches Meta
                    for your Phone number ID.
                  </p>
                  <input
                    id="wa-display-phone"
                    type="tel"
                    autoComplete="off"
                    placeholder="+1 555 123 4567"
                    value={waDisplayPhone}
                    onChange={(e) => setWaDisplayPhone(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-800/15 placeholder:text-slate-400 focus:border-sky-800 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="wa-phone-number-id" className="text-sm font-medium text-slate-800">
                    Phone number ID <span className="text-red-600">*</span>{' '}
                    <span className="font-normal text-slate-500">(sending — not WABA, not App ID)</span>
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    From <strong>WhatsApp → API Setup</strong>. Used in{' '}
                    <span className="font-mono">…/messages</span>, not in <span className="font-mono">message_templates</span>.
                  </p>
                  <input
                    id="wa-phone-number-id"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 123456789012345"
                    value={waPhoneNumberId}
                    onChange={(e) => setWaPhoneNumberId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none ring-sky-800/15 placeholder:text-slate-400 focus:border-sky-800 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="wa-business-account-id" className="text-sm font-medium text-slate-800">
                    WhatsApp Business Account ID{' '}
                    <span className="font-normal text-slate-500">(optional — templates only)</span>
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Often <strong>required</strong>: Meta&apos;s <span className="font-mono">GET /{'{phone-number-id}'}</span>{' '}
                    usually does <em>not</em> include a WABA field, so we cannot auto-fill it. Use Business settings →
                    WhatsApp accounts. Digits only; must not match Phone number ID.
                  </p>
                  <input
                    id="wa-business-account-id"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="WABA (optional)"
                    value={waBusinessAccountId}
                    onChange={(e) => setWaBusinessAccountId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none ring-sky-800/15 placeholder:text-slate-400 focus:border-sky-800 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="wa-access-token" className="text-sm font-medium text-slate-800">
                    Access token <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wa-access-token"
                    type="password"
                    autoComplete="off"
                    placeholder="EAAG…"
                    value={waAccessToken}
                    onChange={(e) => setWaAccessToken(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none ring-sky-800/15 placeholder:text-slate-400 focus:border-sky-800 focus:ring-2"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={whatsappSaving}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {whatsappSaving ? 'Verifying…' : 'Connect WhatsApp'}
                  </button>
                  <button
                    type="button"
                    onClick={loadWhatsapp}
                    disabled={whatsappLoading}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Refresh status
                  </button>
                </div>
              </form>
            ) : null}
          </IntegrationAccordion>

          <IntegrationAccordion
            iconSlot={
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
                <FiMail size={22} aria-hidden />
              </div>
            }
            title="Email"
            description="Authenticate your domain so outbound mail passes SPF, DKIM, and DMARC checks."
            expanded={openIntegration.email}
            onToggle={() => toggleIntegration('email')}
            statusLabel={summary.label}
            statusTone={summary.tone}
            statusDetail={summary.detail}
            busy={loading}
          >
          {emailState?.dnsStatusError ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Could not load DNS status. Use <strong>Refresh status</strong> or try again in a few
              minutes.
            </p>
          ) : null}

          {!loading && !emailState?.configured ? (
            <form onSubmit={handleSaveDomain} className="mt-6 space-y-4">
              <div>
                <label htmlFor="sender-domain" className="text-sm font-medium text-slate-800">
                  Domain to send from
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Use the domain in your from-address (e.g.{' '}
                  <span className="font-mono">you@company.com</span> → enter{' '}
                  <span className="font-mono">company.com</span>).
                </p>
                <input
                  id="sender-domain"
                  type="text"
                  autoComplete="off"
                  placeholder="yourcompany.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-800/15 placeholder:text-slate-400 focus:border-sky-800 focus:ring-2"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-900 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save domain'}
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="mt-8 flex justify-center py-8">
              <Loader fullScreen={false} />
            </div>
          ) : null}

          {!loading && emailState?.configured ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">DNS instructions</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                  <li>Open your DNS provider (Cloudflare, Route 53, GoDaddy, Namecheap, etc.).</li>
                  <li>
                    For each row below, create a record with the same <strong>Type</strong>,{' '}
                    <strong>Host</strong> (or name), and <strong>Value</strong>. DKIM may be{' '}
                    <strong>TXT</strong> (often starting with <span className="font-mono">v=DKIM1</span>
                    ) or a <strong>CNAME</strong> pointing at a host your provider gives you.
                  </li>
                  <li>Use TTL 300–3600 seconds unless your host recommends otherwise.</li>
                  <li>Wait for DNS to propagate (often minutes; sometimes up to 24–48 hours).</li>
                  <li>
                    Click <strong>Verify DNS now</strong> to re-check the records.
                  </li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || saving}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-900 disabled:opacity-60"
                >
                  {verifying ? 'Checking…' : 'Verify DNS now'}
                </button>
                <button
                  type="button"
                  onClick={loadEmail}
                  disabled={loading || verifying}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Refresh status
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={saving || verifying}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove domain
                </button>
              </div>

              {dns ? (
                <div className="grid gap-4 md:grid-cols-1">
                  <DnsRecordCard label="Domain verification" record={dns.brevo_code} />
                  {dkimEntries.length > 0 ? (
                    dkimEntries.map((rec, i) => (
                      <DnsRecordCard
                        key={`dkim-${i}-${rec.host_name || ''}-${String(rec.value || '').slice(0, 12)}`}
                        label={dkimEntries.length > 1 ? `DKIM record ${i + 1}` : 'DKIM'}
                        record={rec}
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
                      <p className="text-sm font-semibold text-amber-950">DKIM</p>
                      <p className="mt-2 text-sm leading-relaxed text-amber-900">
                        DKIM records are not listed yet. They usually appear after you save the domain
                        or after a refresh. Typical shape:
                      </p>
                      <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg border border-amber-200/80 bg-white/90 p-3 font-mono text-[11px] leading-relaxed text-amber-950 sm:text-xs">
                        {`Type: TXT or CNAME\nHost: selector._domainkey\nValue: (long TXT or CNAME target)`}
                      </pre>
                      <p className="mt-2 text-sm leading-relaxed text-amber-900">
                        Use the exact <strong>Host</strong> and <strong>Value</strong> from the rows
                        above when they appear (often a name ending in{' '}
                        <span className="font-mono">._domainkey</span>). Click{' '}
                        <strong>Refresh status</strong>. If nothing shows, remove the domain here and
                        save it again to reload the checklist.
                      </p>
                    </div>
                  )}
                  <DnsRecordCard label="DMARC" record={dns.dmarc_record} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  DNS records could not be loaded. Try <strong>Refresh status</strong> or save your
                  domain again.
                </p>
              )}

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <p>
                  <strong className="text-slate-800">Tip:</strong> Some registrars expect the host as{' '}
                  <span className="font-mono">@</span> for the root domain; others want the bare domain
                  name or a trailing dot. Match what your provider&apos;s UI expects — the effective DNS
                  name must resolve to the value above.
                </p>
              </div>
            </div>
          ) : null}
          </IntegrationAccordion>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">WhatsApp message templates</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Fetched and created via Meta Graph API on your WhatsApp Business Account —{' '}
                <a
                  href="https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                >
                  message_templates
                </a>
                . Source of truth stays in Meta; we only proxy with your stored token (no template mirror
                in MongoDB).
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Creation here is <strong>text-only</strong> (BODY). Image headers and variables can be
                layered on later.
              </p>
            </div>
            {whatsappState?.connected ? (
              <button
                type="button"
                onClick={() => loadWaTemplates()}
                disabled={waTemplatesLoading}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {waTemplatesLoading ? 'Loading…' : 'Refresh list'}
              </button>
            ) : null}
          </div>

          {!whatsappState?.connected ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
              Connect <strong>WhatsApp</strong> in Integrations to list templates from Meta and submit new
              ones for review.
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Approved and pending templates</h3>
                {waTemplatesLoading && waTemplates.length === 0 ? (
                  <div className="mt-4 flex justify-center py-10">
                    <Loader fullScreen={false} />
                  </div>
                ) : null}
                {!waTemplatesLoading && waTemplates.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No templates returned yet, or none exist on this WABA.</p>
                ) : null}
                {waTemplates.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Language</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Body preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                        {waTemplates.map((row) => {
                          const st = row.status != null ? String(row.status).toUpperCase().replace(/\s+/g, '_') : ''
                          return (
                          <tr key={`${row.id || row.name}-${row.language}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.name}</td>
                            <td className="whitespace-nowrap px-4 py-3">{row.language}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs">{row.category || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                                  st === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
                                    : st === 'REJECTED'
                                      ? 'bg-red-50 text-red-800 ring-red-100'
                                      : 'bg-amber-50 text-amber-900 ring-amber-100'
                                }`}
                              >
                                {row.status || '—'}
                              </span>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                              {templateBodyPreview(row.components)}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {waTemplatesPaging?.cursors?.after ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => loadWaTemplates({ appendAfter: waTemplatesPaging.cursors.after })}
                      disabled={waTemplatesLoading}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {waTemplatesLoading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-slate-900">Create text template</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Submits a BODY-only template to Meta for review. Name must use lowercase letters, numbers, and
                  underscores. Use <span className="font-mono">{'{{1}}'}</span>,{' '}
                  <span className="font-mono">{'{{2}}'}</span>, … for variables (consecutive from 1); Meta requires
                  sample values for each.
                </p>
                <form onSubmit={handleCreateWaTemplate} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <label htmlFor="tpl-name" className="text-sm font-medium text-slate-800">
                      Template name
                    </label>
                    <input
                      id="tpl-name"
                      type="text"
                      autoComplete="off"
                      placeholder="order_shipped_notice"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-sky-800 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="tpl-lang" className="text-sm font-medium text-slate-800">
                      Language
                    </label>
                    <select
                      id="tpl-lang"
                      value={tplLang}
                      onChange={(e) => setTplLang(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-800 focus:ring-2"
                    >
                      <option value="en_US">en_US</option>
                      <option value="en_GB">en_GB</option>
                      <option value="en">en</option>
                      <option value="es">es</option>
                      <option value="es_ES">es_ES</option>
                      <option value="fr">fr</option>
                      <option value="de">de</option>
                      <option value="hi">hi</option>
                      <option value="id">id</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="tpl-cat" className="text-sm font-medium text-slate-800">
                      Category
                    </label>
                    <select
                      id="tpl-cat"
                      value={tplCategory}
                      onChange={(e) => setTplCategory(e.target.value)}
                      className="mt-2 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-800 focus:ring-2"
                    >
                      <option value="UTILITY">UTILITY</option>
                      <option value="MARKETING">MARKETING</option>
                      <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      AUTHENTICATION has strict content rules; prefer UTILITY or MARKETING for general text.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="tpl-body" className="text-sm font-medium text-slate-800">
                      Body text
                    </label>
                    <textarea
                      id="tpl-body"
                      rows={4}
                      maxLength={1024}
                      value={tplBody}
                      onChange={(e) => setTplBody(e.target.value)}
                      placeholder={'Plain text, or e.g. Hi {{1}}, your order {{2}} is on the way.'}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-800 focus:ring-2"
                    />
                    <p className="mt-1 text-right text-xs text-slate-500">{tplBody.length}/1024</p>
                    {'error' in tplBodyAnalysis ? (
                      <p className="mt-2 text-xs text-red-700">{tplBodyAnalysis.error}</p>
                    ) : null}
                    {'count' in tplBodyAnalysis && tplBodyAnalysis.count > 0 ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">Sample values for variables</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Meta uses these only for review. Shown order matches{' '}
                          <span className="font-mono">{'{{1}}'}</span>, <span className="font-mono">{'{{2}}'}</span>, …
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {Array.from({ length: tplBodyAnalysis.count }, (_, i) => (
                            <div key={i}>
                              <label
                                htmlFor={`tpl-var-${i + 1}`}
                                className="text-xs font-medium text-slate-700"
                              >{`{{${i + 1}}} sample`}</label>
                              <input
                                id={`tpl-var-${i + 1}`}
                                type="text"
                                autoComplete="off"
                                placeholder={i === 0 ? 'e.g. Alex' : i === 1 ? 'e.g. #48291' : 'Sample text'}
                                value={tplVarExamples[i] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setTplVarExamples((prev) => {
                                    const next = [...prev]
                                    next[i] = v
                                    return next
                                  })
                                }}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-800 focus:ring-2"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={
                        waTemplateCreateBusy ||
                        (Boolean(tplBody.trim()) && 'error' in tplBodyAnalysis)
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {waTemplateCreateBusy ? 'Submitting…' : 'Submit to Meta for review'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
        <p className="text-center text-sm text-slate-500">
          <Link href="/campaigns" className="font-semibold text-sky-800 hover:underline">
            Back to campaigns
          </Link>
        </p>
      </div>
    </div>
  )
}

export default DashboardLayout()(SettingsPage)
