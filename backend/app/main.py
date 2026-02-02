from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from app.config import settings
from app.api.v1.api import api_router
from app.database import create_db_and_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    # Startup
    print(f"Starting {app.title} v{app.version}")
    print(f"Debug mode: {settings.DEBUG}")
    create_db_and_tables()
    yield
    # Shutdown
    print(f"Shutting down {app.title}")


# Create FastAPI app
app = FastAPI(
    title="FastAPI Backend",
    description="FastAPI backend with SQLModel, Celery, and JWT authentication",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
os.makedirs("data", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.include_router(api_router, prefix="/api/v1")
