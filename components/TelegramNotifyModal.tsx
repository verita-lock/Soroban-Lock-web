'use client'

import { useId, useState } from 'react'
import type { Finding } from '@/types/findings'
import { postToTelegram } from '@/lib/telegram'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface Props {
  findings: Finding[]
  source: string
  onClose: () => void
}

export default function TelegramNotifyModal({ findings, source, onClose }: Props) {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await postToTelegram(botToken.trim(), chatId.trim(), findings, source)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-[#2a2d3a] bg-[#0e1117] p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold text-white">Send to Telegram</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded text-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === 'done' ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">✓ Scan results sent to Telegram</p>
            <button onClick={onClose} className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              required
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="Bot Token (from @BotFather)"
              disabled={status === 'sending'}
              className="w-full rounded-lg border border-[#2a2d3a] bg-[#12151f] px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
            />
            <input
              required
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Chat ID (e.g. -1001234567890)"
              disabled={status === 'sending'}
              className="w-full rounded-lg border border-[#2a2d3a] bg-[#12151f] px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500">Token is never stored or sent to our servers.</p>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {status === 'sending' ? 'Sending…' : 'Send notification'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
