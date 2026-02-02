from fastapi import APIRouter
from app.routers import auth, history, measurements, tasks, users, health

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(history.router)
api_router.include_router(measurements.router)
api_router.include_router(tasks.router)
api_router.include_router(users.router)
api_router.include_router(health.router)
