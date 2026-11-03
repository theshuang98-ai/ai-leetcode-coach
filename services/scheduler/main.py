"""
AI LeetCode Scheduler — FastAPI Microservice

Handles:
- Spaced repetition scheduling (SM-2 algorithm)
- Problem recommendation engine
- Cron-based daily task generation

Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .scheduler import router as scheduler_router

app = FastAPI(
    title="AI LeetCode Scheduler",
    description="Spaced repetition scheduler and recommendation engine for AI LeetCode 私教",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scheduler_router, prefix="/api/scheduler")


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker / monitoring."""
    return {"status": "ok", "service": "scheduler"}


@app.get("/")
async def root():
    return {
        "service": "AI LeetCode Scheduler",
        "version": "0.1.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
