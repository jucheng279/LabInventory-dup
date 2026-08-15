import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Trash2, CircleAlert as AlertCircle, Mic, MicOff, ChevronDown, ChevronRight, Check, Copy } from 'lucide-react';
import AiSparkleIcon from './AiSparkleIcon';
import { motion, AnimatePresence } from 'motion/react';
import { useAIChat, ThinkingRecord } from '../hooks/useAIChat';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { DotmDriftBL } from './ui/dotm-drift-bl';
import AIChatMarkdown, { type NavLinkData } from './AIChatMarkdown';

interface AIChatPanelProps {
  onNavigate?: (nav: NavLinkData) => void;
}

const SUGGESTED_PROMPTS = [
  'Help me find....',
  'What items are expiring soon?',
  'Which items are low on stock?',
  'Summarize our inventory',
];

const TOOL_LABELS: Record<string, string> = {
  search_inventory: 'Searched inventory',
  get_item_details: 'Got item details',
  get_item_locations: 'Checked locations',
  list_expiring_inventory: 'Checked expirations',
  list_low_stock_items: 'Checked stock levels',
  get_workspace_member_statistics: 'Checked team info',
  get_workspace_inventory_statistics: 'Got inventory stats',
  get_inventory_activity: 'Reviewed activity',
  get_inventory_risk_summary: 'Generated risk summary',
  list_projects: 'Listed projects',
  get_project_contents: 'Got project contents',
  web_search: 'Searched the web',
};

const TOOL_ACTIVE_LABELS: Record<string, string> = {
  search_inventory: 'Searching inventory...',
  get_item_details: 'Getting item details...',
  get_item_locations: 'Checking locations...',
  list_expiring_inventory: 'Checking expirations...',
  list_low_stock_items: 'Checking stock levels...',
  get_workspace_member_statistics: 'Checking team info...',
  get_workspace_inventory_statistics: 'Getting inventory stats...',
  get_inventory_activity: 'Reviewing activity...',
  get_inventory_risk_summary: 'Generating risk summary...',
  list_projects: 'Listing projects...',
  get_project_contents: 'Getting project contents...',
  web_search: 'Searching the web...',
};



const OrbitSpinner: React.FC = () => (
  <div className="w-4 h-4 flex items-center justify-center">
    <DotmDriftBL speed={1.25} animated size={14} dotSize={3} />
  </div>
);

