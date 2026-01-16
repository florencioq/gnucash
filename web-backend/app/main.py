from fastapi import FastAPI
from .routers.books import router as books_router
from .routers.commodities import router as commodities_router
from .routers.accounts import router as accounts_router

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(books_router, prefix="/books", tags=["books"])
app.include_router(commodities_router, prefix="/commodities", tags=["commodities"])
app.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
