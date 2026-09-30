# WeatherGPT (SIH 26068) — Antigravity Prompt Pack

**Problem:** Conversational AI for weather forecasts, alerts and climate info (MoES / IMD, Disaster Management)

**How to use:** Paste prompts into Antigravity **in order**. Finish and run each one before moving to the next. Every prompt ends with a "Done when" check, so you know it works before continuing.

## Final tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS, React Router, Recharts, Leaflet (maps), react-i18next, PWA (vite-plugin-pwa) |
| Backend | Python 3.11, FastAPI, Pydantic v2, Motor (async MongoDB), httpx, APScheduler, WebSockets |
| Database | MongoDB Atlas |
| LLM | Google Gemini API (function calling, multilingual). Keep a provider interface so Llama/OpenAI can be swapped in |
| Weather data | Open-Meteo (forecast, GFS model, historical archive, air quality; free, no key), IMD public feeds / CAP alerts where available, NASA POWER (climate/agri data) |
| Voice | Browser Web Speech API (speech to text + text to speech), optional Bhashini API |
| Realtime | WebSocket (alerts push), optional MQTT (paho-mqtt) for WIS2-style ingestion demo |
| DevOps | Docker, docker-compose, GitHub Actions, deploy to Render (backend) + Vercel (frontend) |

## Suggested timeline (deadline is tight, so prioritise)

- **Must have (Prompts 1 to 12):** working chatbot, live weather, forecast, alerts, multilingual, voice
- **Should have (13 to 16):** climate analytics, advisories, map, dashboard
- **Nice to have (17 to 20):** NWP/MQTT demo, tests, Docker, docs and demo script

---

## PROMPT 1 — Project setup and architecture

```
Create a monorepo named "weathergpt" with two folders: /frontend and /backend.

Backend: FastAPI (Python 3.11) with this structure:
app/main.py, app/core/config.py (pydantic-settings, loads .env), app/core/database.py (Motor async client for MongoDB Atlas),
app/routers/, app/services/, app/models/, app/schemas/, app/utils/.
Add CORS, a /health endpoint, a global exception handler, structured logging, and API versioning under /api/v1.
Create requirements.txt (fastapi, uvicorn[standard], motor, pydantic-settings, httpx, apscheduler, python-dotenv, google-generativeai, websockets, pandas, numpy, cachetools) and a .env.example with MONGODB_URI, GEMINI_API_KEY, OPENWEATHER_KEY (optional), FRONTEND_URL.

Frontend: Vite + React 18 + Tailwind CSS with React Router. Folders: src/components, src/pages, src/services (api.js), src/hooks, src/context, src/i18n, src/utils.
Mobile-first responsive layout, and configure it as a PWA with vite-plugin-pwa (installable on phones).

Add a root README with the architecture overview and run instructions.
Done when: `uvicorn app.main:app --reload` serves /health and `npm run dev` shows a placeholder home page.
```

## PROMPT 2 — MongoDB Atlas schema and connection

```
In the backend, connect to MongoDB Atlas using Motor with connection pooling and a startup/shutdown lifecycle.
Create collections and Pydantic models with indexes:
- users (anonymous session id, preferred_language, home_location, role: farmer|citizen|researcher|aviation|marine|officer, created_at)
- conversations (session_id, messages[{role, content, language, intent, timestamp}], created_at)
- weather_cache (key: lat,lon,type; data; fetched_at; TTL index of 15 minutes)
- alerts (type, severity, region, geometry/lat-lon, title, description, source, valid_from, valid_to, created_at) with a 2dsphere index
- subscriptions (session_id, location, alert_types, language, push_token)
- locations (name, state, district, lat, lon) seeded with ~200 major Indian cities/districts, with a text index for search
- feedback (message_id, rating, comment)
Write a seed script scripts/seed_locations.py. Add repository functions with async CRUD helpers.
Done when: seed script runs and inserted data is visible in Atlas.
```

## PROMPT 3 — Weather data service (real-time + forecast)

