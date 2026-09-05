import uvicorn
import os

if __name__ == "__main__":
    is_production = os.environ.get("SIPEDAS_DOMAIN") != ""
    uvicorn.run(
        "main:app",
        host="0.0.0.0" if is_production else "127.0.0.1",
        port=8000,
        reload=not is_production,
        reload_excludes=["hasil_ekstraksi_web/*", "uploads/*"] if not is_production else []
    )
