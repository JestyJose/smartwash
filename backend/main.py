from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import cv2
import numpy as np
import base64
import time

try:
    from .app import inferance
    from .utils.frame_combiner import combine_frames
except (ImportError, ValueError):
    from app import inferance
    from utils.frame_combiner import combine_frames

app = FastAPI(title="Smart Wash AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Preload model once at module initialization so it does not reload on each connection
print("[FastAPI] Initializing YOLO handwashing classification model...")
infr = inferance()
print("[FastAPI] Model loaded successfully!")

@app.websocket("/ws_model")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[FastAPI] WebSocket client connected")

    try:
        while True:
            frame_data = await websocket.receive_text()
            if not frame_data:
                continue
                
            # Remove the data URL prefix if present
            if ',' in frame_data:
                _, encoded = frame_data.split(',', 1)
            else:
                encoded = frame_data
                
            nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is not None:
                timestamp = time.time() * 1000
                result = infr.predict(frame)
                
                await websocket.send_json({
                    "timestamp": timestamp,
                    "prediction": result
                })
    except Exception as e:
        print(f"[FastAPI] WebSocket closed/error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass
        print("[FastAPI] WebSocket client disconnected")

@app.get("/")
async def root():
    return {"message": "Classification server is running", "model": "YOLOv11 Handwashing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=4550, reload=False)

