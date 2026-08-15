import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X } from 'lucide-react';

interface VoiceTranscriptCardProps {
  transcript: string;
  isRecording: boolean;
  isConnecting?: boolean;
  onSend: () => void;
  onDiscard: () => void;
}

const VoiceTranscriptCard: React.FC<VoiceTranscriptCardProps> = ({
  transcript,
  isRecording,
  isConnecting,
  onSend,
  onDiscard,
}) => {
  const hasText = transcript.trim().length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="absolute bottom-[72px] right-0 w-[280px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden"
      >
        <div className="px-4 pt-3 pb-2">
          {isRecording && (
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {isConnecting ? 'Connecting...' : 'Listening...'}
              </span>
            </div>
          )}

          <div className="min-h-[32px] max-h-[120px] overflow-y-auto">
            {hasText ? (
              <p className="text-[13px] text-gray-800 leading-relaxed">{transcript}</p>
            ) : isRecording ? (
              <p className="text-[13px] text-gray-400 italic">Speak now...</p>
            ) : (
              <p className="text-[11px] text-gray-400 text-center py-1">No speech detected</p>
            )}
          </div>
        </div>

        {!isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50"
          >
            {hasText ? (
              <>
                <button
                  onClick={onSend}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-black transition-colors"
                >
                  <Send size={12} />
                  Send
                </button>
                <button
                  onClick={onDiscard}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  <X size={12} />
                  Discard
                </button>
              </>
            ) : (
              <button
                onClick={onDiscard}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                Dismiss
              </button>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default VoiceTranscriptCard;
