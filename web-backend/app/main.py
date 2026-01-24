from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.books import router as books_router
from .routers.commodities import router as commodities_router
from .routers.accounts import router as accounts_router

app = FastAPI()

# Enable CORS for local frontend dev (Vite default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(books_router, prefix="/books", tags=["books"])
app.include_router(commodities_router, prefix="/commodities", tags=["commodities"])
app.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
