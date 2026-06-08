import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmit,
  disabled,
  placeholder = 'Consult with our AI Readiness Experts...',
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const text = input.trim();
    if (text && !disabled) {
      onSubmit(text);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 lg:p-4 border-t border-allys-gray bg-allys-black safe-bottom">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        className={`
          flex-1 bg-allys-dark text-allys-text
          px-3 lg:px-4 py-2.5 lg:py-3 rounded
          text-[16px] sm:text-sm placeholder:text-allys-muted
          focus:outline-none focus:ring-1 focus:ring-allys-light
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
        className={`
          p-2.5 lg:p-3 rounded bg-allys-dark text-allys-text shrink-0
          transition-colors duration-200
          ${disabled || !input.trim()
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-allys-gray active:bg-allys-light'
          }
        `}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>
    </div>
  );
}
