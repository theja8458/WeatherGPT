// Voice interaction utility supporting Web Speech API (STT & TTS)
// with Indian language locale mapping and graceful browser fallbacks.

export const LANGUAGE_LOCALE_MAP = {
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  or: 'or-IN',
  en: 'en-IN',
};

// Check browser STT support
export const isSpeechRecognitionSupported = () => {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
};

// Check browser TTS support
export const isSpeechSynthesisSupported = () => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
};

// Create and configure a SpeechRecognition instance
export const createSpeechRecognizer = ({
  language = 'en',
  onInterim,
  onResult,
  onError,
  onEnd,
}) => {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError(new Error('Web Speech API is not supported in this browser. Please use Chrome or Edge.'));
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = LANGUAGE_LOCALE_MAP[language] || 'en-IN';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcriptPiece;
      } else {
        interim += transcriptPiece;
      }
    }

    if (interim && onInterim) onInterim(interim);
    if (final && onResult) onResult(final);
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (onError) onError(event);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
};

// Clean markdown and symbols from response text before speaking
export const cleanTextForSpeech = (rawText) => {
  if (!rawText) return '';
  return rawText
    .replace(/[*#_`~>\[\]\(\)]/g, '') // Remove markdown symbols
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/\s+/g, ' ')
    .trim();
};

// Speak text using SpeechSynthesis
export const speakText = (text, language = 'en', onEndCallback = null) => {
  if (!isSpeechSynthesisSupported()) {
    console.warn('SpeechSynthesis not supported on this browser.');
    return null;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return null;

  const utterance = new SpeechSynthesisUtterance(cleaned);
  const targetLocale = LANGUAGE_LOCALE_MAP[language] || 'en-IN';
  utterance.lang = targetLocale;
  utterance.rate = 0.95; // Slightly slower, clear cadence for accessibility
  utterance.pitch = 1.0;

  // Attempt to select an exact voice if available
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    const matchingVoice = voices.find(
      (v) => v.lang === targetLocale || v.lang.startsWith(language)
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
  }

  if (onEndCallback) {
    utterance.onend = onEndCallback;
    utterance.onerror = onEndCallback;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
};

// Stop speech synthesis
export const stopSpeaking = () => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
};