```
Create app/services/weather_service.py using httpx (async) and Open-Meteo APIs (no API key):
- get_current(lat, lon): temperature, feels-like, humidity, wind speed/direction, pressure, rain, cloud cover, UV index, visibility, weather code
- get_hourly_forecast(lat, lon, hours=48)
- get_daily_forecast(lat, lon, days=7): max/min temp, rainfall, probability, sunrise/sunset, wind gusts
- get_air_quality(lat, lon): PM2.5, PM10, AQI
Map WMO weather codes to human-readable descriptions and icons.
Add caching using MongoDB weather_cache (TTL 15 min) plus an in-memory cachetools layer.
Add retry with exponential backoff and graceful fallback if the API fails.
Expose REST endpoints: GET /api/v1/weather/current, /forecast/hourly, /forecast/daily, /air-quality (query params lat, lon or place name).
Done when: calling the endpoints for Hyderabad returns clean JSON in under 1 second on cached requests.
```

## PROMPT 4 — Geocoding and location resolution

```
Create app/services/location_service.py:
- resolve_place(name): first search the local `locations` collection (fuzzy match, handles Indian spellings like Vizag/Visakhapatnam, Bengaluru/Bangalore), then fall back to the Open-Meteo geocoding API.
- reverse_geocode(lat, lon) to the nearest district/state.
- Endpoint GET /api/v1/locations/search?q= for autocomplete and GET /api/v1/locations/reverse.
Handle ambiguity by returning ranked candidates with state names.
Done when: "Kurnool", "Vizag" and "Chennai" resolve correctly.
```

## PROMPT 5 — LLM query understanding engine (core of the project)

```
Create app/services/llm_service.py with a provider interface (BaseLLM) and a GeminiLLM implementation using function calling.

Pipeline for every user message:
1. Detect language (Indian languages: en, hi, te, ta, kn, ml, mr, bn, gu, pa, or).
2. Understand intent with structured JSON output. Intents: current_weather, forecast, alert_check, climate_history, advisory (agriculture/aviation/marine/travel/health), comparison, general_weather_knowledge, small_talk, out_of_scope.
3. Extract entities: location, date/time range (resolve "tomorrow", "next Sunday", "this week"), crop (if any), activity.
4. Call the right tool functions (get_current, get_forecast, get_alerts, get_history, get_advisory) via Gemini function calling.
5. Generate a grounded natural-language answer ONLY from the tool data (no hallucinated numbers), in the user's language, concise and mobile friendly.
6. Return {answer, intent, entities, sources, data_cards, follow_up_suggestions}.

System prompt rules: act as an IMD-aligned weather assistant, never invent data, state data source and time, give safety guidance for severe weather, and refuse non-weather topics politely.
Add conversation memory (last 6 turns) so follow-ups like "what about tomorrow?" work.
Endpoint: POST /api/v1/chat with {session_id, message, language?, lat?, lon?}. Store the conversation in MongoDB.
Done when: "Will it rain in Kurnool tomorrow?" and "Hyderabad lo repu vaana padutunda?" both return grounded answers.

Continue the existing weathergpt project. Add a GroqLLM implementation of BaseLLM using the Groq Python SDK (or httpx with the OpenAI-compatible endpoint), with tool calling support. Read LLM_INTENT_PROVIDER and LLM_ANSWER_PROVIDER (groq|gemini) from .env, plus GROQ_API_KEY, GROQ_MODEL and GEMINI_MODEL. Use the intent provider for intent/entity extraction and tool calls, and the answer provider for the final reply. If a provider fails or returns 429, fall back to the other one.
For POST /api/v1/voice/transcribe, use Groq's Whisper model with the language hint from the user's selected language.
```

## PROMPT 6 — Chat UI (React)

```
Build the main chat interface in React + Tailwind, mobile-first:
- Header with app logo, language selector, location chip, and a theme toggle (light/dark)
- Message list with user/bot bubbles, typing indicator, auto-scroll, timestamps
- Rich message cards: the bot can attach data_cards (current weather card, 7-day forecast strip, alert banner, mini chart)
- Suggested quick-action chips ("Today's weather", "7-day forecast", "Any alerts?", "Farming advice")
- Input bar with text field, send button, and a mic button (wired up later)
- Streaming-style reveal of the bot's answer, and thumbs up/down feedback per message (POST /api/v1/feedback)
- Session id stored in localStorage; skeleton loaders and friendly error states
Make it accessible: ARIA labels, keyboard navigation, large touch targets, high contrast.
Done when: chatting end to end with the backend works on a 375px wide screen.
```

## PROMPT 7 — Weather dashboard and location detection

```
Create a Home page with:
- Auto-detect location via the browser Geolocation API with a manual search fallback (autocomplete using /locations/search)
- Big current-weather card, hourly forecast scroller (Recharts line chart for temperature and rainfall), 7-day forecast list, sunrise/sunset, AQI badge, UV index
- Bottom navigation: Home, Chat, Alerts, Map, Climate, Settings
- Save favourite locations (localStorage + backend user preference)
Use a clean modern design with weather-based dynamic gradients (sunny, cloudy, rainy, stormy) and lucide-react icons.
Done when: the dashboard loads real data for the detected location.
```

## PROMPT 8 — Multilingual support (Indian languages)

```
Implement multilingual support end to end:
Frontend: react-i18next with UI translations for English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi and Odia. Language selector persists to localStorage; use Noto Sans fonts covering these scripts.
Backend: the chat endpoint detects the input language and replies in the same language (Gemini handles generation). Add a translation utility for alert texts and advisories, and cache translated templates in MongoDB.
Add a glossary of weather terms (heavy rain, cyclone, heatwave, thunderstorm, etc.) per language to keep terminology consistent.
Done when: switching to Telugu translates the whole UI and bot replies come back in Telugu.
```

## PROMPT 9 — Voice-enabled interaction

```
Add voice features for rural accessibility:
- Speech to text using the Web Speech API (SpeechRecognition) with the language mapped from the selected language (te-IN, hi-IN, ta-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN, en-IN). A mic button with a pulsing listening animation and live transcript.
- Text to speech using speechSynthesis to read bot answers aloud, with a speaker toggle and "auto-read replies" setting.
- Graceful fallback message when the browser lacks support, plus an optional backend endpoint POST /api/v1/voice/transcribe that accepts audio and uses Gemini audio understanding as a fallback.
- A simple "voice mode" screen with a big microphone button designed for low-literacy users (icon-driven, minimal text).
Done when: speaking a Hindi or Telugu question returns a spoken answer.
```

## PROMPT 10 — Alerts engine and early warnings

```
Build the alerts system:
Backend:
- app/services/alert_service.py fetches warnings from IMD public feeds / CAP-style RSS where accessible, and ALSO generates rule-based alerts from forecast data using thresholds: heatwave (max temp >= 40C and departure), heavy rain (>64.5 mm/24h yellow, >115.6 orange, >204.4 red per IMD categories), thunderstorm/lightning, strong wind (gust > 50 km/h), cold wave, low visibility/fog.
- Severity levels: green, yellow, orange, red (IMD colour codes). Store to the `alerts` collection.
- APScheduler job every 15 minutes checks all locations with active subscriptions and creates new alerts (deduplicate).
- Endpoints: GET /api/v1/alerts?lat&lon&radius, POST /api/v1/subscriptions, DELETE /api/v1/subscriptions/{id}.
- WebSocket /ws/alerts pushes new alerts in real time to connected clients.
Frontend: Alerts page with colour-coded cards, severity filter, "what to do" safety tips, a live banner on Home when an orange/red alert is active, and browser notifications when permitted.
Done when: an artificially lowered threshold triggers a live alert banner via WebSocket.
```

## PROMPT 11 — Location-based advisory generation

