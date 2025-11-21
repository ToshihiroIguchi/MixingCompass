"""
MixingCompass - Hansen Solubility Parameter Analysis Tool
FastAPI main application module
"""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.config import settings
from app.api import hsp_experimental, hsp_calculation, solvent_search, data_list, polymer_data, solvent_api

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Hansen Solubility Parameter Analysis Tool for Material Science",
    debug=settings.debug
)

@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start_time = time.time()
    print(f"REQUEST: {request.method} {request.url}", flush=True)
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    print(f"RESPONSE: {response.status_code} (took {process_time:.2f}ms)", flush=True)
    if "/api/solvents" in str(request.url):
        print(f"[MIDDLEWARE] /api/solvents TOTAL response time: {process_time:.2f}ms", flush=True)
    return response

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

# Setup templates
templates = Jinja2Templates(directory=settings.templates_dir)

# Include API routers
app.include_router(solvent_api.router, prefix="/api", tags=["Solvents"])
app.include_router(hsp_experimental.router, prefix="/api/hsp-experimental", tags=["HSP Experimental"])
app.include_router(hsp_calculation.router, prefix="/api/hsp-calculation", tags=["HSP Calculation"])
app.include_router(solvent_search.router, prefix="/api/solvent-search", tags=["Solvent Search"])
app.include_router(data_list.router, prefix="/api/data-list", tags=["Data List"])
app.include_router(polymer_data.router, prefix="/api/polymer-data", tags=["Polymer Data"])


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "app_name": settings.app_name,
            "version": settings.version
        }
    )


@app.get("/data-list", response_class=HTMLResponse)
async def data_list_page(request: Request):
    """Serve the data list management page"""
    return templates.TemplateResponse(
        "data_list.html",
        {
            "request": request,
            "app_name": settings.app_name,
            "version": settings.version
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.version
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )