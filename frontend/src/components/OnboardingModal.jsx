import React, { useState } from 'react';
import {
  Globe,
  UserCheck,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Navigation,
  Compass,
  Shield,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useWeather, SUPPORTED_ROLES, SUPPORTED_LANGUAGES } from '../context/WeatherContext';
import api from '../services/api';

const POPULAR_CITIES = [
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 },
  { name: 'Kurnool', state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
  { name: 'New Delhi', state: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lon: 72.8777 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
];

export default function OnboardingModal({ isOpen, onClose }) {
  const {
    selectedLanguage,
    userRole,
    currentLocation,
    completeOnboarding,
  } = useWeather();

  const [step, setStep] = useState(1);
  const [chosenLang, setChosenLang] = useState(selectedLanguage || 'en');
  const [chosenRole, setChosenRole] = useState(userRole || 'citizen');
  const [chosenLocation, setChosenLocation] = useState(currentLocation || POPULAR_CITIES[0]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null); // 'success', 'denied', or null
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!isOpen) return null;

  // Step 3: Location detection handler
  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setIsLocating(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await api.searchLocations(`${lat.toFixed(2)},${lon.toFixed(2)}`);
          if (res && res.results && res.results.length > 0) {
            const loc = res.results[0];
            setChosenLocation({ name: loc.name, state: loc.state, lat, lon });
          } else {
            setChosenLocation({ name: 'Current Location', state: 'India', lat, lon });
          }
          setLocationStatus('success');
        } catch {
          setChosenLocation({ name: 'Current Location', state: 'India', lat, lon });
          setLocationStatus('success');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.warn('Geolocation permission denied or timed out:', err);
        setIsLocating(false);
        setLocationStatus('denied');
      },
      { timeout: 7000 }
    );
  };

  // Search location handler
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchLocations(searchQuery.trim());
      if (res && res.results) {
        setSearchResults(res.results.slice(0, 4));
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Final submit handler
  const handleFinish = async () => {
    await completeOnboarding({
      language: chosenLang,
      role: chosenRole,
      location: chosenLocation,
    });
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-sky-950/30 to-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Welcome to WeatherGPT
                </h2>
                <p className="text-xs text-sky-300 font-medium">MoES & IMD Conversational Weather System</p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
              Step {step} of 3
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          {/* STEP 1: CHOOSE LANGUAGE */}
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right duration-200">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span>Choose Your Preferred Language</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select the language for forecasts, advisories, and AI chat responses.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = chosenLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setChosenLang(lang.code)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-white shadow-md shadow-sky-500/10'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold">{lang.native}</div>
                        <div className="text-xs text-slate-400">{lang.name}</div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE ROLE */}
          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right duration-200">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <span>Select Your Role</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tailors your weather dashboard, quick prompts, and domain advisories.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {SUPPORTED_ROLES.map((r) => {
                  const isSelected = chosenRole === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setChosenRole(r.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-500/10'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{r.icon}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white">{r.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono">
                            {r.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {r.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: ALLOW LOCATION */}
          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right duration-200">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span>Set Your Location</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allows hyper-local IMD forecasts and severe weather alerts for your district.
                </p>
              </div>

              {/* GPS Auto-Detect Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-800/50 border border-slate-700 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Navigation className={`w-6 h-6 ${isLocating ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Automatic GPS Location</h4>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
                    Allow browser location for instant weather wherever you are.
                  </p>
                </div>
                <button
                  onClick={handleAllowLocation}
                  disabled={isLocating}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 flex items-center space-x-2"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isLocating ? 'Detecting Location...' : 'Allow Location'}</span>
                </button>

                {/* Status indicators */}
                {locationStatus === 'success' && (
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Detected: {chosenLocation.name}, {chosenLocation.state}</span>
                  </div>
                )}
                {locationStatus === 'denied' && (
                  <div className="flex items-center space-x-1.5 text-xs text-amber-300">
                    <AlertCircle className="w-4 h-4" />
                    <span>Permission skipped. You can choose a default city below.</span>
                  </div>
                )}
              </div>

              {/* Popular City Chips Selection */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  Or select a common location:
                </span>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_CITIES.map((c) => {
                    const isSelected = chosenLocation.name === c.name;
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setChosenLocation(c);
                          setLocationStatus('success');
                        }}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-sm'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Currently Selected Summary */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Selected Home Location:</span>
                <span className="text-white font-medium flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>{chosenLocation.name}, {chosenLocation.state}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition"
            >
              <span>Get Started</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
