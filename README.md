# WeatherGPT (SIH 26068)

> **Conversational AI for weather forecasts, early warnings, and climate intelligence (MoES / IMD, Disaster Management)**

---

## Architecture Overview

WeatherGPT is designed as a monorepo consisting of:
- **Backend (`/backend`)**: High-performance asynchronous FastAPI service powered by Python 3.11/3.13, Pydantic v2, Motor (MongoDB Atlas async client), structured logging, CORS middleware, APScheduler, and Gemini function-calling LLM integration.
- **Frontend (`/frontend`)**: Mobile-first progressive web app (PWA) built with React 18, Vite, Tailwind CSS, React Router, Recharts, and Lucide icons.

```
weathergpt/
├── backend/
│   ├── app/
│   │   ├── core/         # Settings, database connection, structured logging
│   │   ├── routers/      # API endpoints (health, chat, weather, alerts, etc.)
│   │   ├── services/     # Weather APIs, geocoding, Gemini LLM engine
│   │   ├── models/       # MongoDB ODM / document models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── utils/        # Formatters, helpers, translators
│   │   └── main.py       # FastAPI application entrypoint & lifespan
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/   # Header, BottomNav, DataCards
│   │   ├── pages/        # Home, Chat, Alerts, Map
│   │   ├── services/     # api.js client
│   │   ├── hooks/        # Custom React hooks
│   │   ├── context/      # Global state (WeatherContext)
│   │   ├── i18n/         # Multilingual Indian language configurations
│   │   └── utils/        # Metric formatters
│   ├── package.json
│   ├── vite.config.js    # PWA & Vite setup
│   └── tailwind.config.js
└── README.md
```

---

## Quick Start & Run Instructions

### 1. Backend Setup

```bash
cd backend

# Create & activate a virtual environment (optional)
python -m venv venv
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --reload --port 8000
```

* **Health Check**: `http://localhost:8000/health`
* **Swagger API Documentation**: `http://localhost:8000/docs`
* **API Version 1**: `http://localhost:8000/api/v1`

### 2. Frontend Setup

```bash
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```

* Open: `http://localhost:5173`
* The application runs in mobile-first responsive layout (optimized for 375px+ screens) and installs as a PWA.

---

## Environment Variables

Check `backend/.env.example`:
* `MONGODB_URI`: MongoDB Atlas connection string.
* `GEMINI_API_KEY`: Google Gemini API Key for grounded conversational weather intelligence.
* `FRONTEND_URL`: Allowed origin for CORS (default: `http://localhost:5173`).
