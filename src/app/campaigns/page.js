'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import { MultiOptionDropdown } from '@/components/campaigns/MultiOptionDropdown'
import Loader from '@/components/shared/Loader'
import { useUser } from '@/context/UserContext'
import { INDUSTRY_OPTIONS } from '@/constants/campaignIndustryOptions'
import {
  FUNDING_OPTIONS,
  FUNCTIONAL_LEVEL_OPTIONS,
  REVENUE_OPTIONS,
  SENIORITY_OPTIONS,
  SIZE_OPTIONS,
} from '@/constants/campaignSourcingOptions'
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Stack,
  Text,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiMail, FiPlus } from 'react-icons/fi'
import { FaLinkedin } from 'react-icons/fa'
import { SiWhatsapp } from 'react-icons/si'
import { MdOutlineCampaign } from 'react-icons/md'
import { toast } from 'sonner'

const initialForm = {
  name: '',
  goal: '',
  signals: '',
  description: '',
  contact_location: '',
  contact_state: '',
  contact_not_city: '',
  contact_not_location: '',
  company_domain: '',
  company_industry: [],
  company_keywords: '',
  company_not_keywords: '',
  contact_job_title: '',
  fetch_count: '10',
  functional_level: [],
  funding: [],
  max_revenue: '',
  min_revenue: '',
  seniority_level: [],
  size: [],
  maps_location_query: '',
  maps_search_strings: '',
  maps_max_crawled_places_per_search: '',
}

