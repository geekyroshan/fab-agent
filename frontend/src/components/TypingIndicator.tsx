export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 lg:gap-4 mb-4 lg:mb-6">
      <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-fab-navy flex items-center justify-center">
        <div className="flex gap-0.5 lg:gap-1">
          <span className="typing-dot w-1 h-1 lg:w-1.5 lg:h-1.5 bg-white rounded-full" />
          <span className="typing-dot w-1 h-1 lg:w-1.5 lg:h-1.5 bg-white rounded-full" />
          <span className="typing-dot w-1 h-1 lg:w-1.5 lg:h-1.5 bg-white rounded-full" />
        </div>
      </div>
      <span className="text-[10px] lg:text-xs text-fab-muted">FAB is thinking...</span>
    </div>
  );
}
