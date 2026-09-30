import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  RotateCcw,
  CloudLightning,
  AlertCircle,
  Volume2,
  VolumeX,
  Radio,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWeather } from '../context/WeatherContext';
import { useVoice } from '../hooks/useVoice';
import RenderDataCard from '../components/DataCards';
import api from '../services/api';

export default function Chat() {
  const { t } = useTranslation();
  const { currentLocation, selectedLanguage } = useWeather();
  const {
    isSupported: isVoiceSupported,
    isListening,
    isSpeaking,
    transcript,
    error: voiceError,
    autoRead,
    toggleAutoRead,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice();

  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState(null);

  // Session ID from localStorage
  const [sessionId] = useState(() => {
    let sid = localStorage.getItem('weathergpt_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('weathergpt_session_id', sid);
    }
    return sid;
  });

  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: t('welcome_msg', 'Namaskaram! I am your MoES & IMD WeatherGPT Assistant. Ask me about live weather, 7-day forecasts, farming advisories, or warnings in English, Telugu, Hindi, and 8+ Indian languages.'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      data_cards: [],
      follow_ups: [
        `Weather in ${currentLocation.name}`,
        'Will it rain tomorrow?',
        'Any active weather alerts?',
        'Farming & spraying advice',
      ],
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [errorState, setErrorState] = useState(null);
  const [isListeningMic, setIsListeningMic] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Quick Action Chips
  const quickChips = [
    t('chip_today', `Weather in ${currentLocation.name}`),
    t('chip_tomorrow', 'Will it rain tomorrow?'),
    t('chip_alerts', 'Any active alerts?'),
    t('chip_farming', 'Farming advice'),
  ];

  // Handle Feedback
  const handleFeedback = async (messageId, rating) => {
    if (feedbackMap[messageId]) return; // Already rated
    setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }));
    try {
      await api.sendFeedback({
        messageId,
        rating,
        sessionId,
      });
    } catch (e) {
      console.error('Feedback failed:', e);
    }
  };

  // Streaming text simulation helper
  const streamRevealBotMessage = (fullMessage, msgId, cards, followUps) => {
    const words = fullMessage.split(' ');
    let currentWordIndex = 0;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Insert empty message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: 'assistant',
        content: '',
        timestamp: timeStr,
        data_cards: cards,
        follow_ups: followUps,
        isStreaming: true,
      },
    ]);

    const interval = setInterval(() => {
      currentWordIndex += 3;
      const partialText = words.slice(0, currentWordIndex).join(' ');

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId
            ? { ...msg, content: partialText, isStreaming: currentWordIndex < words.length }
            : msg
        )
      );

      if (currentWordIndex >= words.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === msgId ? { ...msg, content: fullMessage, isStreaming: false } : msg
          )
        );
      }
    }, 25);
  };

  // Submit User Message
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    setErrorState(null);
    setInputValue('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = 'user_' + Date.now();

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: timeStr,
      },
    ]);

    setIsLoading(true);

    try {
      const response = await api.sendChat({
        sessionId,
        message: query,
        language: selectedLanguage,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
      });

      const botMsgId = 'bot_' + Date.now();
      streamRevealBotMessage(
        response.answer,
        botMsgId,
        response.data_cards || [],
        response.follow_up_suggestions || []
      );

      // Auto-read response if enabled
      if (autoRead && response.answer) {
        speak(response.answer);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setErrorState('Could not reach WeatherGPT engine. Please check connection or try again.');
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'I apologize, but I could not reach the IMD meteorological service. Please retry in a moment.',
          timestamp: timeStr,
          data_cards: [],
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const routerLocation = useLocation();
  useEffect(() => {
    if (routerLocation.state?.initialMessage) {
      const msg = routerLocation.state.initialMessage;
      // Clear state so it doesn't trigger on re-render
      window.history.replaceState({}, document.title);
      handleSendMessage(msg);
    } else if (routerLocation.state?.prefillMessage) {
      setInputValue(routerLocation.state.prefillMessage);
    }
  }, [routerLocation.state]);

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] max-w-md mx-auto relative">
      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto px-1 py-3 space-y-3.5 scrollbar-thin">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const feedback = feedbackMap[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              {/* Message Bubble Container */}
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-bl-none'
                }`}
              >
                {/* Assistant Badge */}
                {!isUser && (
                  <div className="flex items-center space-x-1.5 mb-1.5 text-sky-400">
                    <CloudLightning className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">WeatherGPT</span>
                  </div>
                )}

                {/* Message Content */}
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* Attached Data Cards */}
                {!isUser && msg.data_cards && msg.data_cards.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.data_cards.map((card, idx) => (
                      <RenderDataCard key={idx} card={card} />
                    ))}
                  </div>
                )}

                {/* Timestamp & Controls Footer */}
                <div
                  className={`mt-2 flex items-center justify-between text-[10px] ${
                    isUser ? 'text-sky-200' : 'text-slate-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {/* Feedback and Speaker Buttons for Bot Messages */}
                  {!isUser && !msg.isStreaming && (
                    <div className="flex items-center space-x-1.5 ml-4">
                      {/* Speaker Read Aloud Button */}
                      <button
                        onClick={() => {
                          if (activeSpeakingMsgId === msg.id) {
                            stopSpeaking();
                            setActiveSpeakingMsgId(null);
                          } else {
                            setActiveSpeakingMsgId(msg.id);
                            speak(msg.content, () => setActiveSpeakingMsgId(null));
                          }
                        }}
                        aria-label="Read answer aloud"
                        title={activeSpeakingMsgId === msg.id ? 'Stop speaking' : 'Read aloud'}
                        className={`p-1 rounded-md transition ${
                          activeSpeakingMsgId === msg.id
                            ? 'text-sky-300 bg-sky-500/30 animate-pulse'
                            : 'hover:text-sky-400 hover:bg-slate-700/60 text-slate-400'
                        }`}
                      >
                        {activeSpeakingMsgId === msg.id ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Volume2 className="w-3 h-3" />
                        )}
                      </button>

                      <button
                        onClick={() => handleFeedback(msg.id, 5)}
                        aria-label="Thumbs up"
                        className={`p-1 rounded-md transition ${
                          feedback === 5
                            ? 'text-emerald-400 bg-emerald-500/20'
                            : 'hover:text-emerald-400 hover:bg-slate-700/60'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 1)}
                        aria-label="Thumbs down"
                        className={`p-1 rounded-md transition ${
                          feedback === 1
                            ? 'text-rose-400 bg-rose-500/20'
                            : 'hover:text-rose-400 hover:bg-slate-700/60'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Follow-Up Suggestions */}
              {!isUser && msg.follow_ups && msg.follow_ups.length > 0 && !msg.isStreaming && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                  {msg.follow_ups.slice(0, 3).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-slate-700 transition flex items-center space-x-1"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Skeleton / Typing Indicator */}
        {isLoading && (
          <div className="flex items-start space-x-2 animate-in fade-in duration-200">
            <div className="max-w-[80%] rounded-2xl rounded-bl-none p-3.5 bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span className="text-xs text-slate-300">{t('checking_sensors')}</span>
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Error notification banner */}
        {errorState && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorState}</span>
            </div>
            <button
              onClick={() => handleSendMessage()}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('retry', 'Retry')}</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick-Action Chips & Voice Toolbar */}
      <div className="px-1.5 py-1.5 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center space-x-1.5 border-t border-slate-800/60 bg-slate-900/60">
        {/* Voice Mode Direct Link */}
        <Link
          to="/voice"
          className="flex-shrink-0 flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-400 font-semibold transition shadow-sm"
        >
          <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
          <span>Voice Mode</span>
        </Link>

        {/* Auto-Read Replies Toggle Button */}
        <button
          onClick={toggleAutoRead}
          className={`flex-shrink-0 flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-full border transition font-medium ${
            autoRead
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
              : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
          }`}
          title="Toggle automatic speech reading of bot answers"
        >
          <Volume2 className="w-3 h-3" />
          <span>{autoRead ? 'Auto-Voice: ON' : 'Auto-Voice: OFF'}</span>
        </button>

        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(chip)}
            className="flex-shrink-0 text-[11px] px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Live Speech Recognition Overlay */}
      {isListening && (
        <div className="mx-2 mb-1.5 p-2 rounded-xl bg-gradient-to-r from-rose-950/90 to-slate-900 border border-rose-500/50 flex items-center justify-between text-xs animate-pulse shadow-lg">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
            <span className="font-bold text-rose-400 flex-shrink-0">Listening:</span>
            <span className="text-white italic truncate">{transcript || 'Speak in your selected language...'}</span>
          </div>
          <button
            onClick={stopListening}
            className="text-[10px] bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 px-2 py-0.5 rounded font-semibold ml-2 flex-shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* Voice error notice */}
      {voiceError && (
        <div className="mx-2 mb-1 p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px]">
          {voiceError}
        </div>
      )}

      {/* Input Bar */}
      <div className="p-2 bg-slate-900/90 border-t border-slate-800/80">
        <div className="flex items-center space-x-1.5 bg-slate-800/90 rounded-2xl border border-slate-700/80 p-1.5 shadow-inner">
          {/* Microphone button (Web Speech API STT) */}
          <button
            onClick={() => {
              if (isListening) {
                stopListening();
              } else {
                startListening((finalTranscript) => {
                  if (finalTranscript && finalTranscript.trim()) {
                    handleSendMessage(finalTranscript);
                  }
                });
              }
            }}
            aria-label="Voice input"
            className={`p-2.5 rounded-xl transition ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Speech to text (Tap and speak)"
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-bounce' : ''}`} />
          </button>

          {/* Text Input Field */}
          <input
            ref={inputRef}
            type="text"
            placeholder={t('placeholder', { location: currentLocation.name })}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none px-2 py-1.5 font-sans"
          />

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
            className={`p-2.5 rounded-xl transition shadow-md ${
              inputValue.trim() && !isLoading
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:opacity-95'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
