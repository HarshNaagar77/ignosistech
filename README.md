# Retail Locations Map

An interactive, high-performance web application that visualizes 100 ,000+ US retail store locations. The application dynamically adjusts data density and visualizations based on the user's viewport and zoom level.

## Features

*   **Tier 1 (Zoom 1-5): State Aggregation.** Shows one marker per US state positioned at the calculated store centroid, displaying the total count of stores in that state.
*   **Tier 2 (Zoom 6-10): Regional Clustering.** Seamless server-side clustering. Isolated stores are stylized to match the cluster visual language.
*   **Tier 3 (Zoom 11+): Street Level.** Displays precise individual store locations using dynamic, color-coded brand logo SVGs. Clicking a store reveals detailed information.
*   **Viewport Data Fetching:** Only requests and loads data that falls strictly within the current screen bounds, preventing the browser from crashing under the weight of 134k data points.

---

## 🚀 Setup & Run Instructions

### 1. Prerequisites
*   [Node.js](https://nodejs.org/) (v18+ recommended)

### 2. Environment Variables
You must provide a valid Google Maps API Key to run the frontend. 
Create a `.env` file in the `frontend/` directory:
```bash
# frontend/.env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 3. Installation & Running

**Backend:**
```bash
cd backend
npm install
npm start
```
*The backend will read the dataset CSV and start on `http://localhost:4000`.*

**Frontend:**
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The frontend will start on the local Vite server (usually `http://localhost:4173`).*

---

## 🛠 Tech Stack & Architecture Choices

### Stack
*   **Backend:** Node.js + Express
*   **Frontend:** React + Vite + `@react-google-maps/api`

### Architecture Trade-offs & Decisions (Given the 2-Hour Limit)

1.  **In-Memory Spatial Index vs. PostGIS Database**
    Setting up and seeding a full PostgreSQL database with the PostGIS extension would have consumed a significant portion of the time limit. Instead, I opted to stream the 134,000-row CSV into memory on server startup and use the `supercluster` library to build an **in-memory spatial index (KD-tree)**. This approach completely bypasses database latency and effortlessly handles bounding box queries in under 50 milliseconds, satisfying both the time constraint and the performance requirement.

2.  **Server-Side Clustering**
    Rather than sending up to 2,500 raw points to the frontend and relying on `MarkerClusterer` to group them locally, I moved the clustering logic strictly to the backend. The server processes the clusters and only sends the aggregated "cluster" objects to the frontend. This dramatically reduces API payload sizes and eliminates React DOM lag during map panning.

3.  **Dynamic SVG Icons vs. PNG Assets**
    Instead of relying on external static PNG assets for the Tier 3 brand logos, I created a utility to dynamically generate color-coded SVG strings mapped to the brand's initial. To prevent React from endlessly re-rendering the Google Maps `<Marker>` components upon every frame, these SVG strings are wrapped in a memory cache, guaranteeing stable object references and incredibly smooth map interactions.

## AI Usage
AI tools were utilized during the development of this project primarily for assistance with React component optimizations (memoizing the dynamic SVG generation to prevent re-renders) and configuring the exact CommonJS exports required by the `supercluster` spatial indexing library.
