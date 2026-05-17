from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import uvicorn
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from inference.filter import FilterEngine

app = FastAPI(title="GreenLink+ AI Microservice")
engine = FilterEngine()

class SensorPayload(BaseModel):
    node_id: str
    data: Dict[str, Any]

@app.post("/api/filter")
async def filter_data(payload: SensorPayload):
    try:
        filtered_data = engine.process_data(payload.node_id, payload.data)
        return {"status": "success", "filtered_data": filtered_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "GreenLink+ AI Filtering"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
