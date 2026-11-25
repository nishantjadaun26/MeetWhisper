from fastapi import APIRouter
from app.api.routes import auth, meetings, jobs, search

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["Meetings"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
