import { useState, useRef, useCallback } from 'react';

interface UseVolumeMonitorReturn {
  volume: number;
  isMonitoring: boolean;
  startMonitoring: (externalStream?: MediaStream) => Promise<void>;
  stopMonitoring: () => void;
}

export function useVolumeMonitor(): UseVolumeMonitorReturn {
  const [volume, setVolume] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownStreamRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const poll = useCallback(() => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray) return;

    analyser.getByteTimeDomainData(dataArray);

    // Compute RMS for more responsive volume
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    // Apply power curve to amplify speech-level signals (0.05-0.3 range -> 0.2-0.8)
    const amplified = Math.min(1, Math.pow(rms * 3, 0.6));

    setVolume(amplified);

    rafRef.current = requestAnimationFrame(poll);
  }, []);

  const startMonitoring = useCallback(async (externalStream?: MediaStream) => {
    try {
      let stream: MediaStream;
      if (externalStream) {
        stream = externalStream;
        ownStreamRef.current = false;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        ownStreamRef.current = true;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      dataArrayRef.current = new Uint8Array(analyser.fftSize);

      setIsMonitoring(true);
      rafRef.current = requestAnimationFrame(poll);
    } catch {
      setIsMonitoring(false);
    }
  }, [poll]);

  const stopMonitoring = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (ownStreamRef.current && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownStreamRef.current = false;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    setVolume(0);
    setIsMonitoring(false);
  }, []);

  return { volume, isMonitoring, startMonitoring, stopMonitoring };
}
