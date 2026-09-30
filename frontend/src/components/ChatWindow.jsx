import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Sparkles, RotateCcw } from 'lucide-react';
import RenderDataCard from './DataCards';
import api from '../services/api';

export default function ChatWindow({
  initialMessages,
  onSendMessage,
  currentLocation = { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  selectedLanguage = 'en',
  sessionId = 'sess_default_test',
  enableStreaming = false,
  className = '',
}) {
  const [messages, setMessages] = useState(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    return [
      {
        id: 'welcome-default',
        role: 'assistant',
        content: 'Namaskaram! I am your MoES & IMD WeatherGPT Assistant. Ask me about live weather, forecasts, or alerts.',
        timestamp: '10:00 AM',
        data_cards: [],
      },
    ];
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    setErrorMessage(null);
    setInputValue('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = 'user_' + Date.now();

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
      let response;
      if (onSendMessage) {
        response = await onSendMessage(query);
      } else {
        response = await api.sendChat({
          sessionId,
          message: query,
          language: selectedLanguage,
          lat: currentLocation.lat,
          lon: currentLocation.lon,
        });
      }

      // Sanitize: verify no sensitive secrets or keys are rendered in the message
      let answerText = response?.answer || 'Weather data retrieved successfully.';
      if (typeof answerText === 'string') {
        answerText = answerText
          .replace(/AIzaSy[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]')
          .replace(/mongodb\+srv:\/\/[^\s]+/g, '[REDACTED_DB_URI]');
      }

      const rawCards = response?.data_cards || [];
      const normalizedCards = rawCards.map((c) => ({
        ...c,
        card_type: c.card_type || c.type,
      }));

      const botMsgId = 'bot_' + Date.now();
      const newAssistantMsg = {
        id: botMsgId,
        role: 'assistant',
        content: answerText,
        timestamp: timeStr,
        data_cards: normalizedCards,
        follow_up_suggestions: response?.follow_up_suggestions || [],
      };

      setMessages((prev) => [...prev, newAssistantMsg]);
    } catch (err) {
      console.error('ChatWindow send error:', err);
      const safeErrMsg = 'Could not reach WeatherGPT engine. Please check connection or try again.';
      setErrorMessage(safeErrMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: safeErrMsg,
          timestamp: timeStr,
          data_cards: [],
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="chat-window"
      className={`flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">
            WeatherGPT Assistant
          </span>
          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 uppercase font-mono">
            {currentLocation.name}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {selectedLanguage}
        </span>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="chat-error-banner"
          className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[10px] uppercase underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        data-testid="messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[250px]"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              data-testid="chat-message"
              data-role={msg.role}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                data-testid="message-content"
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-tl-none'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>

                {/* Structured Weather Data Cards */}
                {msg.data_cards && msg.data_cards.length > 0 && (
                  <div data-testid="data-cards-container" className="mt-3 space-y-2">
                    {msg.data_cards.map((card, idx) => (
                      <RenderDataCard key={idx} card={card} />
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {isLoading && (
          <div
            data-testid="loading-indicator"
            className="flex items-center space-x-2 text-sky-400 text-xs py-2 px-3 bg-slate-800/40 border border-slate-800 rounded-xl w-fit animate-pulse"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Consulting MoES & IMD meteorological models...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-slate-800/90 border-t border-slate-700/60 flex items-center space-x-2"
      >
        <input
          type="text"
          data-testid="chat-input"
          aria-label="Chat input"
          placeholder="Ask about temperature, rain, forecast, or advisories..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="send-button"
          aria-label="Send message"
          disabled={!inputValue.trim() || isLoading}
          className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-40 disabled:hover:bg-sky-500 transition shadow-md flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
