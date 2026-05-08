'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import Loader from '@/components/shared/Loader'
import { useUser } from '@/context/UserContext'
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import { MdOutlineCampaign } from 'react-icons/md'
import { toast } from 'sonner'

const initialForm = {
  name: '',
  goal: '',
  signals: '',
  description: '',
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

const CampaignsPage = () => {
  const user = useUser()
  const createModal = useDisclosure()
  const [campaigns, setCampaigns] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)

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
    loadCampaigns()
  }, [user, loadCampaigns])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      toast.error('Campaign name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          goal: form.goal.trim(),
          signals: form.signals,
          description: form.description.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not create campaign')
        return
      }
      toast.success('Campaign created')
      setForm(initialForm)
      createModal.onClose()
      setCampaigns((prev) => [data, ...prev])
    } catch (err) {
      console.error(err)
      toast.error('Could not create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  if (user === undefined || user === null) {
    return <Loader fullScreen />
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
        onClose={createModal.onClose}
        size="lg"
        isCentered
      >
        <ModalOverlay backdropFilter="blur(6px)" />
        <ModalContent mx={3} borderRadius="xl">
          <ModalHeader>New campaign</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <FormControl mb={4} isRequired>
                <FormLabel>Name</FormLabel>
                <Input
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
                  placeholder="One per line or comma-separated (e.g. new ATS rollout, hiring spike)"
                  rows={4}
                  value={form.signals}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, signals: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  placeholder="Context, audience, and guardrails for this campaign"
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </FormControl>
            </ModalBody>
            <ModalFooter gap={3}>
              <Button variant="ghost" onClick={createModal.onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={submitting}
                loadingText="Creating"
              >
                Create campaign
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default DashboardLayout()(CampaignsPage)
