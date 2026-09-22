import { useCallback, useEffect, useRef, useState } from "react";

/** Web Speech API 语音输入 — 中文/英文识别，实时回写 */
export function useVoiceInput(onTranscript: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const accRef = useRef(""); // accumulated confirmed text

  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const start = useCallback(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    accRef.current = "";
    const rec = new (SR as new () => SpeechRecognition)();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!;
        if (result.isFinal) {
          accRef.current += result[0]!.transcript;
        } else {
          interim = result[0]!.transcript;
        }
      }
      onTranscript(accRef.current + interim, false);
    };

    rec.onspeechend = () => {
      rec.stop();
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      if (accRef.current) onTranscript(accRef.current, true);
    };

    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
