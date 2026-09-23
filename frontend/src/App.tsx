import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatMessage, type Message } from './components/ChatMessage'
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  streamQuery,
  type DocumentSource,
} from './lib/api'

interface Chat {
  id: string
  title: string
  messages: Message[]
}

const STORAGE_KEY = 'lotus-chats'

function createChat(): Chat {
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    messages: [],
  }
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)

      if (saved) {
        const parsed = JSON.parse(saved)

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {}

    return [createChat()]
  })

  const [activeChatId, setActiveChatId] = useState<string>(
    chats[0]?.id ?? ''
  )

  const [documents, setDocuments] = useState<DocumentSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const [showDocs, setShowDocs] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ?? chats[0]

  const messages = activeChat?.messages ?? []

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages, streaming])

  async function loadDocuments() {
    try {
      const docs = await listDocuments()
      setDocuments(docs)

      if (
        selectedSource &&
        !docs.some((doc) => doc.source === selectedSource)
      ) {
        setSelectedSource(null)
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }

  function updateActiveChat(updater: (chat: Chat) => Chat) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChatId ? updater(chat) : chat
      )
    )
  }

  function handleNewChat() {
    const newChat = createChat()

    setChats((current) => [newChat, ...current])
    setActiveChatId(newChat.id)
    setInput('')
    setError('')
  }

  function handleDeleteChat(id: string) {
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== id)

      if (remaining.length === 0) {
        const newChat = createChat()
        setActiveChatId(newChat.id)
        return [newChat]
      }

      if (id === activeChatId) {
        setActiveChatId(remaining[0].id)
      }

      return remaining
    })
  }

  function handleSelectDocument(source: string) {
    setSelectedSource((current) =>
      current === source ? null : source
    )

    setError('')

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')

    try {
      await uploadDocument(file)
      await loadDocuments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Upload failed'
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(source: string) {
    try {
      await deleteDocument(source)

      if (selectedSource === source) {
        setSelectedSource(null)
      }

      await loadDocuments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Delete failed'
      )
    }
  }

  async function handleSend() {
    const question = input.trim()

    if (!question || streaming) return

    if (!selectedSource) {
      setError('Select a document first.')
      return
    }

    setInput('')
    setError('')
    setStreaming(true)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      citations: [],
      chunks_used: 0,
      streaming: true,
    }

    updateActiveChat((chat) => {
      const updatedMessages = [
        ...chat.messages,
        userMessage,
        assistantMessage,
      ]

      return {
        ...chat,
        title:
          chat.messages.length === 0
            ? question.slice(0, 40)
            : chat.title,
        messages: updatedMessages,
      }
    })

    const history = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }))

    try {
      let finalAnswer = ''
      let citations = []
      let chunksUsed = 0

      for await (const event of streamQuery(
        question,
        history,
        undefined,
        selectedSource ?? undefined
      )) {
        if (event.type === 'citations') {
          citations = event.citations ?? []
          chunksUsed = event.chunks_used ?? 0

          updateActiveChat((chat) => ({
            ...chat,
            messages: chat.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    citations,
                    chunks_used: chunksUsed,
                  }
                : message
            ),
          }))
        }

        if (event.type === 'token') {
          finalAnswer += event.content ?? ''

          updateActiveChat((chat) => ({
            ...chat,
            messages: chat.messages.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: finalAnswer,
                  }
                : message
            ),
          }))
        }

        if (event.type === 'error') {
          throw new Error(
            event.content || 'Something went wrong.'
          )
        }
      }

      updateActiveChat((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                streaming: false,
              }
            : message
        ),
      }))
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong.'

      setError(message)

      updateActiveChat((chat) => ({
        ...chat,
        messages: chat.messages.filter(
          (message) => message.id !== assistantMessage.id
        ),
      }))
    } finally {
      setStreaming(false)

      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="app-shell">

      {/* Main navigation */}
      <nav className="main-nav">

        <div className="brand">
          <div className="brand-mark">🪷</div>

          <div>
            <div className="brand-name">Lotus</div>

            <div className="brand-subtitle">
              Knowledge Assistant
            </div>
          </div>
        </div>

        <div className="nav-section">

          <button
            className="new-chat-button"
            onClick={handleNewChat}
          >
            <span>+</span>
            New chat
          </button>

          <div className="nav-label">
            Conversations
          </div>

          <div className="chat-list">

            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${
                  chat.id === activeChatId ? 'active' : ''
                }`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <span className="chat-item-title">
                  {chat.title}
                </span>

                {chats.length > 1 && (
                  <button
                    className="chat-delete"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteChat(chat.id)
                    }}
                    title="Delete conversation"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

          </div>
        </div>

        <div className="nav-bottom">

          <button
            className={`docs-toggle ${
              showDocs ? 'active' : ''
            }`}
            onClick={() =>
              setShowDocs((current) => !current)
            }
          >
            <span>▣</span>
            Documents
            <span className="docs-count">
              {documents.length}
            </span>
          </button>

        </div>

      </nav>

      {/* Documents sidebar */}
      {showDocs && (
        <Sidebar
          documents={documents}
          selectedSource={selectedSource}
          onSelect={handleSelectDocument}
          onUpload={handleUpload}
          onDelete={handleDelete}
          uploading={uploading}
        />
      )}

      {/* Chat area */}
      <main className="chat-area">

        <header className="chat-header">

          <div>
            <div className="chat-header-title">
              {selectedSource
                ? selectedSource
                : 'Lotus'}
            </div>

            <div className="chat-header-subtitle">
              {selectedSource
                ? 'Ask questions about this document'
                : 'Ready when you are'}
            </div>
          </div>

          {selectedSource && (
            <button
              className="clear-document"
              onClick={() => setSelectedSource(null)}
            >
              Clear
            </button>
          )}

        </header>

        <div className="messages-area">

          {messages.length === 0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                🪷
              </div>

              <h1>
                {selectedSource
                  ? 'What would you like to know?'
                  : 'Welcome to Lotus'}
              </h1>

              <p>
                {selectedSource
                  ? `Ask anything about ${selectedSource}.`
                  : 'Your documents will appear here once you select one.'}
              </p>

            </div>
          ) : (
            <div className="messages-container">

              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                />
              ))}

              <div ref={messagesEndRef} />

            </div>
          )}

        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="input-area">

          <div className="input-wrapper">

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={!selectedSource || streaming}
              placeholder={
                !selectedSource
                  ? 'Choose a document above...'
                  : streaming
                  ? 'Lotus is thinking...'
                  : 'Ask something about this document...'
              }
              rows={1}
            />

            <button
              className="send-button"
              onClick={handleSend}
              disabled={
                !selectedSource ||
                !input.trim() ||
                streaming
              }
              title="Send"
            >
              ↑
            </button>

          </div>

          <div className="input-hint">
            Enter to send · Shift + Enter for a new line
          </div>

        </div>

      </main>

    </div>
  )
}