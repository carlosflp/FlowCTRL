from fastapi import APIRouter

from app.modules.assets.router import router as assets_router
from app.modules.auth.router import router as auth_router
from app.modules.operations.router import router as operations_router
from app.modules.portfolios.router import router as portfolios_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(portfolios_router)
api_router.include_router(assets_router)
api_router.include_router(operations_router)

