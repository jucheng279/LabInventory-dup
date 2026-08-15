import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ArrowUp, Trash2, CircleAlert as AlertCircle, Mic, MicOff, Wrench } from 'lucide-react';
import AiSparkleIcon from './AiSparkleIcon';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shader,
  ChromaFlow,
  ChromaticAberration,
  FilmGrain,
  SineWave,
  SolidColor,
  Spherize,
  WaveDistortion,
} from 'shaders/react';
import { useAIChat } from '../hooks/useAIChat';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useVolumeMonitor } from '../hooks/useVolumeMonitor';
import { prefetchScribeToken } from '../services/sttTokenService';
import { useEscapeKey } from '../hooks/useEscapeKey';
import VoiceTranscriptCard from './VoiceTranscriptCard';
import { DotmDriftBL } from './ui/dotm-drift-bl';
import AIChatMarkdown, { type NavLinkData } from './AIChatMarkdown';

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
};



const OrbitSpinner: React.FC = () => (
  <div className="w-4 h-4 flex items-center justify-center">
    <DotmDriftBL speed={1.25} animated size={14} dotSize={3} />
  </div>
);

const HOLD_THRESHOLD_MS = 300;

interface FloatingAIChatBubbleProps {
  onNavigate?: (nav: NavLinkData) => void;
}

