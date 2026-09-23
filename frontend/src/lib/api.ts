const BASE = ''

export interface Citation {
  source: string
  page: number | null
  file_type: string
  snippet: string
}

export interface DocumentSource {
  source: string
  file_type: string
  total_pages: number | null
}

export interface StreamEvent {
  type: 'citations' | 'token' | 'done' | 'error'
  content?: string
  citations?: Citation[]
  chunks_used?: number
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function uploadDocument(
  file: File
): Promise<{
  message: string
  chunks_created: number
}> {
  const form = new FormData()

  form.append('file', file)

  const res = await fetch(
    `${BASE}/documents/upload`,
    {
      method: 'POST',
      body: form,
    }
  )

  if (!res.ok) {
    const err = await res.json()

    throw new Error(
      err.detail || 'Upload failed'
    )
  }

  return res.json()
}

export async function listDocuments(): Promise<
  DocumentSource[]
> {
  const res = await fetch(
    `${BASE}/documents/`
  )

  if (!res.ok) {
    throw new Error(
      'Failed to fetch documents'
    )
  }

  return res.json()
}

export async function deleteDocument(
  source: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/documents/${encodeURIComponent(source)}`,
    {
      method: 'DELETE',
    }
  )

  if (!res.ok) {
    const err = await res.json()

    throw new Error(
      err.detail || 'Delete failed'
    )
  }
}

export async function* streamQuery(
  question: string,
  history: HistoryMessage[] = [],
  k?: number,
  source?: string
): AsyncGenerator<StreamEvent> {

  const res = await fetch(
    `${BASE}/query/stream`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        question,
        history,
        k,
        source,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()

    throw new Error(
      err.detail || 'Query failed'
    )
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  let buffer = ''

  while (true) {
    const {
      done,
      value,
    } = await reader.read()

    if (done) break

    buffer += decoder.decode(
      value,
      {
        stream: true,
      }
    )

    const lines = buffer.split('\n')

    buffer = lines.pop() ?? ''

    for (const line of lines) {

      if (line.startsWith('data: ')) {

        try {
          yield JSON.parse(
            line.slice(6)
          ) as StreamEvent
        } catch {
          // Ignore malformed stream lines
        }
      }
    }
  }
}