```
Create app/services/advisory_service.py that generates location-specific advisories using forecast data + LLM:
- Agriculture: crop-specific (rice, cotton, groundnut, chilli, maize, wheat, sugarcane, tomato) advice on sowing, irrigation, spraying (avoid before rain), harvesting, pest/disease risk (humidity-based), and heat stress.
- Aviation: METAR-style briefing (wind, visibility, cloud base estimate, turbulence/thunderstorm risk).
- Marine/fishermen: wind, wave-risk proxy, and go/no-go guidance.
- Health and travel: heat index, AQI, hydration tips.
- Urban/smart city: waterlogging risk from rainfall intensity, traffic-impact note.
Endpoint GET /api/v1/advisory?type=&lat=&lon=&crop=. Advisories must be in the user's language and always cite the underlying numbers. Use a role-based default (farmer sees agri advice first).
Frontend: an Advisory page with tabs per sector and a crop picker.
Done when: "Cotton spraying advice for Kurnool this week" returns dated, data-backed guidance.
```

## PROMPT 12 — Climate trends and historical analysis

```
Create app/services/climate_service.py using the Open-Meteo Historical Archive API and NASA POWER:
- Monthly and yearly average temperature and rainfall for the past 30 years for any location
- Trend detection (linear regression slope per decade), anomaly vs. baseline, count of extreme days (>40C, heavy rain days)
- Compare two locations or two periods
- Endpoint GET /api/v1/climate/trends?lat&lon&from&to&metric
Frontend Climate page: Recharts line/bar charts, an anomaly heatmap by month, comparison selector, and a "download CSV" button. The chatbot should call this for questions like "how has rainfall in Anantapur changed in 20 years?" and describe the trend in plain language.
Done when: a 20-year rainfall trend chart renders and the bot explains it.
```

## PROMPT 13 — Interactive weather map (GIS)

```
Add a Map page using Leaflet (react-leaflet) with OpenStreetMap tiles:
- Layers toggle: temperature, rainfall, wind, clouds (use Open-Meteo grid points sampled over India rendered as a heat overlay or coloured markers, and/or free tile layers)
- Alert polygons/markers coloured by IMD severity
- Click any point to see current weather + a "Ask WeatherGPT about this place" button that opens chat with the location prefilled
- District boundary GeoJSON overlay for Indian states (bundle a simplified GeoJSON)
Done when: clicking on the map pins a location and shows live weather.
```

## PROMPT 14 — NWP model integration (GFS) and real-time ingestion

```
Add an NWP layer to satisfy the "GFS/WRF integration" requirement:
- app/services/nwp_service.py fetching GFS model output via Open-Meteo with models=gfs_seamless (and ecmwf_ifs for comparison) for temperature, precipitation, wind, and pressure.
- A "model comparison" endpoint /api/v1/nwp/compare returning GFS vs ECMWF vs best-match for the next 7 days, and the chatbot can explain model agreement/uncertainty ("models agree on rain" vs "models differ").
- Optional advanced module: a script that downloads a GFS GRIB2 subset from NOAA NOMADS and reads it using xarray + cfgrib, then stores gridded summaries in MongoDB. Keep this behind a feature flag.
- Real-time ingestion: add an MQTT subscriber (paho-mqtt) and a mock publisher script that emulates AWS (automatic weather station) readings; ingest to MongoDB (time-series collection) and broadcast via WebSocket. Document that this mirrors WIS2.0 style publish/subscribe.
Done when: the mock MQTT publisher shows live station readings updating in the UI.
```

## PROMPT 15 — Role-based experience and onboarding

```
Add a first-run onboarding flow: choose language, choose role (Farmer, Citizen, Researcher, Aviation, Marine, Disaster Manager), allow location. Personalise the Home page and quick chips by role:
- Farmer: crop advisory + rain forecast + spraying window
- Aviation: METAR-style summary
- Disaster Manager: active alert list across a state, district heat table, and a "broadcast summary" generator (LLM drafts a public advisory message in multiple languages)
- Researcher: climate data explorer and CSV export
Persist role in users collection.
Done when: switching roles changes the Home layout and default suggestions.
```

## PROMPT 16 — Disaster manager dashboard

