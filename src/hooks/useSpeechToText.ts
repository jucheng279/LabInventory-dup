import { useState, useCallback, useRef, useEffect } from 'react';
import { useScribe, AudioFormat } from '@elevenlabs/react';
import { fetchScribeToken, refillTokenCache } from '../services/sttTokenService';

export type SttStatus = 'idle' | 'connecting' | 'recording' | 'error';

interface UseSpeechToTextReturn {
  status: SttStatus;
  partialTranscript: string;
  committedText: string;
  error: string | null;
  startRecording: (existingStream?: MediaStream) => Promise<void>;
  stopRecording: () => void;
  clearText: () => void;
}

const MAX_RECORDING_MS = 60000;
const AUDIO_SAMPLE_RATE = 16000;

function float32ToBase64Pcm16(samples: Float32Array): string {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, buffer.length - 1);
    const frac = srcIndex - low;
    result[i] = buffer[low] + (buffer[high] - buffer[low]) * frac;
  }
  return result;
}

export function useSpeechToText(onTranscriptReady: (text: string) => void): UseSpeechToTextReturn {
  const [status, setStatus] = useState<SttStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [committedText, setCommittedText] = useState('');
  const committedRef = useRef('');
  const statusRef = useRef<SttStatus>('idle');
  const onTranscriptReadyRef = useRef(onTranscriptReady);
  onTranscriptReadyRef.current = onTranscriptReady;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(0);
  const connectedSessionRef = useRef(0);

  // Audio capture refs
  const audioBufferRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const capturingRef = useRef(false);
  const connectedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ownStreamRef = useRef(false);

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    audioFormat: AudioFormat.PCM_16000,
    sampleRate: AUDIO_SAMPLE_RATE,
    onConnect: () => {
      connectedSessionRef.current = sessionIdRef.current;
      connectedRef.current = true;
      statusRef.current = 'recording';
      setStatus('recording');
      setError(null);

      // Replay buffered audio
      const buffered = audioBufferRef.current;
      if (buffered.length > 0) {
        for (const chunk of buffered) {
          scribe.sendAudio(chunk, { sampleRate: AUDIO_SAMPLE_RATE });
        }
        audioBufferRef.current = [];
      }
    },
    onDisconnect: () => {
      connectedRef.current = false;
      if (connectedSessionRef.current !== sessionIdRef.current) return;
      if (statusRef.current === 'recording' || statusRef.current === 'connecting') {
        const finalText = committedRef.current.trim();
        if (finalText) {
          onTranscriptReadyRef.current(finalText);
        }
      }
      statusRef.current = 'idle';
      setStatus('idle');
    },
    onCommittedTranscript: (data) => {
      if (connectedSessionRef.current !== sessionIdRef.current) return;
      const newText = committedRef.current
        ? committedRef.current + ' ' + data.text
        : data.text;
      committedRef.current = newText;
      setCommittedText(newText);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Transcription error';
      setError(message);
      statusRef.current = 'error';
      setStatus('error');
    },
    onAuthError: () => {
      setError('Authentication failed for speech-to-text');
      statusRef.current = 'error';
      setStatus('error');
    },
    onQuotaExceededError: () => {
      setError('Speech-to-text quota exceeded');
      statusRef.current = 'error';
      setStatus('error');
    },
  });

  const stopCapture = useCallback(() => {
    capturingRef.current = false;
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (ownStreamRef.current && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownStreamRef.current = false;
  }, []);

  const startCapture = useCallback(async (existingStream?: MediaStream) => {
    audioBufferRef.current = [];
    capturingRef.current = true;

    let stream: MediaStream;
    if (existingStream) {
      stream = existingStream;
      ownStreamRef.current = false;
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      ownStreamRef.current = true;
    }
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;

    const nativeSampleRate = audioCtx.sampleRate;
    const bufferSize = 4096;
    const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!capturingRef.current) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const resampled = nativeSampleRate === AUDIO_SAMPLE_RATE
        ? inputData
        : downsample(inputData, nativeSampleRate, AUDIO_SAMPLE_RATE);
      const chunk = float32ToBase64Pcm16(resampled);
      if (connectedRef.current) {
        scribe.sendAudio(chunk, { sampleRate: AUDIO_SAMPLE_RATE });
      } else {
        audioBufferRef.current.push(chunk);
      }
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);
    (workletNodeRef as any).current = processor;
  }, [scribe]);

  const startRecording = useCallback(async (existingStream?: MediaStream) => {
    sessionIdRef.current++;
    setError(null);
    setCommittedText('');
    committedRef.current = '';
    scribe.clearTranscripts();
    connectedRef.current = false;
    statusRef.current = 'connecting';
    setStatus('connecting');

    try {
      // Start capturing audio immediately so no speech is lost
      await startCapture(existingStream);

      // Fetch token (usually pre-cached so near-instant)
      const token = await fetchScribeToken();

      // Refill cache for next time
      refillTokenCache();

      await scribe.connect({
        token,
        audioFormat: AudioFormat.PCM_16000,
        sampleRate: AUDIO_SAMPLE_RATE,
      });

      timeoutRef.current = setTimeout(() => {
        scribe.disconnect();
      }, MAX_RECORDING_MS);
    } catch (err) {
      stopCapture();
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      if (message.includes('NotAllowedError') || message.includes('Permission denied') || message.includes('not allowed')) {
        setError('Microphone access denied. Please allow microphone in your browser settings.');
      } else {
        setError(message);
      }
      statusRef.current = 'error';
      setStatus('error');
    }
  }, [scribe, startCapture, stopCapture]);

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopCapture();
    scribe.disconnect();
  }, [scribe, stopCapture]);

  const clearText = useCallback(() => {
    committedRef.current = '';
    setCommittedText('');
    scribe.clearTranscripts();
  }, [scribe]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopCapture();
      if (scribe.isConnected) {
        scribe.disconnect();
      }
    };
  }, []);

  return {
    status,
    partialTranscript: scribe.partialTranscript,
    committedText,
    error,
    startRecording,
    stopRecording,
    clearText,
  };
}
