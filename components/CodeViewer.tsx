'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  source: string
  highlightLine: number // 1-based
}

export default function CodeViewer({ source, highlightLine }: Props) {
  const lineRef = useRef<HTMLTableRowElement>(null)
  const hljsRef = useRef<any>(null)
  const [hlReady, setHlReady] = useState(false)

  useEffect(() => {
    lineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightLine])

  // Load highlight.js (CDN) and stylesheet once
  useEffect(() => {
    if ((window as any).hljs) {
      hljsRef.current = (window as any).hljs
      setHlReady(true)
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js'
    script.async = true
    script.onload = () => {
      hljsRef.current = (window as any).hljs
      setHlReady(true)
    }
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  const lines = source.split('\n')

  function getHighlightedLine(line: string) {
    if (!hlReady || !hljsRef.current) return line
    try {
      const detected = hljsRef.current.highlightAuto(source)
      const lang = detected.language
      if (lang) return hljsRef.current.highlight(line, { language: lang }).value
      return hljsRef.current.highlightAuto(line).value
    } catch (e) {
      return line
    }
  }

  return (
    <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-[#2a2d3a] bg-[#0d0f17] text-xs">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => {
            const lineNum = i + 1
            const isHighlight = lineNum === highlightLine
            return (
              <tr
                key={lineNum}
                ref={isHighlight ? lineRef : undefined}
                className={isHighlight ? 'bg-amber-500/15' : undefined}
              >
                <td
                  className="select-none px-3 py-0.5 text-right font-mono text-slate-600 w-10 shrink-0"
                  aria-hidden="true"
                >
                  {lineNum}
                </td>
                <td
                  className={`px-3 py-0.5 font-mono whitespace-pre ${
                    isHighlight ? 'text-amber-200' : 'text-slate-300'
                  }`}
                >
                  {hlReady ? (
                    // eslint-disable-next-line react/no-danger
                    <code className="hljs" dangerouslySetInnerHTML={{ __html: getHighlightedLine(line) || ' ' }} />
                  ) : (
                    line || ' '
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
