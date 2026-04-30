# 🚄 RailTwin AI — Intelligent Railway Management System

<div align="center">

![RailTwin AI](https://img.shields.io/badge/RailTwin-AI%20Powered-blue?style=for-the-badge&logo=train)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)
![Vite](https://img.shields.io/badge/Vite-6.1.0-646CFF?style=for-the-badge&logo=vite)
![Base44](https://img.shields.io/badge/Base44-SDK-green?style=for-the-badge)

**A production-grade AI-powered Digital Twin for Railway Network Operations**

*Real-time train tracking · Platform management · AI conflict resolution · Passenger intelligence*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Features](#-live-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Data Entities](#-data-entities)
- [Firebase Integration](#-firebase-integration)
- [Getting Started](#-getting-started)
- [Pages & Modules](#-pages--modules)
- [Architecture](#-architecture)
- [Environment Variables](#-environment-variables)

---

## 🌟 Overview

**RailTwin AI** is a capstone project that simulates a **railway digital twin** — a real-time virtual replica of an entire train network. The system continuously tracks 12 trains across 10 stations, monitors platform occupancy, detects conflicts, generates AI-driven alerts, and provides a passenger-facing portal.

The project integrates **Base44** (backend-as-a-service) with **Firebase Firestore** (persistent real-time database) to create a dual-layer data pipeline that ensures live, synchronized data across all dashboards.

---

## ✨ Live Features

| Feature | Description |
|---|---|
| 🗺️ **Live Map** | Real-time GPS train positions on an interactive Leaflet.js map |
| 📊 **Operations Dashboard** | KPI cards, delay trends, throughput charts updating every 3 seconds |
| 🚆 **Train Management** | Full train registry with status, speed, occupancy, platform assignment |
| 🚨 **Alert System** | AI-generated conflict, delay, weather, and anomaly alerts with resolution tracking |
| ⚙️ **Workflow Engine** | Automated incident workflows with task assignment and priority queues |
| 📈 **Analytics** | Historical trends, performance metrics, occupancy heatmaps |
| 👤 **Passenger Portal** | Public-facing train search, live status, platform info |
| 🔐 **Admin Authentication** | Secure admin login with Base44 auth |
| 🔥 **Firebase Sync** | All simulation data mirrored to Firestore in real-time |
| 🌤️ **Weather Widget** | Live weather conditions affecting operations |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.2.0 | UI component framework |
| **Vite** | 6.1.0 | Build tool and dev server |
| **React Router DOM** | 6.26.0 | Client-side routing |
| **TailwindCSS** | 3.4.17 | Utility-first CSS styling |
| **Framer Motion** | 11.16.4 | Animations and transitions |
| **Recharts** | 2.15.4 | Data visualization charts |
| **React Leaflet** | 4.2.1 | Interactive map rendering |
| **Lucide React** | 0.475.0 | Icon library |
| **Radix UI** | Various | Accessible UI primitives |
| **TanStack Query** | 5.84.1 | Server state management |
| **React Hook Form** | 7.54.2 | Form management |
| **Zod** | 3.24.2 | Schema validation |
| **Moment.js** | 2.30.1 | Date/time formatting |
| **Three.js** | 0.171.0 | 3D rendering capabilities |

### Backend & Database
| Technology | Purpose |
|---|---|
| **Base44 SDK** | Backend-as-a-service (auth, entities, API) |
| **Firebase Firestore** | Real-time NoSQL database for persistent sync |
| **Firebase Auth** | Authentication services |

### Development Tools
| Tool | Purpose |
|---|---|
| **ESLint** | Code linting |
| **TypeScript** | Type checking |
| **PostCSS** | CSS processing |
| **Autoprefixer** | CSS vendor prefixes |

---

## 📁 Project Structure

```
capston-basr44/
│
├── 📂 entities/                    # Base44 data schemas (JSON)
│   ├── Alert                       # Alert entity schema
│   ├── IncidentWorkflow            # Workflow entity schema
│   ├── Station                     # Station entity schema
│   ├── Train                       # Train entity schema
│   ├── TrainLog                    # Train event log schema
│   └── WorkflowTask                # Workflow task schema
│
├── 📂 src/
│   ├── 📂 api/
│   │   └── base44Client.js         # Base44 SDK client initialization
│   │
│   ├── 📂 components/
│   │   ├── ProtectedRoute.jsx      # Auth guard component
│   │   ├── UserNotRegisteredError.jsx
│   │   ├── 📂 admin/
│   │   │   ├── AdminLayout.jsx     # Main admin layout with sidebar
│   │   │   ├── AlertCard.jsx       # Alert display card
│   │   │   ├── KpiCard.jsx         # KPI metric card
│   │   │   ├── TrainStatusBadge.jsx
│   │   │   ├── TrainStatusCard.jsx # Train info card
│   │   │   ├── TrainTypeIcon.jsx   # Train type icon selector
│   │   │   ├── WeatherWidget.jsx   # Live weather widget
│   │   │   └── WorkflowPanel.jsx   # Incident workflow panel
│   │   └── 📂 ui/                  # Radix UI component library (shadcn)
│   │
│   ├── 📂 hooks/
│   │   └── use-mobile.jsx          # Mobile detection hook
│   │
│   ├── 📂 lib/
│   │   ├── AuthContext.jsx         # Auth state management
│   │   ├── PageNotFound.jsx        # 404 page
│   │   ├── app-params.js           # App configuration params
│   │   ├── query-client.js         # TanStack Query client
│   │   ├── trainSimulation.js      # Core train simulation engine
│   │   ├── trainSync.js            # Base44 train sync service
│   │   ├── firebaseSync.js         # Firebase Firestore sync service ⭐
│   │   ├── useRealTimeTrains.js    # Real-time trains React hook
│   │   └── utils.js                # Utility functions
│   │
│   ├── 📂 pages/
│   │   ├── AdminLogin.jsx          # Admin authentication page
│   │   ├── Alerts.jsx              # Alert management dashboard
│   │   ├── Analytics.jsx           # Analytics and trends page
│   │   ├── Dashboard.jsx           # Main operations dashboard
│   │   ├── LiveMap.jsx             # Real-time train map
│   │   ├── PassengerPortal.jsx     # Public passenger portal
│   │   ├── PassengerView.jsx       # Passenger-facing admin view
│   │   ├── Trains.jsx              # Train management page
│   │   └── Workflows.jsx           # Incident workflow management
│   │
│   ├── firebase.js                 # Firebase config & helpers ⭐
│   ├── App.jsx                     # Root app component with routing
│   ├── main.jsx                    # React entry point
│   └── index.css                   # Global styles
│
├── index.html                      # HTML entry point
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind CSS configuration
├── jsconfig.json                   # JS path aliases
├── package.json                    # Dependencies
└── README.md                       # This file
```

---

## 🗄️ Data Entities

### Train
| Field | Type | Description |
|---|---|---|
| `train_number` | string | Unique identifier (e.g., EX-101) |
| `name` | string | Train name |
| `status` | enum | `on_time` / `delayed` / `cancelled` / `arrived` / `departed` |
| `current_station` | string | Current station name |
| `next_station` | string | Next station name |
| `latitude / longitude` | number | Real-time GPS coordinates |
| `speed_kmh` | number | Current speed |
| `delay_minutes` | number | Delay in minutes |
| `passenger_count` | number | Current passengers |
| `capacity` | number | Maximum capacity |
| `type` | enum | `express` / `local` / `freight` / `high_speed` |
| `platform` | number | Assigned platform number |
| `route` | array | Ordered list of stations |

### Station
| Field | Type | Description |
|---|---|---|
| `name` | string | Station name |
| `code` | string | Station code (e.g., GCT) |
| `latitude / longitude` | number | GPS coordinates |
| `platforms` | number | Total platform count |
| `platforms_occupied` | number | Currently occupied platforms |
| `zone` | string | Station zone (A–E) |
| `connections` | array | Connected stations with distance and time |

### Alert
| Field | Type | Description |
|---|---|---|
| `title` | string | Alert title |
| `severity` | enum | `critical` / `warning` / `info` |
| `type` | enum | `conflict` / `delay` / `weather` / `anomaly` / `maintenance` |
| `ai_suggestion` | string | AI-generated resolution suggestion |
| `resolved` | boolean | Resolution status |

### TrainLog
| Field | Type | Description |
|---|---|---|
| `train_number` | string | Associated train |
| `event_type` | enum | `departure` / `arrival` / `delay` / `speed_change` / `reroute` / `stop` |
| `station` | string | Station where event occurred |
| `delay_minutes` | number | Delay at event time |
| `timestamp` | string | ISO timestamp |

---

## 🔥 Firebase Integration

The project uses Firebase Firestore as a **secondary persistent database** that mirrors all Base44 simulation data in real-time.

### Firestore Collections

| Collection | Contents | Sync Frequency |
|---|---|---|
| `trains` | Live train positions, speed, status, occupancy | Every **3 seconds** |
| `stations` | Station data with coordinates and platforms | **Once** on startup |
| `network_stats` | KPI summary (on-time rate, avg delay, passengers) | Every **3 seconds** |
| `alerts` | All alerts from Base44 | Every **15 seconds** |
| `train_logs` | Train event history | Every **30 seconds** |

### Firebase Files
- **`src/firebase.js`** — Firebase app initialization + Firestore helpers (`addDocument`, `setDocument`, `updateDocument`, `deleteDocument`, `getDocuments`, `listenToCollection`)
- **`src/lib/firebaseSync.js`** — Sync engine that runs independently alongside Base44

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ 
- **npm** v9+
- **Git**
- A **Base44** account (for backend features)
- A **Firebase** project (for Firestore sync)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/udayponnaganti/Capston2026.git
cd Capston2026

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create a .env.local file with your credentials (see below)

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the project root:

```env
# Base44 Configuration
VITE_BASE44_APP_ID=your_base44_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

> **Firebase config** is stored directly in `src/firebase.js` — update the `firebaseConfig` object with your own Firebase project credentials before deploying to production.

---

## 📱 Pages & Modules

### `/` — Operations Dashboard
- Live KPI cards: Active Trains, On-Time Rate, Avg Delay, Platform Utilization
- Real-time delay trend and network throughput charts
- Active train list with status badges
- Recent alerts panel
- Live weather widget

### `/map` — Live Map
- Interactive Leaflet.js map with all 10 stations plotted
- Real-time train markers moving along routes
- Click trains/stations for detailed info popups
- Network topology visualization

### `/trains` — Train Management
- Full registry of all 12 trains
- Filter by status, type, route
- Real-time speed, occupancy, platform data
- Train detail view

### `/alerts` — Alert Center
- AI-generated system alerts with severity levels
- Alert types: conflict, delay, weather, anomaly, maintenance
- AI suggestion panel for each alert
- Mark as resolved workflow

### `/workflows` — Incident Workflows
- Automated workflow creation for incidents
- Task assignment and priority management
- Resolution tracking dashboard

### `/analytics` — Analytics
- Historical performance charts
- Delay distribution analysis
- Passenger throughput trends
- Station occupancy heatmaps

### `/passenger` — Passenger View (Admin)
- Admin view of passenger-facing data
- Train search and status lookup

### `/passenger-portal` — Public Passenger Portal
- Public train search by origin/destination
- Live arrival/departure status
- Platform information
- No authentication required

### `/admin-login` — Admin Login
- Secure admin authentication via Base44 Auth

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │Dashboard │  │ LiveMap  │  │  Trains  │  │ PassengerPortal│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              trainSimulation.js (Core Engine)            │    │
│  │  12 trains · 10 stations · Deterministic physics sim    │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                       │
│         ┌─────────────────┴──────────────────┐                  │
│         ▼                                     ▼                  │
│  ┌─────────────┐                    ┌──────────────────┐        │
│  │ trainSync.js│                    │ firebaseSync.js   │        │
│  │(Base44 API) │                    │(Firebase Firestore│        │
│  └──────┬──────┘                    └────────┬─────────┘        │
└─────────┼───────────────────────────────────┼───────────────────┘
          ▼                                    ▼
┌─────────────────┐                ┌──────────────────────┐
│  Base44 Backend │                │  Firebase Firestore   │
│  (Auth + API)   │                │  (Real-time DB)       │
│                 │                │  • trains             │
│  • Train entity │                │  • stations           │
│  • Station      │◄──── sync ────►│  • alerts             │
│  • Alert        │                │  • train_logs         │
│  • TrainLog     │                │  • network_stats      │
│  • Workflow     │                └──────────────────────┘
└─────────────────┘
```

---

## 🚉 Simulated Network

The system simulates a 10-station railway network:

| Code | Station | Zone | Platforms |
|---|---|---|---|
| GCT | Grand Central | A | 12 |
| PEN | Penn Station | A | 11 |
| MSQ | Metro Square | A | 9 |
| UNT | Union Terminal | B | 8 |
| WBC | Westbrook Central | D | 7 |
| RVH | Riverside Hub | B | 6 |
| NFP | Northfield Park | D | 6 |
| EGJ | Eastgate Junction | C | 5 |
| SPT | Southport Terminal | E | 5 |
| HBG | Harbor Bridge | C | 4 |

**12 active trains** of 4 types: Express · High Speed · Local · Freight

---

## 👨‍💻 Author

**Uday Ponnaganti**  
Capstone Project 2026  
AI-Powered Railway Intelligence System — RailTwin

---

## 📄 License

This project is developed as an academic capstone project. All rights reserved © 2026.
