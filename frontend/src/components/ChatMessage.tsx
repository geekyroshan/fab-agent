import { ReactNode } from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  /** Kept for backward compatibility with existing callers; unused now. */
  index?: number;
  onMuteAudio?: () => void;
  showMuteButton?: boolean;
}

function formatMessage(content: string): ReactNode {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let bulletGroup: ReactNode[] = [];
  let numberedGroup: ReactNode[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 my-1.5">
          {bulletGroup}
        </ul>
      );
      bulletGroup = [];
    }
  };

  const flushNumbered = () => {
    if (numberedGroup.length > 0) {
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-1 my-1.5">
          {numberedGroup}
        </ol>
      );
      numberedGroup = [];
    }
  };

  const formatInline = (text: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    let remaining = text;
    let i = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(remaining.slice(0, boldMatch.index));
        }
        parts.push(<strong key={`b${i++}`}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }
    return parts;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet lines
    if (/^[-*]\s+/.test(trimmed)) {
      flushNumbered();
      const text = trimmed.replace(/^[-*]\s+/, '');
      bulletGroup.push(<li key={key++}>{formatInline(text)}</li>);
      continue;
    }

    // Numbered lines
    const numMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (numMatch) {
      flushBullets();
      numberedGroup.push(<li key={key++}>{formatInline(numMatch[1])}</li>);
      continue;
    }

    // Regular text or empty line
    flushBullets();
    flushNumbered();

    if (trimmed === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="my-0.5">{formatInline(trimmed)}</p>);
    }
  }

  flushBullets();
  flushNumbered();

  return elements;
}

export function ChatMessage({ message, onMuteAudio, showMuteButton }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="message-enter mb-4 lg:mb-6">
      <div className="flex items-start gap-2 lg:gap-4">
        {/* Role avatar */}
        <div
          className={`flex-shrink-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-fab-navy/10' : 'bg-fab-navy'
          }`}
        >
          <span
            className={`text-[10px] lg:text-xs font-semibold ${
              isUser ? 'text-fab-navy' : 'text-white'
            }`}
          >
            {isUser ? 'YOU' : 'FAB'}
          </span>
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] leading-relaxed ${isUser ? 'text-fab-muted' : 'text-fab-text'}`}>
            {isUser ? message.content : formatMessage(message.content)}
          </div>

          {/* Metadata */}
          <div className="mt-1.5 lg:mt-2 flex items-center gap-2 lg:gap-3 text-[10px] lg:text-xs text-fab-muted flex-wrap">
            <span>{time}</span>
            <span>•</span>
            <span>{isUser ? 'YOU' : 'FAB'}</span>
            {message.inputType === 'voice' && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  VOICE
                </span>
              </>
            )}
            {!isUser && showMuteButton && onMuteAudio && (
              <>
                <span>•</span>
                <button
                  onClick={onMuteAudio}
                  className="text-fab-muted hover:text-fab-red transition-colors"
                  title="Mute this response"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
