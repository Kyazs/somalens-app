import time
from app.celery_worker import celery_app


@celery_app.task(bind=True)
def process_numbers(self, numbers: list[int]):
    """
    Example task: Calculate sum of squares with progress tracking.

    Args:
        numbers: List of integers to process

    Returns:
        dict with result (sum of squares) and count
    """
    total = 0
    for i, num in enumerate(numbers):
        # Simulate work
        time.sleep(0.1)
        total += num**2
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={
                "current": i + 1,
                "total": len(numbers),
                "percent": int((i + 1) / len(numbers) * 100),
            },
        )

    return {"result": total, "count": len(numbers)}
