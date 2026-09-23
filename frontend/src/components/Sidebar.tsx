import { useRef, useState } from 'react'
import type { DocumentSource } from '../lib/api'

interface SidebarProps {
  documents: DocumentSource[]
  selectedSource: string | null
  onSelect: (source: string) => void
  onUpload: (file: File) => Promise<void>
  onDelete: (source: string) => Promise<void>
  uploading: boolean
}

const fileLabels: Record<string, string> = {
  pdf: 'PDF',
  txt: 'TXT',
  md: 'MD',
  markdown: 'MD',
}

export function Sidebar({
  documents,
  selectedSource,
  onSelect,
  onUpload,
  onDelete,
  uploading,
}: SidebarProps) {

  const inputRef =
    useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] =
    useState(false)

  const handleFiles = async (
    files: FileList | null
  ) => {

    if (!files?.length) return

    for (const file of Array.from(files)) {
      await onUpload(file)
    }
  }

  return (
    <aside className="sidebar">

      <div className="sidebar-header">

        <h2 className="sidebar-title">
          Knowledge Base
        </h2>

        <span className="doc-count">
          {documents.length}{' '}
          {documents.length === 1
            ? 'document'
            : 'documents'}
        </span>

      </div>

      <div
        className={`drop-zone ${
          dragOver
            ? 'drag-over'
            : ''
        } ${
          uploading
            ? 'uploading'
            : ''
        }`}

        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}

        onDragLeave={() =>
          setDragOver(false)
        }

        onDrop={(event) => {
          event.preventDefault()

          setDragOver(false)

          handleFiles(
            event.dataTransfer.files
          )
        }}

        onClick={() =>
          inputRef.current?.click()
        }
      >

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown"
          multiple
          style={{
            display: 'none',
          }}
          onChange={(event) =>
            handleFiles(
              event.target.files
            )
          }
        />

        <div className="drop-icon">
          {uploading
            ? '...'
            : '+'}
        </div>

        <p className="drop-text">
          {uploading
            ? 'Adding document...'
            : 'Drop files or click to upload'}
        </p>

        <p className="drop-sub">
          PDF · TXT · Markdown
        </p>

      </div>

      <div className="doc-list">

        {documents.length === 0 && (
          <p className="doc-empty">
            No documents yet. Upload one
            to get started.
          </p>
        )}

        {documents.map((doc) => {

          const isSelected =
            selectedSource === doc.source

          return (
            <div
              key={doc.source}

              className={`doc-item ${
                isSelected
                  ? 'selected'
                  : ''
              }`}

              onClick={() =>
                onSelect(doc.source)
              }

              role="button"
              tabIndex={0}

              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' ||
                  event.key === ' '
                ) {
                  event.preventDefault()
                  onSelect(doc.source)
                }
              }}
            >

              <span className="doc-icon">
                {fileLabels[
                  doc.file_type
                ] ?? 'FILE'}
              </span>

              <div className="doc-info">

                <span
                  className="doc-name"
                  title={doc.source}
                >
                  {doc.source}
                </span>

                {doc.total_pages && (
                  <span className="doc-meta">
                    {doc.total_pages}{' '}
                    {doc.total_pages === 1
                      ? 'page'
                      : 'pages'}
                  </span>
                )}

              </div>

              {isSelected && (
                <span className="doc-selected">
                  Selected
                </span>
              )}

              <button
                className="doc-delete"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(doc.source)
                }}
                title="Remove document"
              >
                ×
              </button>

            </div>
          )
        })}

      </div>

    </aside>
  )
}