const FloatingAIChatBubble: React.FC<FloatingAIChatBubbleProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isLoading, streamingContent, error, suggestedTerms, toolsUsed, phase, currentTool, sendMessage, clearChat } = useAIChat();
  const [input, setInput] = useState('');
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hold-to-record state
  const [isHolding, setIsHolding] = useState(false);
  const [holdTranscript, setHoldTranscript] = useState('');
  const [showTranscriptCard, setShowTranscriptCard] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActiveRef = useRef(false);
  const pressStartRef = useRef(0);
  const volumeStreamRef = useRef<MediaStream | null>(null);

  const showTranscriptCardRef = useRef(false);
  showTranscriptCardRef.current = showTranscriptCard;

  const handleTranscriptReady = useCallback((text: string) => {
    if (holdActiveRef.current || showTranscriptCardRef.current) {
      setHoldTranscript(text);
    } else {
      setInput(prev => prev ? prev + ' ' + text : text);
    }
  }, []);

  const stt = useSpeechToText(handleTranscriptReady);
  const volumeMonitor = useVolumeMonitor();

  useEffect(() => {
    prefetchScribeToken();
  }, []);

  const stopAllRecording = useCallback(() => {
    stt.stopRecording();
    volumeMonitor.stopMonitoring();
    if (volumeStreamRef.current) {
      volumeStreamRef.current.getTracks().forEach((t) => t.stop());
      volumeStreamRef.current = null;
    }
  }, [stt, volumeMonitor]);

  useEscapeKey(() => {
    if (isHolding) {
      holdActiveRef.current = false;
      setIsHolding(false);
      setShowTranscriptCard(false);
      setHoldTranscript('');
      stt.clearText();
      stopAllRecording();
    } else if (showTranscriptCard) {
      handleDiscardTranscript();
    } else if (isOpen) {
      setIsOpen(false);
    }
  });

  // Hold gesture handlers
  const handlePointerDown = useCallback(() => {
    if (isOpen) return;
    pressStartRef.current = Date.now();
    holdTimerRef.current = setTimeout(async () => {
      holdActiveRef.current = true;
      setIsHolding(true);
      setHoldTranscript('');
      stt.clearText();
      setShowTranscriptCard(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        volumeStreamRef.current = stream;
        volumeMonitor.startMonitoring(stream);
        stt.startRecording(stream);
      } catch {
        stt.startRecording();
      }
    }, HOLD_THRESHOLD_MS);
  }, [isOpen, stt, volumeMonitor]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      setIsHolding(false);
      stopAllRecording();
    } else {
      const elapsed = Date.now() - pressStartRef.current;
      if (elapsed < HOLD_THRESHOLD_MS) {
        setIsOpen(prev => !prev);
      }
    }
  }, [stopAllRecording]);

  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      setIsHolding(false);
      stopAllRecording();
    }
  }, [stopAllRecording]);

  const handleSendTranscript = useCallback(() => {
    const text = holdTranscript.trim();
    if (text) {
      sendMessage(text);
      setIsOpen(true);
    }
    setShowTranscriptCard(false);
    setHoldTranscript('');
    stt.clearText();
  }, [holdTranscript, sendMessage, stt]);

  const handleDiscardTranscript = useCallback(() => {
    setShowTranscriptCard(false);
    setHoldTranscript('');
    stt.clearText();
  }, [stt]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingContent, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stt.status === 'recording') {
      const display = stt.committedText
        ? stt.partialTranscript
          ? stt.committedText + ' ' + stt.partialTranscript
          : stt.committedText
        : stt.partialTranscript;
      if (!display) return;
      if (holdActiveRef.current || showTranscriptCard) {
        setHoldTranscript(display);
      } else {
        setInput(display);
      }
    }
  }, [stt.partialTranscript, stt.committedText, stt.status, showTranscriptCard]);

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
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="mb-3 w-[380px] max-w-[calc(100vw-40px)] h-[520px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white/90 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-10 h-10 flex items-center justify-center">
                  <AiSparkleIcon className="h-5 w-5 text-ai-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Inventory Copilot</h2>
                  <p className="text-[11px] text-gray-400 font-medium">Read-only AI agent</p>
                </div>
              </div>
              {messages.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={clearChat}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                  title="Clear chat"
                >
                  <Trash2 size={15} />
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center"
                  >

                    <h3 className="text-base font-semibold text-gray-900 mb-1.5 tracking-tight">Ask anything about your inventory</h3>

                    <div className="grid gap-1.5 w-full max-w-[280px]">
                      {SUGGESTED_PROMPTS.map((suggestion, idx) => (
                        <motion.button
                          key={suggestion}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 + idx * 0.04, duration: 0.25 }}
                          whileHover={{ scale: 1.02 }}
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {msg.role === 'assistant' && idx === messages.length - 1 && toolsUsed.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1 flex-wrap">
                        <Wrench size={10} className="text-gray-300" />
                        <span className="text-[10px] text-gray-400">
                          {toolsUsed.map(t => TOOL_LABELS[t] || t).join(' / ')}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-700 shadow-sm border border-gray-100'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <AIChatMarkdown content={msg.content} onCopyTerm={handleCopyTerm} copiedTerm={copiedTerm} onNavigate={onNavigate ? (nav) => { onNavigate(nav); setIsOpen(false); } : undefined} />
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2"
                >
                  {(phase === 'thinking' || phase === 'tool') && !streamingContent && (
                    <div className="flex items-center gap-2 ml-1">
                      <OrbitSpinner />
                      <span className="text-xs text-gray-500 font-medium">
                        {phase === 'thinking' && 'Thinking...'}
                        {phase === 'tool' && currentTool && (TOOL_ACTIVE_LABELS[currentTool] || `Using ${currentTool}...`)}
                      </span>
                    </div>
                  )}
                  {streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100 text-sm leading-relaxed text-gray-700">
                        <span className="ai-typing-cursor">
                          <AIChatMarkdown content={streamingContent} onCopyTerm={handleCopyTerm} copiedTerm={copiedTerm} onNavigate={onNavigate ? (nav) => { onNavigate(nav); setIsOpen(false); } : undefined} />
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center"
                >
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                    <AlertCircle size={12} />
                    {error}
                  </div>
                </motion.div>
              )}

              {stt.error && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                    <MicOff size={12} />
                    {stt.error}
                  </div>
                </div>
              )}

              {suggestedTerms.length > 0 && messages.length > 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-1 pl-1"
                >
                  <span className="text-[10px] text-gray-400 self-center mr-1">Copy:</span>
                  {suggestedTerms.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleCopyTerm(term)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-gray-600 text-xs font-medium hover:bg-ai-50 hover:text-ai-700 transition-colors border border-gray-200 hover:border-ai-200 shadow-sm"
                    >
                      {term}
                      {copiedTerm === term ? (
                        <Check size={9} className="text-green-600" />
                      ) : (
                        <Copy size={9} className="opacity-40" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-gray-100 shrink-0">
              <form
                onSubmit={handleSubmit}
                className={`flex items-end gap-1.5 rounded-xl border bg-white px-3 py-1.5 transition-colors ${
                  stt.status === 'recording' ? 'border-red-300' : 'border-gray-200 focus-within:border-gray-300'
                }`}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={stt.status === 'recording' ? 'Listening...' : 'Ask about inventory...'}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-[13px] placeholder-gray-400 focus:outline-none max-h-24 overflow-y-auto py-1.5"
                  style={{ minHeight: '26px' }}
                  disabled={isLoading || stt.status === 'recording'}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={handleMicToggle}
                  disabled={isLoading}
                  className={`flex-shrink-0 p-1 rounded-full transition-colors ${
                    stt.status === 'recording' || stt.status === 'connecting'
                      ? 'text-red-500'
                      : 'text-gray-400 hover:text-gray-600'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={stt.status === 'recording' ? 'Stop recording' : 'Voice input'}
                >
                  {stt.status === 'recording' || stt.status === 'connecting' ? <MicOff size={16} /> : <Mic size={16} />}
                </motion.button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.9 }}
                  disabled={!input.trim() || isLoading}
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    input.trim() && !isLoading
                      ? 'bg-gray-900 text-white hover:bg-black'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp size={14} />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Transcript Card */}
      {showTranscriptCard && !isOpen && (
        <VoiceTranscriptCard
          transcript={holdTranscript}
          isRecording={isHolding}
          isConnecting={stt.status === 'connecting'}
          onSend={handleSendTranscript}
          onDiscard={handleDiscardTranscript}
        />
      )}

      {/* The Bubble Button */}
      <motion.button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        animate={{
          scale: isHolding ? 1.0 + volumeMonitor.volume * 0.5 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        whileHover={!isHolding ? { scale: 1.08 } : undefined}
        className="relative w-14 h-14 rounded-full flex items-center justify-center group overflow-hidden shadow-lg shadow-blue-500/40 transition-shadow border-none outline-none ring-0 appearance-none p-0 bg-transparent select-none touch-none"
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <Shader style={{ width: '100%', height: '100%' }}>
            <Spherize
              depth={1.79}
              lightColor="#dbeafe"
              lightPosition={{ x: 0.35, y: 0.25 }}
              radius={0.97}
            >
              <SolidColor color="#ffffff" />
              <SineWave
                amplitude={0.36}
                angle={177}
                blendMode="normal-oklch"
                color="#60a5fa"
                frequency={0.15}
                position={{ x: 0.22, y: 0.27 }}
                softness={0.3}
                speed={isHolding ? 8 + volumeMonitor.volume * 24 : 1.5}
                thickness={0.6}
              />
              <SineWave
                amplitude={0.05}
                angle={2}
                blendMode="normal-oklch"
                color="#93c5fd"
                frequency={0.4}
                position={{ x: 0.6, y: 0.51 }}
                softness={0.3}
                speed={isHolding ? 10 + volumeMonitor.volume * 26 : 2}
                thickness={0.4}
              />
              <WaveDistortion
                angle={149}
                frequency={3}
                speed={isHolding ? 9 + volumeMonitor.volume * 22 : 2}
                strength={isHolding ? 3 + volumeMonitor.volume * 6 : 1}
              />
              <ChromaFlow
                downColor="#93c5fd"
                intensity={isHolding ? 3.5 + volumeMonitor.volume * 6 : 1.2}
                leftColor="#bfdbfe"
                momentum={10}
                radius={2}
                rightColor="#eff6ff"
                upColor="#ffffff"
              />
            </Spherize>
            <ChromaticAberration strength={isHolding ? 0.06 + volumeMonitor.volume * 0.05 : 0.02} />
            <FilmGrain strength={0.04} />
          </Shader>
        </div>
        <div className="absolute inset-0 rounded-full pointer-events-none z-10" style={{ background: 'radial-gradient(circle, transparent 35%, rgba(255,255,255,1) 100%)' }} />
        <div className="absolute inset-0 rounded-full pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 15px 5px rgba(255,255,255,1)' }} />

        {/* Unread indicator when closed and there are messages */}
        {!isOpen && !isHolding && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
};

export default FloatingAIChatBubble;