const ThinkingDropdown: React.FC<{ record: ThinkingRecord }> = ({ record }) => {
  const [expanded, setExpanded] = useState(false);
  const seconds = Math.max(1, Math.round(record.durationMs / 1000));

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-medium">Worked for {seconds}s</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-5 pt-1.5 space-y-1">
              {record.steps.map((step, i) => (
                <p key={i} className="text-[11px] text-gray-400 leading-relaxed">{step}</p>
              ))}
              {record.tools.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[...new Set(record.tools)].map((tool, i) => (
                    <span key={i} className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                      {TOOL_LABELS[tool] || tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LiveThinkingIndicator: React.FC<{
  currentStep: string | null;
  currentTool: string | null;
  phase: string | null;
  isThinkingDone: boolean;
  workDurationMs: number;
}> = ({ currentStep, currentTool, phase, isThinkingDone, workDurationMs }) => {
  if (isThinkingDone) {
    const seconds = Math.max(1, Math.round(workDurationMs / 1000));
    return (
      <div className="flex items-center gap-1.5 mb-2 ml-1">
        <span className="text-xs text-gray-400 font-medium">Worked for {seconds}s</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mb-2 ml-1">
      <div className="flex items-center gap-2">
        <OrbitSpinner />
        <span className="text-xs text-gray-500 font-medium">
          {phase === 'tool' && currentTool
            ? (TOOL_ACTIVE_LABELS[currentTool] || `Using ${currentTool}...`)
            : 'Thinking...'}
        </span>
      </div>
      {currentStep && (
        <motion.p
          key={currentStep}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[11px] text-gray-400 leading-relaxed ml-5.5 pl-[22px] max-w-[80%] line-clamp-2"
        >
          {currentStep}
        </motion.p>
      )}
    </div>
  );
};

const AIChatPanel: React.FC<AIChatPanelProps> = ({ onNavigate }) => {
  const {
    messages, isLoading, streamingContent, error, suggestedTerms,
    phase, currentTool, currentThinkingStep, workDurationMs,
    isThinkingDone, getThinkingRecord, sendMessage, clearChat
  } = useAIChat();
  const [input, setInput] = useState('');
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscriptReady = useCallback((text: string) => {
    setInput(prev => prev ? prev + ' ' + text : text);
  }, []);

  const stt = useSpeechToText(handleTranscriptReady);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (stt.status === 'recording') {
      const display = stt.committedText
        ? stt.partialTranscript
          ? stt.committedText + ' ' + stt.partialTranscript
          : stt.committedText
        : stt.partialTranscript;
      setInput(display);
    }
  }, [stt.partialTranscript, stt.committedText, stt.status]);

  const handleMicToggle = () => {
    if (stt.status === 'recording' || stt.status === 'connecting') {
      stt.stopRecording();
    } else {
      stt.startRecording();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyTerm = async (term: string) => {
    try {
      await navigator.clipboard.writeText(term);
      setCopiedTerm(term);
      setTimeout(() => setCopiedTerm(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const insertText = suggestion.endsWith('....') ? suggestion.replace(/\.+$/, ' ') : suggestion;
    setInput(insertText);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 relative">
      <div className="absolute inset-0 ai-dot-grid pointer-events-none z-0" />

      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur border-b border-gray-200 z-10 relative">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center">
              <AiSparkleIcon className="h-5 w-5 text-ai-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate">
                Inventory Copilot
              </h1>
              <p className="text-xs text-gray-400 font-medium">Read-only AI agent</p>
            </div>
          </div>
          {messages.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={clearChat}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              title="Clear chat"
            >
              <Trash2 size={18} />
            </motion.button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 relative z-10">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 flex flex-col items-center"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-8 tracking-tight">Ask anything about your inventory</h3>
              <div className="grid gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((suggestion, idx) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgb(239 246 255)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-center px-4 py-2.5 rounded-full border border-gray-200 text-sm text-gray-600 hover:border-ai-200 hover:text-ai-700 transition-colors bg-white shadow-sm"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === 'assistant' && (() => {
                const record = getThinkingRecord(idx);
                return record ? <ThinkingDropdown record={record} /> : null;
              })()}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 shadow-sm border border-gray-100'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <AIChatMarkdown content={msg.content} onCopyTerm={handleCopyTerm} copiedTerm={copiedTerm} onNavigate={onNavigate} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
          >
            <LiveThinkingIndicator
              currentStep={currentThinkingStep}
              currentTool={currentTool}
              phase={phase}
              isThinkingDone={isThinkingDone}
              workDurationMs={workDurationMs}
            />
            {streamingContent ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100 text-sm leading-relaxed text-gray-700">
                  <span className="ai-typing-cursor">
                    <AIChatMarkdown content={streamingContent} onCopyTerm={handleCopyTerm} copiedTerm={copiedTerm} onNavigate={onNavigate} />
                  </span>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              <AlertCircle size={14} />
              {error}
            </div>
          </motion.div>
        )}

        {stt.error && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              <MicOff size={14} />
              {stt.error}
            </div>
          </div>
        )}

        {suggestedTerms.length > 0 && messages.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-1.5 pl-2"
          >
            <span className="text-xs text-gray-400 self-center mr-1">Copy to search:</span>
            {suggestedTerms.map((term) => (
              <button
                key={term}
                onClick={() => handleCopyTerm(term)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-gray-600 text-xs font-medium hover:bg-ai-50 hover:text-ai-700 transition-colors border border-gray-200 hover:border-ai-200 shadow-sm"
              >
                {term}
                {copiedTerm === term ? (
                  <Check size={10} className="text-green-600" />
                ) : (
                  <Copy size={10} className="opacity-40" />
                )}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 relative z-10 shrink-0 flex justify-center">
        <form
          onSubmit={handleSubmit}
          className={`w-full max-w-[720px] flex items-end gap-1.5 rounded-2xl border bg-white px-4 py-2 shadow-sm transition-colors ${
            stt.status === 'recording' ? 'border-red-300' : 'border-gray-200 focus-within:border-gray-300'
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={stt.status === 'recording' ? 'Listening...' : 'Ask about your inventory...'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm placeholder-gray-400 focus:outline-none max-h-32 overflow-y-auto py-1.5"
            style={{ minHeight: '28px' }}
            disabled={isLoading || stt.status === 'recording'}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={handleMicToggle}
            disabled={isLoading}
            className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
              stt.status === 'recording' || stt.status === 'connecting'
                ? 'text-red-500'
                : 'text-gray-400 hover:text-gray-600'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={stt.status === 'recording' ? 'Stop recording' : 'Voice input'}
          >
            {stt.status === 'recording' || stt.status === 'connecting' ? <MicOff size={18} /> : <Mic size={18} />}
          </motion.button>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={!input.trim() || isLoading}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              input.trim() && !isLoading
                ? 'bg-gray-900 text-white hover:bg-black'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowUp size={16} />
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default AIChatPanel;
