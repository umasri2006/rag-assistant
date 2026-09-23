import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CitationCard } from './CitationCard'
import type { Citation } from '../lib/api'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  chunks_used?: number
  streaming?: boolean
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  )
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  const isThinking =
    !isUser &&
    message.streaming === true &&
    message.content === ''

  return (
    <div
      className={`message ${
        isUser ? 'message-user' : 'message-assistant'
      }`}
    >
      <div className="message-avatar">
        {isUser ? 'You' : 'L'}
      </div>

      <div className="message-body">
        <div className="message-bubble">
          {isThinking ? (
            <TypingIndicator />
          ) : isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}

          {message.streaming === true &&
            message.content !== '' && (
              <span className="cursor-blink">▌</span>
            )}
        </div>

        {message.citations &&
          message.citations.length > 0 && (
            <div className="citations-section">
              <div className="citations-header">
                <span className="citations-label">
                  References
                </span>

                <span className="citations-count">
                  {message.citations.length}{' '}
                  {message.citations.length === 1
                    ? 'source'
                    : 'sources'}
                </span>
              </div>

              <div className="citations-grid">
                {message.citations.map((citation, index) => (
                  <CitationCard
                    key={`${citation.source}-${index}`}
                    citation={citation}
                    index={index + 1}
                  />
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}