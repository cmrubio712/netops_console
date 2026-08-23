from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_status, routes_ssl, routes_deployments
from app.config import CORS_ORIGINS

app = FastAPI(title="NetOps Console API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(routes_status.router, prefix="/api")
app.include_router(routes_ssl.router, prefix="/api")
app.include_router(routes_deployments.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
