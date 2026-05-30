'use client'

import { useState, useEffect } from 'react'
import type { Finding } from '@/types/findings'
import SeverityBadge from './SeverityBadge'
import CheckTooltip from './CheckTooltip'
import CodeViewer from './CodeViewer'
import { loadSourceCode } from '@/lib/codeStore'
import { mute, unmute, isMuted } from '@/lib/mutedFindings'

interface Props {
  finding: Finding
  onMuteChange?: () => void
}

export default function FindingCard({ finding, onMuteChange }: Props) {
  const [showCode, setShowCode] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSource(loadSourceCode())
    setMuted(isMuted(finding))
  }, [finding])

  function handleMuteToggle() {
    if (muted) {
      unmute(finding)
      setMuted(false)
    } else {
      mute(finding)
      setMuted(true)
    }
    onMuteChange?.()
  }

  function handleCopy() {
    const text = [
      `[${finding.severity.toUpperCase()}] Check: ${finding.check_name}`,
      `File: ${finding.file_path}`,
      `Line: ${finding.line}`,
      `Function: ${finding.function_name}`,
      '',
      'Description:',
      finding.description,
      finding.remediation ? `\nRemediation:\n${finding.remediation}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }

  return (
    <div className={`slide-down rounded-lg border border-[#2a2d3a] bg-[#12151f] p-5 ${muted ? 'opacity-50' : ''}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={finding.severity} />
          <CheckTooltip checkName={finding.check_name} />
          {muted && (
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
              Muted
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 rounded-md border border-[#2a2d3a] bg-[#1a1d27] px-2.5 py-1 text-xs font-medium transition-all duration-200 hover:border-slate-500 ${
            copied ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Copy finding as formatted text"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-slate-300">
        {finding.description}
      </p>

      {finding.remediation && (
        <div className="mb-5 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-green-400">Remediation</p>
          <p className="text-sm leading-relaxed text-green-300/90">
            {finding.remediation}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Detail label="Function" value={finding.function_name} mono />
        <Detail label="File" value={finding.file_path} mono />
        <Detail label="Line" value={String(finding.line)} mono />
      </div>

      {source && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCode(v => !v)}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            aria-expanded={showCode}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showCode ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showCode ? 'Hide code' : 'View in code'}
          </button>
          {showCode && <CodeViewer source={source} highlightLine={finding.line} />}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={handleMuteToggle}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {muted ? 'Unmute this finding' : 'Mute this finding'}
        </button>
        <a
          href={`https://github.com/Veritas-Vaults-Network/soroban-guard-core/issues/new?title=${encodeURIComponent(`False positive: ${finding.check_name}`)}&body=${encodeURIComponent(finding.description)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Report false positive
        </a>
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-md bg-[#1a1d27] px-3 py-2">
      <p className="mb-0.5 text-xs text-slate-500">{label}</p>
      <p
        className={`truncate text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
