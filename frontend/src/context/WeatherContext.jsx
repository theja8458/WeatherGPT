import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const WeatherContext = createContext(null);

export const SUPPORTED_ROLES = [
  {
    id: 'farmer',
    name: 'Farmer',
    icon: '🌾',
    badge: 'Agriculture',
    desc: 'Crop-specific advisories, rain forecasts & spraying windows',
    color: 'emerald',
  },
  {
    id: 'citizen',
    name: 'Citizen',
    icon: '🏙️',
    badge: 'General Public',
    desc: 'Daily weather, air quality, rain alerts & outdoor safety',
    color: 'sky',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    icon: '📊',
    badge: 'Climate & Data',
    desc: '30-year climate trends, anomaly heatmaps & CSV export',
    color: 'indigo',
  },
  {
    id: 'aviation',
    name: 'Aviation',
    icon: '✈️',
    badge: 'Pilots & ATC',
    desc: 'METAR-style flight weather, cloud ceiling, wind & visibility',
    color: 'blue',
  },
  {
    id: 'marine',
    name: 'Marine',
    icon: '⚓',
    badge: 'Coastal & Fisheries',
    desc: 'Sea state, wave heights, wind knots & coastal advisories',
    color: 'teal',
  },
  {
    id: 'disaster_manager',
    name: 'Disaster Manager',
    icon: '🚨',
    badge: 'Emergency Ops',
    desc: 'Statewide alert lists, district risk matrix & multi-lingual broadcast warnings',
    color: 'rose',
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
];

export function WeatherProvider({ children }) {
  // Session ID for anonymous / persistent user profile
  const [sessionId] = useState(() => {
    let sid = localStorage.getItem('weathergpt_session_id');
    if (!sid) {
      sid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('weathergpt_session_id', sid);
    }
    return sid;
  });

  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('weathergpt_location');
      return saved ? JSON.parse(saved) : { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 };
    } catch {
      return { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 };
    }
  });

  const [selectedLanguage, setSelectedLanguageState] = useState(() => {
    return localStorage.getItem('weathergpt_lang') || 'en';
  });

  const [userRole, setUserRoleState] = useState(() => {
    return localStorage.getItem('weathergpt_role') || 'citizen';
  });

  // Check onboarding status
  const [isOnboarded, setIsOnboarded] = useState(() => {
    return localStorage.getItem('weathergpt_onboarded') === 'true';
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('weathergpt_onboarded') !== 'true';
  });

  const [backendStatus, setBackendStatus] = useState({ status: 'checking', connected: false });

  // Update language and load i18n
  const setSelectedLanguage = (code) => {
    setSelectedLanguageState(code);
    localStorage.setItem('weathergpt_lang', code);
    import('../i18n').then((m) => m.default.changeLanguage(code));
  };

  // Update role and persist to backend + localStorage
  const setUserRole = async (newRole) => {
    const roleId = newRole.toLowerCase();
    setUserRoleState(roleId);
    localStorage.setItem('weathergpt_role', roleId);

    try {
      await api.updateUserRole(sessionId, roleId);
    } catch (err) {
      console.warn('Failed to persist user role to backend:', err);
    }
  };

  // Complete onboarding flow
  const completeOnboarding = async ({ language, role, location }) => {
    if (language) setSelectedLanguage(language);
    if (role) {
      setUserRoleState(role);
      localStorage.setItem('weathergpt_role', role);
    }
    if (location) {
      setCurrentLocation(location);
      localStorage.setItem('weathergpt_location', JSON.stringify(location));
    }

    localStorage.setItem('weathergpt_onboarded', 'true');
    setIsOnboarded(true);
    setShowOnboarding(false);

    // Persist to MongoDB Atlas via backend
    try {
      await api.updateUserProfile({
        session_id: sessionId,
        role: role || userRole,
        preferred_language: language || selectedLanguage,
        home_location: location || currentLocation,
        onboarded: true,
      });
    } catch (err) {
      console.warn('Error persisting onboarding to backend:', err);
    }
  };

  // Sync profile from backend on mount
  useEffect(() => {
    api.getHealth()
      .then((data) => {
        setBackendStatus({ status: data.status, connected: true, data });
      })
      .catch(() => {
        setBackendStatus({ status: 'offline', connected: false });
      });

    // Check remote user profile
    api.getUserProfile(sessionId)
      .then((res) => {
        if (res && res.user) {
          const u = res.user;
          if (u.role) {
            setUserRoleState(u.role);
            localStorage.setItem('weathergpt_role', u.role);
          }
          if (u.preferred_language) {
            setSelectedLanguage(u.preferred_language);
          }
          if (u.home_location && u.home_location.name) {
            setCurrentLocation(u.home_location);
            localStorage.setItem('weathergpt_location', JSON.stringify(u.home_location));
          }
          if (u.onboarded === true) {
            setIsOnboarded(true);
            setShowOnboarding(false);
            localStorage.setItem('weathergpt_onboarded', 'true');
          }
        }
      })
      .catch((err) => {
        console.debug('Could not fetch remote user profile, using local state:', err);
      });
  }, [sessionId]);

  return (
    <WeatherContext.Provider
      value={{
        sessionId,
        currentLocation,
        setCurrentLocation: (loc) => {
          setCurrentLocation(loc);
          localStorage.setItem('weathergpt_location', JSON.stringify(loc));
        },
        selectedLanguage,
        setSelectedLanguage,
        userRole,
        setUserRole,
        isOnboarded,
        showOnboarding,
        setShowOnboarding,
        completeOnboarding,
        backendStatus,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}