function sourcingPayloadFromForm(form) {
  return {
    contact_location: form.contact_location,
    contact_state: form.contact_state,
    contact_not_city: form.contact_not_city,
    contact_not_location: form.contact_not_location,
    company_domain: form.company_domain,
    company_industry: form.company_industry,
    company_keywords: form.company_keywords,
    company_not_keywords: form.company_not_keywords,
    contact_job_title: form.contact_job_title,
    fetch_count: form.fetch_count,
    functional_level: form.functional_level,
    funding: form.funding,
    max_revenue: form.max_revenue,
    min_revenue: form.min_revenue,
    seniority_level: form.seniority_level,
    size: form.size,
    maps_location_query: form.maps_location_query,
    maps_search_strings: form.maps_search_strings,
    maps_max_crawled_places_per_search: form.maps_max_crawled_places_per_search,
  }
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

const STATUS_LABEL = {
  draft: 'Draft',
  paused: 'Paused',
  running: 'Running',
  completed: 'Completed',
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

function formatStatusLabel(status) {
  const key = String(status || 'draft').toLowerCase()
  return STATUS_LABEL[key] || STATUS_LABEL.draft
}

function formatResultsSummary(r) {
  const { sends, replies, meetingsBooked } = normalizeResults(r)
  return `${sends} sent · ${replies} replies · ${meetingsBooked} meetings`
}

function OutreachChannelPill({ icon, label, hint, variant }) {
  const styles =
    variant === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 ring-emerald-100'
      : variant === 'pending'
        ? 'border-amber-200 bg-amber-50 text-amber-950 ring-amber-100'
        : variant === 'soon'
          ? 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-100'
          : 'border-slate-200 bg-white text-slate-700 ring-slate-100'
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ring-1 ${styles}`}
      title={hint}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="font-semibold">{label}</span>
      <span className="truncate text-[11px] font-normal opacity-90">{hint}</span>
    </span>
  )
}

const AGENT_ROTATING_HINTS = [
  'Quietly gathering context…',
  'Cross-checking a few credible sources…',
  'Letting patterns settle into a clear picture…',
  'Almost ready to surface what matters most…',
]

const CampaignsPage = () => {
  const router = useRouter()
  const user = useUser()
  const hasCampaignAccess = user?.payment === true
  const createModal = useDisclosure()
  const [campaigns, setCampaigns] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [workspaceAgentSession, setWorkspaceAgentSession] = useState(null)
  const [agentStepLine, setAgentStepLine] = useState('')
  const [hintIndex, setHintIndex] = useState(0)
  const [outreachEmail, setOutreachEmail] = useState(null)
  const [outreachLinkedin, setOutreachLinkedin] = useState(null)
  const [outreachWhatsapp, setOutreachWhatsapp] = useState(null)

  const [accountBookMode, setAccountBookMode] = useState('scrape')
  const [importFile, setImportFile] = useState(null)
  const importFileInputRef = useRef(null)

  const resetCreateModalFields = useCallback(() => {
    setForm(initialForm)
    setImportFile(null)
    if (importFileInputRef.current) importFileInputRef.current.value = ''
  }, [])

  const closeCreateModalAndReset = useCallback(() => {
    resetCreateModalFields()
    setAccountBookMode('scrape')
    createModal.onClose()
  }, [createModal, resetCreateModalFields])

  useEffect(() => {
    if (!hasCampaignAccess || user === undefined || user === null) return undefined
    let cancelled = false
    async function loadOutreach() {
      try {
        const [emailRes, linkedinRes, whatsappRes] = await Promise.all([
          fetch('/api/settings/email-domain'),
          fetch('/api/settings/linkedin'),
          fetch('/api/settings/whatsapp'),
        ])
        const emailData = emailRes.ok ? await emailRes.json() : null
        const linkedinData = linkedinRes.ok ? await linkedinRes.json() : null
        const whatsappData = whatsappRes.ok ? await whatsappRes.json() : null
        if (!cancelled) {
          setOutreachEmail(emailData)
          setOutreachLinkedin(linkedinData)
          setOutreachWhatsapp(whatsappData)
        }
      } catch {
        if (!cancelled) {
          setOutreachEmail(null)
          setOutreachLinkedin(null)
          setOutreachWhatsapp(null)
        }
      }
    }
    loadOutreach()
    return () => {
      cancelled = true
    }
  }, [hasCampaignAccess, user])

  useEffect(() => {
    if (!workspaceAgentSession?.campaignId) return undefined
    if (workspaceAgentSession.phase === 'import') return undefined
    const id = workspaceAgentSession.campaignId

    async function pollStep() {
      try {
        const res = await fetch(`/api/campaigns/${id}`)
        if (!res.ok) return
        const c = await res.json()
        if (typeof c.accountBookStepLabel === 'string' && c.accountBookStepLabel.trim()) {
          setAgentStepLine(c.accountBookStepLabel.trim())
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    pollStep()
    const i = window.setInterval(pollStep, 1600)
    return () => window.clearInterval(i)
  }, [workspaceAgentSession?.campaignId, workspaceAgentSession?.phase])

  useEffect(() => {
    if (!workspaceAgentSession) return undefined
    const tid = window.setInterval(() => {
      setHintIndex((h) => (h + 1) % AGENT_ROTATING_HINTS.length)
    }, 5500)
    return () => window.clearInterval(tid)
  }, [workspaceAgentSession])

  const rotatingHint = useMemo(
    () => AGENT_ROTATING_HINTS[hintIndex],
    [hintIndex]
  )

  const loadCampaigns = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (!res.ok) {
        if (res.status === 401) {
          setCampaigns([])
          return
        }
        throw new Error('Failed to load campaigns')
      }
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      toast.error('Could not load campaigns')
      setCampaigns([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user === undefined) return
    if (!user) return
    if (!hasCampaignAccess) {
      setListLoading(false)
      setCampaigns([])
      return
    }
    loadCampaigns()
  }, [user, hasCampaignAccess, loadCampaigns])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!hasCampaignAccess) {
      toast.error('You do not have access to this premium feature')
      return
    }
    const name = form.name.trim()
    if (!name) {
      toast.error('Campaign name is required')
      return
    }
    if (accountBookMode === 'import' && !importFile) {
      toast.error('Choose a CSV or Excel file to import your account book')
      return
    }
    setSubmitting(true)
    setAgentStepLine('')
    const mode = accountBookMode
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          goal: form.goal.trim(),
          signals: form.signals,
          description: form.description.trim(),
          accountBookOrigin: mode === 'import' ? 'import' : 'scrape',
          sourcingProfile:
            mode === 'import' ? {} : sourcingPayloadFromForm(form),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not create campaign')
        return
      }
      const cid = String(data._id)
      createModal.onClose()
      setWorkspaceAgentSession({
        campaignId: cid,
        phase: mode === 'import' ? 'import' : 'scrape',
      })
      setCampaigns((prev) => [{ ...data, _id: cid }, ...prev])

      if (mode === 'import') {
        const fd = new FormData()
        fd.append('file', importFile)
        const runRes = await fetch(`/api/campaigns/${cid}/account-book/import`, {
          method: 'POST',
          body: fd,
        })
        const runBody = await runRes.json().catch(() => ({}))

        resetCreateModalFields()
        await loadCampaigns()

        if (!runRes.ok) {
          toast.error(runBody.error || 'Could not import your account book')
          return
        }
        toast.success('Campaign ready', {
          description: `Imported ${runBody.prospectCount ?? 0} prospect(s). Opening your workspace.`,
        })
        router.push(`/campaigns/${cid}`)
        return
      }

      const runRes = await fetch(`/api/campaigns/${cid}/account-book/run`, {
        method: 'POST',
      })
      const runBody = await runRes.json().catch(() => ({}))

      resetCreateModalFields()
      await loadCampaigns()

      if (!runRes.ok) {
        toast.error(runBody.error || 'Workspace agent could not finish the book')
        return
      }
      toast.success('Campaign ready', {
        description: 'Opening your refreshed workspace.',
      })
      router.push(`/campaigns/${cid}`)
    } catch (err) {
      console.error(err)
      toast.error('Could not create campaign')
    } finally {
      setSubmitting(false)
      setWorkspaceAgentSession(null)
    }
  }

  if (user === undefined || user === null) {
    return <Loader fullScreen />
  }

  if (!hasCampaignAccess) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">
            You do not have access to this premium feature.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Campaigns are available only for users with an active premium plan.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              Outreach
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Create and open campaigns tied to your workspace. Only you can see
              campaigns you create.
            </p>
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Campaign outreach
                </span>
                <OutreachChannelPill
                  icon={<FiMail size={14} aria-hidden />}
                  label="Email"
                  hint={
                    outreachEmail?.configured
                      ? outreachEmail.authenticated
                        ? outreachEmail.domain
                          ? `Sending domain · ${outreachEmail.domain}`
                          : 'Connected'
                        : outreachEmail.domain
                          ? `DNS pending · ${outreachEmail.domain}`
                          : 'DNS pending'
                      : 'Not connected'
                  }
                  variant={
                    outreachEmail?.configured
                      ? outreachEmail.authenticated
                        ? 'ok'
                        : 'pending'
                      : 'muted'
                  }
                />
                <OutreachChannelPill
                  icon={<FaLinkedin size={14} aria-hidden />}
                  label="LinkedIn"
                  hint={
                    outreachLinkedin?.connected
                      ? outreachLinkedin.linkupAccountId
                        ? `Connected · ${outreachLinkedin.linkupAccountId}`
                        : 'Connected'
                      : 'Not connected'
                  }
                  variant={outreachLinkedin?.connected ? 'ok' : 'muted'}
                />
                <OutreachChannelPill
                  icon={<SiWhatsapp size={14} aria-hidden />}
                  label="WhatsApp"
                  hint={
                    outreachWhatsapp?.connected
                      ? outreachWhatsapp.displayPhone
                        ? `Cloud API · ${outreachWhatsapp.displayPhone}`
                        : 'Cloud API · connected'
                      : 'Not connected'
                  }
                  variant={outreachWhatsapp?.connected ? 'ok' : 'muted'}
                />
              </div>
              <Link
                href="/settings"
                className="text-sm font-semibold text-sky-800 underline-offset-2 hover:underline"
              >
                Manage connections
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={createModal.onOpen}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-900 sm:w-auto"
          >
            <FiPlus size={18} aria-hidden />
            New campaign
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {listLoading ? (
          <div className="flex justify-center py-20">
            <Loader fullScreen={false} />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <MdOutlineCampaign
              className="mx-auto text-slate-300"
              size={48}
              aria-hidden
            />
            <p className="mt-4 text-lg font-semibold text-slate-800">
              No campaigns yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Start by creating a campaign with a name, goal, signals, and a
              short description.
            </p>
            <button
              type="button"
              onClick={createModal.onOpen}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-900"
            >
              <FiPlus size={18} aria-hidden />
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full border-collapse text-left text-sm text-slate-800">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      Campaign
                    </th>
                    <th
                      scope="col"
                      className="hidden min-w-[12rem] px-4 py-3 md:table-cell"
                    >
                      Goal
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="min-w-[11rem] px-4 py-3">
                      Results
                    </th>
                    <th
                      scope="col"
                      className="hidden whitespace-nowrap px-4 py-3 lg:table-cell"
                    >
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => {
                    const goalText = c.goal?.trim() || '—'
                    return (
                      <tr
                        key={c._id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="align-top px-4 py-3">
                          <Link
                            href={`/campaigns/${c._id}`}
                            className="font-semibold text-sky-900 underline-offset-2 hover:underline"
                          >
                            {c.name}
                          </Link>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 md:hidden">
                            {goalText}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 lg:hidden">
                            {formatDate(c.updatedAt)}
                          </p>
                        </td>
                        <td className="hidden align-top px-4 py-3 text-slate-600 md:table-cell">
                          <span className="line-clamp-2" title={c.goal || ''}>
                            {goalText}
                          </span>
                        </td>
                        <td className="align-middle whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(c.status)}`}
                          >
                            {formatStatusLabel(c.status)}
                          </span>
                        </td>
                        <td className="align-top px-4 py-3 text-slate-700">
                          <span className="tabular-nums">
                            {formatResultsSummary(c.results)}
                          </span>
                        </td>
                        <td className="hidden align-middle whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">
                          {formatDate(c.updatedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={createModal.isOpen}
        onClose={closeCreateModalAndReset}
        size="2xl"
        isCentered
      >
        <ModalOverlay backdropFilter="blur(6px)" />
        <ModalContent
          mx={3}
          borderRadius="xl"
          maxH="90vh"
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          <ModalHeader flexShrink={0} fontSize="2xl" fontWeight="semibold">
            New campaign
          </ModalHeader>
          <ModalCloseButton />
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ModalBody flex="1" minH={0} overflowY="auto" fontSize="md">
              <FormControl mb={4} isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  size="md"
                  placeholder="e.g. Q2 — HRIS expansion"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Goal</FormLabel>
                <Input
                  size="md"
                  placeholder="e.g. Book demos with VP HR at 50–500 FTE shops"
                  value={form.goal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, goal: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Signals</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated, e.g. hiring spike, new ATS"
                  rows={3}
                  value={form.signals}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, signals: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Description</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Short context for this campaign"
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </FormControl>

              <div className="mt-2 border-t border-slate-200 pt-4">
                <FormLabel className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Account book
                </FormLabel>
                <RadioGroup
                  value={accountBookMode}
                  onChange={setAccountBookMode}
                  mt={3}
                >
                  <Stack spacing={3}>
                    <Radio value="scrape" colorScheme="blue">
                      Build from signals (sourcing &amp; enrichment)
                    </Radio>
                    <Radio value="import" colorScheme="blue">
                      Import my own list (CSV, Excel .xlsx/.xls, or .ods)
                    </Radio>
                  </Stack>
                </RadioGroup>
                {accountBookMode === 'import' ? (
                  <Box
                    mt={4}
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="gray.200"
                    bg="gray.50"
                    px={4}
                    py={3}
                  >
                    <Text fontSize="sm" color="gray.700">
                      The first sheet needs <strong>prospect</strong> (company),{' '}
                      <strong>person</strong> (contact name), and at least one{' '}
                      <strong>email</strong> (person or company).{' '}
                      <strong>Phone</strong> can be in a person or company phone
                      column; either is fine. Extra columns (LinkedIn, website,
                      signals, dossier, etc.) are stored on each prospect.
                    </Text>
                    <FormControl mt={3}>
                      <Input
                        ref={importFileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        py={1}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          setImportFile(f || null)
                        }}
                      />
                      <FormHelperText>
                        Max ~2,500 data rows · first sheet only · up to ~8 MB
                      </FormHelperText>
                    </FormControl>
                  </Box>
                ) : null}
              </div>

              {accountBookMode === 'scrape' ? (
                <>
              <div className="border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Lead targeting
              </div>

              <FormControl mb={3} mt={3}>
                <FormLabel>Country</FormLabel>
                <Textarea
                  size="md"
                  placeholder="United States, India, …"
                  rows={2}
                  value={form.contact_location}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contact_location: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>State</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated"
                  rows={2}
                  value={form.contact_state}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contact_state: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Exclude cities</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated"
                  rows={2}
                  value={form.contact_not_city}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contact_not_city: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Exclude regions</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated"
                  rows={2}
                  value={form.contact_not_location}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contact_not_location: e.target.value,
                    }))
                  }
                />
              </FormControl>

              <div className="border-t border-slate-200 pt-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Company
              </div>

              <FormControl mb={3} mt={3}>
                <FormLabel>Company websites (domains)</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated, e.g. acme.com, example.io"
                  rows={2}
                  value={form.company_domain}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      company_domain: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Industries</FormLabel>
                <MultiOptionDropdown
                  popoverTitle="Industries"
                  helperText="Search to narrow the list."
                  options={INDUSTRY_OPTIONS}
                  value={form.company_industry}
                  onChange={(next) =>
                    setForm((f) => ({ ...f, company_industry: next }))
                  }
                  placeholder="Select industries…"
                  filterable
                  searchPlaceholder="Filter industries…"
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Keywords to include</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated"
                  rows={2}
                  value={form.company_keywords}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      company_keywords: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Keywords to exclude</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated"
                  rows={2}
                  value={form.company_not_keywords}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      company_not_keywords: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormControl mb={3}>
                  <FormLabel>Min revenue</FormLabel>
                  <Select
                    size="md"
                    placeholder="Optional"
                    value={form.min_revenue || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        min_revenue: e.target.value,
                      }))
                    }
                  >
                    <option value="">Optional</option>
                    {REVENUE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl mb={3}>
                  <FormLabel>Max revenue</FormLabel>
                  <Select
                    size="md"
                    placeholder="Optional"
                    value={form.max_revenue || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        max_revenue: e.target.value,
                      }))
                    }
                  >
                    <option value="">Optional</option>
                    {REVENUE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <FormControl mb={3}>
                <FormLabel>Company size</FormLabel>
                <MultiOptionDropdown
                  popoverTitle="Company size"
                  options={SIZE_OPTIONS}
                  value={form.size}
                  onChange={(vals) =>
                    setForm((f) => ({ ...f, size: [...vals] }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Funding stages</FormLabel>
                <MultiOptionDropdown
                  popoverTitle="Funding stages"
                  options={FUNDING_OPTIONS}
                  value={form.funding}
                  onChange={(vals) =>
                    setForm((f) => ({ ...f, funding: [...vals] }))
                  }
                />
              </FormControl>

              <div className="border-t border-slate-200 pt-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                People
              </div>

              <FormControl mb={3} mt={3}>
                <FormLabel>Job titles</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated, e.g. CEO, VP Sales"
                  rows={2}
                  value={form.contact_job_title}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contact_job_title: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Functional level</FormLabel>
                <MultiOptionDropdown
                  popoverTitle="Functional level"
                  options={FUNCTIONAL_LEVEL_OPTIONS}
                  value={form.functional_level}
                  onChange={(vals) =>
                    setForm((f) => ({ ...f, functional_level: [...vals] }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Seniority level</FormLabel>
                <MultiOptionDropdown
                  popoverTitle="Seniority level"
                  options={SENIORITY_OPTIONS}
                  value={form.seniority_level}
                  onChange={(vals) =>
                    setForm((f) => ({
                      ...f,
                      seniority_level: [...vals],
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Leads to fetch</FormLabel>
                <Input
                  size="md"
                  type="number"
                  min={1}
                  value={form.fetch_count}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      fetch_count: e.target.value,
                    }))
                  }
                />
              </FormControl>

              <div className="border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Optional — Google Maps
              </div>
              <p className="mb-4 mt-2 text-sm text-slate-600">
                Add local businesses after lead sourcing. Leave blank to skip.
              </p>

              <FormControl mb={3}>
                <FormLabel>Location</FormLabel>
                <Input
                  size="md"
                  placeholder="Bangalore, India"
                  value={form.maps_location_query}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maps_location_query: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Search terms</FormLabel>
                <Textarea
                  size="md"
                  placeholder="Comma-separated, e.g. Coaching institute, Coworking"
                  rows={2}
                  value={form.maps_search_strings}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maps_search_strings: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Places to fetch</FormLabel>
                <Input
                  size="md"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.maps_max_crawled_places_per_search}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maps_max_crawled_places_per_search: e.target.value,
                    }))
                  }
                />
              </FormControl>
                </>
              ) : null}
            </ModalBody>
            <ModalFooter
              flexShrink={0}
              gap={3}
              borderTopWidth="1px"
              borderColor="gray.100"
              fontSize="md"
            >
              <Button size="md" variant="ghost" onClick={closeCreateModalAndReset}>
                Cancel
              </Button>
              <Button
                size="md"
                type="submit"
                colorScheme="blue"
                isLoading={submitting}
                loadingText={
                  accountBookMode === 'import' ? 'Working…' : 'Creating'
                }
              >
                {accountBookMode === 'import'
                  ? 'Create campaign & import'
                  : 'Create campaign'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {(workspaceAgentSession || submitting) && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 px-6 backdrop-blur-sm"
          role="presentation"
          aria-live="polite"
        >
          <div className="max-w-md rounded-3xl border border-white/25 bg-white/95 px-10 py-9 text-center shadow-2xl">
            <Spinner
              thickness="3px"
              speed="0.75s"
              emptyColor="gray.200"
              color="sky.700"
              size="lg"
              className="mx-auto mb-6"
              aria-hidden
            />
            {workspaceAgentSession?.phase === 'import' ||
            (submitting && accountBookMode === 'import') ? (
              <>
                <p className="text-base font-semibold text-slate-900">
                  Importing your account book
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  We are reading your spreadsheet and saving each prospect to your
                  campaign. Large files may take up to a minute.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">
                  A workspace specialist is assembling your overview
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {agentStepLine?.trim?.() || rotatingHint}
                </p>
                <p className="mt-6 text-xs text-slate-400">
                  This can take several minutes—the page will open automatically.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardLayout()(CampaignsPage)
