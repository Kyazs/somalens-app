# SomaLens Frontend

React-based frontend for the SomaLens somatotype analysis application.

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool with HMR
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Zustand** - State management
- **React Router 7** - Navigation
- **Recharts** - Data visualization

## Prerequisites

- Node.js 20+
- npm or yarn

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production (TypeScript check + Vite build) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests with Vitest |

## Environment Variables

Create a `.env` file in the frontend directory if needed:

```env
# For local development (default if not set)
VITE_API_URL=http://localhost:8000/api/v1
```

> **Note**: In Docker, this is automatically set to `/api/v1` during the build process, since Nginx proxies API requests to the backend.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route page components
├── stores/         # Zustand state stores
├── services/       # API client and services
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
└── types/          # TypeScript type definitions
```

## Docker

The frontend includes a Dockerfile for production deployment:

```bash
# Build image
docker build -t somalens-frontend .

# Run container
docker run -p 3000:80 somalens-frontend
```

The production build is served via Nginx on port 80.

## Connecting to Backend

### Local Development
The frontend makes direct API calls to `http://localhost:8000/api/v1` via CORS. No proxy is configured in Vite.

Ensure the backend is running:
```bash
cd ../backend
uvicorn app.main:app --reload
```

### Docker Compose (Production)
In Docker, Nginx proxies `/api/` requests to the backend container via internal networking. The `VITE_API_URL` is set to `/api/v1` during build, so API calls are relative paths that Nginx routes correctly.
