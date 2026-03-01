from fastapi import APIRouter
from app.routers import auth, history, measurements, tasks, users, health, recommendations
from app.routers import medical_conditions

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(history.router)
api_router.include_router(measurements.router)
api_router.include_router(tasks.router)
api_router.include_router(users.router)
api_router.include_router(health.router)
api_router.include_router(recommendations.router)
api_router.include_router(medical_conditions.router)
