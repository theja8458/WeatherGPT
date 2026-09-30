import React, { useState, useEffect } from 'react';
import {
  CloudLightning,
  MapPin,
  Globe,
  Sun,
  Moon,
  Search,
  Check,
  X,
  Mic,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { supportedLanguages } from '../i18n';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function Header() {
  const { t } = useTranslation();
  const {
    currentLocation,
    setCurrentLocation,
    backendStatus,
    selectedLanguage,
    setSelectedLanguage,
    userRole,
    setUserRole,
    SUPPORTED_ROLES,
    setShowOnboarding,
  } = useWeather();

  const [isDark, setIsDark] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const currentRole = (SUPPORTED_ROLES || []).find((r) => r.id === userRole) || {
    id: userRole,
    name: userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Citizen',
    icon: '🏙️',
  };

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('weathergpt_theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      setIsDark(false);
      localStorage.setItem('weathergpt_theme', 'light');
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      localStorage.setItem('weathergpt_theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  };

  // Autocomplete location search
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        api.searchLocations(searchQuery)
          .then((res) => {
            setSearchResults(res.results || []);
          })
          .catch(() => setSearchResults([]))
          .finally(() => setIsSearching(false));
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  const selectLocation = (loc) => {
    setCurrentLocation({
      name: loc.name,
      state: loc.state,
      lat: loc.lat,
      lon: loc.lon,
    });
    setShowLocationModal(false);
    setSearchQuery('');
  };

  const selectLang = (code) => {
    setSelectedLanguage(code);
    localStorage.setItem('weathergpt_lang', code);
    setShowLangModal(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-3 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Logo & MoES Title */}
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent">
                  WeatherGPT
                </span>
                <span
                  title={`Backend: ${backendStatus.status}`}
                  className={`w-2 h-2 rounded-full ${
                    backendStatus.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
                  }`}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">
                {t('brand_sub')}
              </p>
            </div>
          </div>

          {/* Action Chips: Role, Location, Language, Theme */}
          <div className="flex items-center space-x-1.5">
            {/* Role Chip */}
            <button
              onClick={() => setShowRoleModal(true)}
              aria-label="Change user role"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-xs text-slate-200 transition"
              title={`Active Persona: ${currentRole.name}`}
            >
              <span className="text-xs">{currentRole.icon}</span>
              <span className="text-[11px] font-medium hidden sm:inline">{currentRole.name}</span>
            </button>

            {/* Location Chip */}
            <button
              onClick={() => setShowLocationModal(true)}
              aria-label="Change location"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-xs text-slate-200 transition"
            >
              <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span className="max-w-[70px] truncate text-[11px] font-medium">{currentLocation.name}</span>
            </button>

            {/* Language Selector */}
            <button
              onClick={() => setShowLangModal(true)}
              aria-label="Select language"
              className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 transition text-[11px] font-bold uppercase flex items-center justify-center min-w-[28px]"
            >
              <span className="text-[10px] text-sky-300">{selectedLanguage}</span>
            </button>

            {/* Quick Voice Mode Button */}
            <Link
              to="/voice"
              aria-label="Open Voice Mode"
              className="p-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 hover:text-rose-300 transition flex items-center justify-center"
              title="Voice Mode (Rural & Voice Assistant)"
            >
              <Mic className="w-3.5 h-3.5" />
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle light and dark theme"
              className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 transition"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-indigo-300" />}
            </button>
          </div>
        </div>
      </header>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>{t('select_city')}</span>
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={t('search_city_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-800/90 text-sm text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2.5 border border-slate-700 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Results List */}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {isSearching ? (
                <p className="text-xs text-slate-400 text-center py-4">Searching locations...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => selectLocation(loc)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/80 flex items-center justify-between transition"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{loc.name}</p>
                      <p className="text-[10px] text-slate-400">{loc.district ? `${loc.district}, ` : ''}{loc.state}</p>
                    </div>
                    {loc.aliases && loc.aliases.length > 0 && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                        {loc.aliases[0]}
                      </span>
                    )}
                  </button>
                ))
              ) : searchQuery.length >= 2 ? (
                <p className="text-xs text-slate-400 text-center py-4">No places found.</p>
              ) : (
                <div className="space-y-1 py-1">
                  <p className="text-[10px] uppercase font-semibold text-slate-400 px-2">{t('popular_cities')}</p>
                  {[
                    { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 },
                    { name: 'Kurnool', state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
                    { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
                    { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
                    { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
                    { name: 'Delhi', state: 'Delhi', lat: 28.6139, lon: 77.209 },
                  ].map((pop, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectLocation(pop)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs text-slate-200"
                    >
                      <span>{pop.name}, <span className="text-slate-400">{pop.state}</span></span>
                      {currentLocation.name === pop.name && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>{t('select_language')}</span>
              </h3>
              <button
                onClick={() => setShowLangModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {supportedLanguages.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => selectLang(lang.code)}
                    className={`text-left p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{lang.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Switch User Persona</span>
                </h3>
                <p className="text-[11px] text-slate-400">Personalises dashboard & AI responses</p>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(SUPPORTED_ROLES || []).map((r) => {
                const isSelected = userRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setUserRole(r.id);
                      setShowRoleModal(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xl">{r.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{r.name}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{r.desc}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Replay Onboarding Link */}
            <div className="pt-2 border-t border-slate-800/80 flex justify-center">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setShowOnboarding(true);
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium transition"
              >
                Launch Setup Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
