from typing import Annotated
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.user import User
from app.tasks.example import process_numbers
from app.celery_worker import celery_app

router = APIRouter(prefix="/tasks", tags=["tasks"])


class ProcessRequest(BaseModel):
    numbers: list[int]


class TaskResponse(BaseModel):
    task_id: str
    message: str = "Task submitted successfully"


class TaskStatusResponse(BaseModel):
    state: str
    result: dict | None = None
    progress: dict | None = None


@router.post(
    "/process", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED
)
async def submit_task(
    request: ProcessRequest, current_user: Annotated[User, Depends(get_current_user)]
):
    """Submit a background task to process numbers"""
    task = process_numbers.delay(request.numbers)
    return TaskResponse(task_id=task.id)


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str, current_user: Annotated[User, Depends(get_current_user)]
):
    """Get status and result of a background task"""
    task = celery_app.AsyncResult(task_id)

    response = TaskStatusResponse(state=task.state)

    if task.state == "PENDING":
        response.progress = None
    elif task.state == "PROGRESS":
        response.progress = task.info
    elif task.state == "SUCCESS":
        response.result = task.result
    elif task.state == "FAILURE":
        response.result = {"error": str(task.info)}

    return response
