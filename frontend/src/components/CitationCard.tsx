import type { Citation } from '../lib/api'

interface CitationCardProps {
  citation: Citation
  index: number
}

const fileLabels: Record<string, string> = {
  pdf: 'PDF',
  txt: 'TXT',
  md: 'MD',
  markdown: 'MD',
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const fileLabel = fileLabels[citation.file_type] ?? 'FILE'

  const label = citation.page
    ? `${citation.source} · page ${citation.page}`
    : citation.source

  return (
    <div className="citation-card">
      <div className="citation-header">
        <span className="citation-index">{index}</span>

        <span className="citation-type">
          {fileLabel}
        </span>

        <span
          className="citation-label"
          title={citation.source}
        >
          {label}
        </span>
      </div>

      {citation.snippet && (
        <p className="citation-snippet">
          {citation.snippet}
        </p>
      )}
    </div>
  )
}