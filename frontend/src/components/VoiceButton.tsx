import { PipelineState } from '../types';

interface VoiceButtonProps {
  isVoiceModeActive: boolean;
  pipelineState: PipelineState;
  onToggle: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function VoiceButton({
  isVoiceModeActive,
  pipelineState,
  onToggle,
  disabled,
  compact = false,
}: VoiceButtonProps) {
  const isProcessing = pipelineState === 'processing';
  const isSpeaking = pipelineState === 'speaking';
  const isListening = pipelineState === 'listening';

  const getStatusText = () => {
    if (!isVoiceModeActive) return 'Speak to Me';
    if (isProcessing) return 'Processing';
    if (isSpeaking) return 'Speaking';
    if (isListening) return 'Listening';
    return 'Connected';
  };

  const getStatusColor = () => {
    if (!isVoiceModeActive) return 'border-green-500/50 hover:border-green-500';
    return 'border-red-500';
  };

  const getIconBgColor = () => {
    if (!isVoiceModeActive) return 'bg-fab-navy hover:bg-fab-navy-dark';
    return 'bg-red-500/20 hover:bg-red-500/30';
  };

  const getIconColor = () => {
    if (!isVoiceModeActive) return 'text-white';
    return 'text-red-400';
  };

  const getStatusDotColor = () => {
    if (isProcessing) return 'bg-yellow-500';
    if (isSpeaking) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Compact mode for mobile bottom bar
  if (compact) {
    return (
      <button
        onClick={onToggle}
        disabled={disabled || isProcessing}
        className={`
          relative shrink-0
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div
          className={`
            w-11 h-11 rounded-full border-2 transition-all duration-300
            flex items-center justify-center
            ${isVoiceModeActive ? 'border-red-500' : 'border-green-500/50'}
            ${isVoiceModeActive && isListening ? 'voice-active-glow' : ''}
            ${isVoiceModeActive && isSpeaking ? 'voice-speaking-glow' : ''}
            ${isVoiceModeActive && isProcessing ? 'voice-processing-glow' : ''}
          `}
        >
          <div
            className={`
              w-8 h-8 rounded-full transition-all duration-200
              flex items-center justify-center
              ${isVoiceModeActive ? 'bg-red-500/20' : 'bg-fab-navy'}
            `}
          >
            <div className={`transition-all duration-200 ${isVoiceModeActive ? 'text-red-400' : 'text-white'}`}>
              {isVoiceModeActive ? (
                // Phone hangup icon (rotated)
                <svg className="w-4 h-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Pulse rings when listening */}
        {isVoiceModeActive && isListening && (
          <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" />
        )}

        {/* Status dot */}
        {isVoiceModeActive && (
          <span
            className={`
              absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white
              ${getStatusDotColor()}
              ${!isProcessing ? 'animate-pulse' : ''}
            `}
          />
        )}
      </button>
    );
  }

  // Full mode for desktop sidebar
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Main Call Button */}
      <button
        onClick={onToggle}
        disabled={disabled || isProcessing}
        className={`
          relative group
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Outer ring with status color */}
        <div
          className={`
            w-32 h-32 rounded-full border-2 transition-all duration-300
            flex items-center justify-center
            ${getStatusColor()}
          `}
        >
          {/* Inner button */}
          <div
            className={`
              w-24 h-24 rounded-full transition-all duration-200
              flex items-center justify-center
              ${getIconBgColor()}
              ${!disabled && !isVoiceModeActive ? 'group-hover:scale-105' : ''}
            `}
          >
            <div className={`transition-all duration-200 ${getIconColor()}`}>
              {isVoiceModeActive ? (
                // Phone hangup icon (rotated) for end call
                <svg className="w-10 h-10 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Pulse animation rings when listening */}
        {isVoiceModeActive && isListening && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-green-500/40 animate-ping" />
            <div className="absolute inset-0 rounded-full border border-green-500/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </>
        )}
      </button>

      {/* Status Indicator */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          {isVoiceModeActive && (
            <span
              className={`
                w-2 h-2 rounded-full
                ${getStatusDotColor()}
                ${!isProcessing ? 'animate-pulse' : ''}
              `}
            />
          )}
          <span className={`text-xs font-medium tracking-wider uppercase ${isVoiceModeActive ? 'text-fab-navy' : 'text-fab-muted'}`}>
            {getStatusText()}
          </span>
        </div>

        <p className={`text-xs ${isVoiceModeActive ? 'text-red-400' : 'text-fab-muted'}`}>
          {isVoiceModeActive ? 'Click to Stop' : 'Click to Start Speaking'}
        </p>
      </div>
    </div>
  );
}
