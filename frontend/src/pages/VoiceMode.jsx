import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
  CloudRain,
  Sun,
  CloudLightning,
  Cloud,
  RotateCcw,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWeather } from '../context/WeatherContext';
import { useVoice } from '../hooks/useVoice';
import api from '../services/api';

export default function VoiceMode() {
  const { t } = useTranslation();
  const { currentLocation, selectedLanguage } = useWeather();
  const {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice();

  // State: 'idle' | 'listening' | 'processing' | 'answering'
  const [voiceState, setVoiceState] = useState('idle');
  const [latestAnswer, setLatestAnswer] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [weatherSnippet, setWeatherSnippet] = useState(null);

  // Load basic weather for visual grounding
  useEffect(() => {
    api.getCurrentWeather({
      lat: currentLocation.lat,
      lon: currentLocation.lon,
      place: currentLocation.name,
    })
      .then((data) => setWeatherSnippet(data))
      .catch(() => {});
  }, [currentLocation]);

  // Handle Voice Input Toggle
  const handleMicClick = () => {
    if (voiceState === 'listening') {
      stopListening();
      setVoiceState('idle');
    } else {
      stopSpeaking();
      setVoiceState('listening');
      startListening(async (finalTranscript) => {
        if (!finalTranscript || !finalTranscript.trim()) {
          setVoiceState('idle');
          return;
        }

        setCurrentQuery(finalTranscript);
        setVoiceState('processing');

        try {
          const res = await api.sendChat({
            sessionId: 'voice_session_' + Date.now(),
            message: finalTranscript,
            language: selectedLanguage,
            lat: currentLocation.lat,
            lon: currentLocation.lon,
          });

          setLatestAnswer(res.answer);
          setVoiceState('answering');

          // Automatically speak the response aloud
          speak(res.answer, () => {
            setVoiceState('idle');
          });
        } catch (err) {
          console.error('Voice chat error:', err);
          const fallbackError =
            selectedLanguage === 'te'
              ? 'వాతావరణ సమాచారం పొందడంలో లోపం ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
              : selectedLanguage === 'hi'
              ? 'मौसम की जानकारी प्राप्त करने में असमर्थ। कृपया पुनः प्रयास करें।'
              : 'Could not connect to weather service. Please try again.';
          setLatestAnswer(fallbackError);
          setVoiceState('idle');
          speak(fallbackError);
        }
      });
    }
  };

  // State Labels in Native Languages
  const getStatusText = () => {
    if (voiceState === 'listening') {
      if (selectedLanguage === 'te') return 'వింటున్నాను... మాట్లాడండి';
      if (selectedLanguage === 'hi') return 'सुन रहा हूँ... बोलिए';
      return 'Listening... Speak now';
    }
    if (voiceState === 'processing') {
      if (selectedLanguage === 'te') return 'IMD సమాచారం విశ్లేషిస్తున్నాను...';
      if (selectedLanguage === 'hi') return 'मौसम डेटा का विश्लेषण हो रहा है...';
      return 'Analyzing live IMD weather...';
    }
    if (voiceState === 'answering') {
      if (selectedLanguage === 'te') return 'సమాధానం చెబుతున్నాను...';
      if (selectedLanguage === 'hi') return 'उत्तर बता रहा हूँ...';
      return 'Speaking answer...';
    }
    if (selectedLanguage === 'te') return 'మాట్లాడటానికి మైక్ నొక్కండి';
    if (selectedLanguage === 'hi') return 'बोलने के लिए माइक दबाएं';
    return 'Tap microphone to speak';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] justify-between items-center px-4 py-2 max-w-md mx-auto text-center select-none">
      {/* Top Header & Back to Chat */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800/80">
        <Link
          to="/chat"
          className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 font-semibold p-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('chat', 'Chat')}</span>
        </Link>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
          <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span className="font-bold text-white tracking-wide">VOICE MODE</span>
        </div>

        <span className="text-[11px] font-bold text-slate-400 bg-slate-800/60 px-2 py-1 rounded-lg">
          {currentLocation.name}
        </span>
      </div>

      {/* Visual Weather Card (Large Icon & Temp for Low-Literacy Users) */}
      <div className="my-auto flex flex-col items-center">
        <div className="p-4 rounded-3xl bg-gradient-to-b from-sky-500/10 to-transparent border border-sky-500/20 shadow-xl mb-3">
          {weatherSnippet && (
            <div className="flex items-center space-x-4">
              {weatherSnippet.rain > 0 ? (
                <CloudRain className="w-16 h-16 text-sky-400 animate-bounce" />
              ) : weatherSnippet.weather_code >= 95 ? (
                <CloudLightning className="w-16 h-16 text-amber-300 animate-pulse" />
              ) : weatherSnippet.weather_code <= 2 ? (
                <Sun className="w-16 h-16 text-amber-400 animate-spin-slow" />
              ) : (
                <Cloud className="w-16 h-16 text-slate-300" />
              )}
              <div className="text-left">
                <div className="text-4xl font-black text-white">
                  {Math.round(weatherSnippet.temperature)}°C
                </div>
                <p className="text-xs text-slate-300 font-medium capitalize">
                  {weatherSnippet.weather_description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Live Speech Transcript / Status Text */}
        <div className="min-h-[56px] flex flex-col items-center justify-center max-w-xs">
          <p className="text-sm font-bold text-sky-300 tracking-wide transition-all">
            {getStatusText()}
          </p>
          {(transcript || currentQuery) && voiceState !== 'idle' && (
            <p className="text-xs text-white bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl mt-2 italic shadow">
              "{transcript || currentQuery}"
            </p>
          )}
        </div>
      </div>

      {/* Giant Animated Microphone Button */}
      <div className="relative my-auto flex items-center justify-center">
        {/* Pulsing Ripple Rings */}
        {voiceState === 'listening' && (
          <>
            <div className="absolute w-44 h-44 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
            <div className="absolute w-56 h-56 rounded-full bg-rose-500/10 animate-pulse pointer-events-none" />
          </>
        )}
        {voiceState === 'answering' && (
          <div className="absolute w-48 h-48 rounded-full bg-sky-500/20 animate-pulse pointer-events-none" />
        )}
        {voiceState === 'processing' && (
          <div className="absolute w-44 h-44 rounded-full border-2 border-indigo-500/40 animate-spin pointer-events-none" />
        )}

        <button
          onClick={handleMicClick}
          aria-label="Toggle voice input"
          className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
            voiceState === 'listening'
              ? 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-500/50 scale-105'
              : voiceState === 'answering'
              ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-sky-500/40'
              : voiceState === 'processing'
              ? 'bg-gradient-to-tr from-purple-600 to-indigo-700 shadow-purple-500/40 animate-pulse'
              : 'bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-sky-500/30'
          }`}
        >
          {voiceState === 'answering' ? (
            <Volume2 className="w-12 h-12 text-white animate-pulse" />
          ) : voiceState === 'processing' ? (
            <Sparkles className="w-12 h-12 text-white animate-spin" />
          ) : (
            <Mic className={`w-12 h-12 text-white ${voiceState === 'listening' ? 'animate-bounce' : ''}`} />
          )}
        </button>
      </div>

      {/* Answer Area & Replay Voice Controls */}
      <div className="w-full mt-auto">
        {latestAnswer && (
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 text-left relative shadow-lg">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                WeatherGPT Spoken Response
              </span>
              <button
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeaking();
                    setVoiceState('idle');
                  } else {
                    setVoiceState('answering');
                    speak(latestAnswer, () => setVoiceState('idle'));
                  }
                }}
                className="flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition"
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isSpeaking ? 'Stop' : 'Replay'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-100 leading-relaxed font-sans max-h-24 overflow-y-auto scrollbar-none">
              {latestAnswer}
            </p>
          </div>
        )}

        {voiceError && (
          <div className="mt-2 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs">
            {voiceError}
          </div>
        )}
      </div>
    </div>
  );
}