```
Create an /officer page:
- State/district selector, table of districts with current risk level (computed from alerts and forecast), sortable
- Trend cards: total active alerts by severity, heaviest rainfall district, hottest district
- "Generate public advisory" button: LLM composes a short SMS-style warning in English + selected regional languages (max 160 chars each) which can be copied
- Export the alert report as PDF (jsPDF) or CSV
Done when: an officer can generate and copy a Telugu + Hindi + English cyclone warning in one click.
```

## PROMPT 17 — Performance, reliability and scalability

```
Optimise for the evaluation criteria (latency, scalability):
- Add response-time logging middleware and a /metrics-style endpoint (avg latency, cache hit rate)
- Parallelise tool calls with asyncio.gather; add request timeouts and circuit breaker for external APIs
- Add rate limiting (slowapi) and input validation/sanitisation; prompt-injection guard on chat input
- Add a fallback path: if the LLM fails, return a template-based answer from raw data
- Add lazy loading and code splitting on the frontend; make the app usable offline with the last cached forecast (service worker)
Done when: the average cached chat response is below 3 seconds and offline mode displays the last forecast.
```

## PROMPT 18 — Testing and evaluation

```
Add tests:
- Backend: pytest + pytest-asyncio for weather_service (mocked httpx), intent extraction, alert threshold logic, and the chat endpoint.
- Frontend: Vitest + React Testing Library for ChatWindow, LanguageSelector and AlertBanner.
- A small evaluation script that runs 30 sample questions in English, Hindi and Telugu and reports intent accuracy and average latency to a markdown table (useful for the SIH presentation).
Done when: `pytest` and `npm test` pass and the evaluation table is generated.
```

## PROMPT 19 — Docker and deployment

```
Add Dockerfiles for backend and frontend (multi-stage build), docker-compose.yml (backend, frontend, optional mosquitto MQTT broker), and a GitHub Actions workflow for lint + test. Prepare deployment configs: backend on Render (render.yaml, start command uvicorn), frontend on Vercel (env VITE_API_URL). Add Kubernetes manifests (deployment.yaml, service.yaml, hpa.yaml) as a scalability showcase. Configure production CORS and environment variables.
Done when: `docker compose up` runs the full stack locally and both services are deployed with public URLs.
```

## PROMPT 20 — Documentation, demo script and presentation support

```
Generate:
1. A polished README.md: problem statement, features mapped one-to-one to the SIH key features, architecture diagram (Mermaid), tech stack, setup steps, API docs summary, screenshots placeholders.
2. docs/ARCHITECTURE.md explaining data flow: User (text/voice) -> React PWA -> FastAPI -> LLM intent engine -> tools (weather, NWP, alerts, climate) -> grounded response -> multilingual output.
3. docs/DEMO_SCRIPT.md: a 5-minute demo flow (farmer asks in Telugu by voice, live alert push, officer generates multilingual advisory, climate trend question, model comparison).
4. docs/SIH_PPT_OUTLINE.md: slide-by-slide outline (problem, solution, architecture, innovation, impact, scalability, roadmap such as SMS/WhatsApp/IVR channel and integration with IMD Mausam APIs).
Done when: the README renders properly on GitHub and the demo script matches the actual app.
```

---

## Tips for Antigravity

- Start each prompt with: *"Continue the existing weathergpt project. Do not rewrite previous work; only add or modify what is needed."*
- If something breaks, paste the exact error and say: *"Fix this without changing unrelated files."*
- Keep API keys only in `.env`; never commit them.
- If time runs short, skip Prompts 14 (GRIB part), 16 and 19 (Kubernetes) and keep the Open-Meteo GFS comparison only.

## Innovation points worth highlighting to judges

1. Grounded answers only from live data (no hallucinated weather)
2. Voice + 10 Indian languages for rural users
3. GFS vs ECMWF model agreement explained in plain language
4. IMD colour-coded alerts with WebSocket push and officer-ready multilingual broadcast messages
5. Works offline as a PWA, and scalable with Docker/Kubernetes and MQTT/WIS2-style ingestion
