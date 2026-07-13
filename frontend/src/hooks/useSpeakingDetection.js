import { useRef, useState, useCallback } from "react";

/**
 * Monitors any number of MediaStreams (keyed by an id you choose, e.g.
 * "self" or a peer's socketId) and reports whether each one is
 * currently producing audio above `threshold`.
 *
 * Usage:
 *   const { speakingMap, startMonitor, stopMonitor, stopAll } = useSpeakingDetection();
 *   startMonitor("self", localStream);
 *   startMonitor(socketId, remoteStream);
 *   // speakingMap.self / speakingMap[socketId] -> true while talking
 *   stopMonitor(socketId);  // when a peer leaves
 *   stopAll();              // when you leave the call
 */
export function useSpeakingDetection(threshold = 18) {
  const [speakingMap, setSpeakingMap] = useState({});
  const speakingRef = useRef({});   // avoids redundant re-renders
  const monitorsRef = useRef({});   // id -> { stop() }

  const startMonitor = useCallback((id, stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    if (monitorsRef.current[id]) return; // already watching this id

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85; // smooths flicker
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frameId = null;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const isSpeaking = avg > threshold;

      if (speakingRef.current[id] !== isSpeaking) {
        speakingRef.current[id] = isSpeaking;
        setSpeakingMap((prev) => ({ ...prev, [id]: isSpeaking }));
      }
      frameId = requestAnimationFrame(tick);
    };
    tick();

    monitorsRef.current[id] = {
      stop: () => {
        if (frameId) cancelAnimationFrame(frameId);
        try { source.disconnect(); } catch { /* noop */ }
        try { audioContext.close(); } catch { /* noop */ }
      }
    };
  }, [threshold]);

  const stopMonitor = useCallback((id) => {
    if (monitorsRef.current[id]) {
      monitorsRef.current[id].stop();
      delete monitorsRef.current[id];
    }
    delete speakingRef.current[id];
    setSpeakingMap((prev) => {
      if (!(id in prev)) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const stopAll = useCallback(() => {
    Object.values(monitorsRef.current).forEach((m) => m.stop());
    monitorsRef.current = {};
    speakingRef.current = {};
    setSpeakingMap({});
  }, []);

  return { speakingMap, startMonitor, stopMonitor, stopAll };
}