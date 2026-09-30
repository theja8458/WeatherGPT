import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createSpeechRecognizer,
  speakText,
  stopSpeaking as cancelSpeech,
} from '../services/voiceService';
import { useWeather } from '../context/WeatherContext';

export function useVoice() {
  const { selectedLanguage } = useWeather();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  // Auto-read bot answers setting (persisted in localStorage)
  const [autoRead, setAutoRead] = useState(() => {
    return localStorage.getItem('weathergpt_autoread') === 'true';
  });

  const recognitionRef = useRef(null);
  const isRecognitionActiveRef = useRef(false);

  const toggleAutoRead = useCallback(() => {
    setAutoRead((prev) => {
      const next = !prev;
      localStorage.setItem('weathergpt_autoread', String(next));
      if (!next) cancelSpeech();
      return next;
    });
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
    isRecognitionActiveRef.current = false;
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (onFinalResult) => {
      setError(null);
      setTranscript('');

      // If currently speaking, stop first
      cancelSpeech();
      setIsSpeaking(false);

      if (!isSpeechRecognitionSupported()) {
        setError('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      // Stop any existing session
      stopListening();

      const recognizer = createSpeechRecognizer({
        language: selectedLanguage,
        onInterim: (text) => {
          setTranscript(text);
        },
        onResult: (finalText) => {
          setTranscript(finalText);
          setIsListening(false);
          isRecognitionActiveRef.current = false;
          if (onFinalResult) {
            onFinalResult(finalText);
          }
        },
        onError: (err) => {
          console.warn('Voice recognition error:', err);
          setError(err.error === 'not-allowed' ? 'Microphone permission denied.' : 'Speech recognition error.');
          setIsListening(false);
          isRecognitionActiveRef.current = false;
        },
        onEnd: () => {
          setIsListening(false);
          isRecognitionActiveRef.current = false;
        },
      });

      if (recognizer) {
        recognitionRef.current = recognizer;
        try {
          recognizer.start();
          isRecognitionActiveRef.current = true;
          setIsListening(true);
        } catch (e) {
          console.error('Failed to start speech recognition:', e);
          setIsListening(false);
          isRecognitionActiveRef.current = false;
        }
      }
    },
    [selectedLanguage, stopListening]
  );

  const speak = useCallback(
    (text, onEnd) => {
      if (!isSpeechSynthesisSupported() || !text) return;
      setIsSpeaking(true);
      speakText(text, selectedLanguage, () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      });
    },
    [selectedLanguage]
  );

  const stopSpeaking = useCallback(() => {
    cancelSpeech();
    setIsSpeaking(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
      cancelSpeech();
    };
  }, [stopListening]);

  return {
    isSupported: isSpeechRecognitionSupported(),
    isTTSSupported: isSpeechSynthesisSupported(),
    isListening,
    isSpeaking,
    transcript,
    error,
    autoRead,
    toggleAutoRead,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
