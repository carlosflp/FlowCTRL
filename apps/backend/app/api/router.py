from fastapi import APIRouter

from app.modules.assets.router import router as assets_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.cashflow.router import router as cashflow_router
from app.modules.operations.router import router as operations_router
from app.modules.portfolios.router import router as portfolios_router
from app.modules.positions.router import router as positions_router
from app.modules.pricing.router import router as pricing_router
from app.modules.reports.router import router as reports_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(audit_router)
api_router.include_router(portfolios_router)
api_router.include_router(assets_router)
api_router.include_router(operations_router)
api_router.include_router(cashflow_router)
api_router.include_router(pricing_router)
api_router.include_router(positions_router)
api_router.include_router(reports_router)
api_router.include_router(users_router)
