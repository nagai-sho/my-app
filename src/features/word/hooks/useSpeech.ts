import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SpeechLanguage } from '../types';

export function useSpeech() {
  const [language, setLanguage] = useState<SpeechLanguage>('ja-JP');
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim() || !supported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [language, supported],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return useMemo(
    () => ({ language, setLanguage, speak, speaking, stop, supported }),
    [language, speak, speaking, stop, supported],
  );
}

