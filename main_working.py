from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
from pathlib import Path
import base64
import os
import uvicorn

app = FastAPI(title="Voice Note Studio with Storage", version="4.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
UPLOAD_DIR = Path("uploads")
AUDIO_DIR = Path("uploads/audio")
TRANSCRIPTS_DIR = Path("uploads/transcripts")

for dir_path in [UPLOAD_DIR, AUDIO_DIR, TRANSCRIPTS_DIR]:
    dir_path.mkdir(exist_ok=True)

# Serve static files
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Storage for recordings
recordings_db = {}

class RecordingMetadata(BaseModel):
    id: str
    title: str
    date: str
    duration: int
    transcript: str
    audio_path: Optional[str] = None
    word_count: int
    tags: List[str] = []

class SaveRecordingRequest(BaseModel):
    recording_id: str
    title: str
    transcript: str
    duration: int
    tags: List[str] = []

# API Endpoints
@app.get("/")
async def root():
    return FileResponse("index.html")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/save-recording")
async def save_recording(request: SaveRecordingRequest):
    """Save recording metadata"""
    try:
        recording_id = request.recording_id or str(uuid.uuid4())
        
        # Save transcript as text file
        transcript_path = TRANSCRIPTS_DIR / f"{recording_id}.txt"
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(request.transcript)
        
        # Calculate word count
        word_count = len(request.transcript.split())
        
        recording_data = {
            "id": recording_id,
            "title": request.title,
            "date": datetime.now().isoformat(),
            "duration": request.duration,
            "transcript": request.transcript,
            "transcript_path": str(transcript_path),
            "word_count": word_count,
            "tags": request.tags
        }
        
        recordings_db[recording_id] = recording_data
        
        # Also save to JSON file for persistence
        db_path = UPLOAD_DIR / "recordings_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                existing = json.load(f)
        else:
            existing = {}
        
        existing[recording_id] = recording_data
        with open(db_path, "w") as f:
            json.dump(existing, f, indent=2)
        
        return JSONResponse({
            "success": True,
            "recording_id": recording_id,
            "message": "Recording saved successfully"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-audio")
async def upload_audio(
    audio: UploadFile = File(...),
    recording_id: str = Form(...)
):
    """Save audio file"""
    try:
        # Save audio file
        file_extension = audio.filename.split('.')[-1]
        audio_filename = f"{recording_id}.{file_extension}"
        audio_path = AUDIO_DIR / audio_filename
        
        content = await audio.read()
        with open(audio_path, "wb") as f:
            f.write(content)
        
        # Update recording with audio path
        if recording_id in recordings_db:
            recordings_db[recording_id]["audio_path"] = str(audio_path)
            
            # Update JSON database
            db_path = UPLOAD_DIR / "recordings_db.json"
            if db_path.exists():
                with open(db_path, "r") as f:
                    existing = json.load(f)
                if recording_id in existing:
                    existing[recording_id]["audio_path"] = str(audio_path)
                    with open(db_path, "w") as f:
                        json.dump(existing, f, indent=2)
        
        return JSONResponse({
            "success": True,
            "audio_path": str(audio_path),
            "message": "Audio uploaded successfully"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recordings")
async def get_recordings():
    """Get all saved recordings"""
    try:
        # Load from JSON file
        db_path = UPLOAD_DIR / "recordings_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                recordings = json.load(f)
        else:
            recordings = {}
        
        # Convert to list and sort by date (newest first)
        recordings_list = list(recordings.values())
        recordings_list.sort(key=lambda x: x["date"], reverse=True)
        
        return JSONResponse({
            "success": True,
            "recordings": recordings_list
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recording/{recording_id}")
async def get_recording(recording_id: str):
    """Get specific recording"""
    try:
        db_path = UPLOAD_DIR / "recordings_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                recordings = json.load(f)
            
            if recording_id in recordings:
                return JSONResponse({
                    "success": True,
                    "recording": recordings[recording_id]
                })
        
        return JSONResponse({
            "success": False,
            "message": "Recording not found"
        }, status_code=404)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/recording/{recording_id}")
async def delete_recording(recording_id: str):
    """Delete a recording"""
    try:
        # Load existing recordings
        db_path = UPLOAD_DIR / "recordings_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                recordings = json.load(f)
            
            if recording_id in recordings:
                # Delete transcript file
                transcript_path = TRANSCRIPTS_DIR / f"{recording_id}.txt"
                if transcript_path.exists():
                    transcript_path.unlink()
                
                # Delete audio file if exists
                recording = recordings[recording_id]
                if "audio_path" in recording:
                    audio_path = Path(recording["audio_path"])
                    if audio_path.exists():
                        audio_path.unlink()
                
                # Remove from database
                del recordings[recording_id]
                
                # Save updated database
                with open(db_path, "w") as f:
                    json.dump(recordings, f, indent=2)
                
                return JSONResponse({
                    "success": True,
                    "message": "Recording deleted successfully"
                })
        
        return JSONResponse({
            "success": False,
            "message": "Recording not found"
        }, status_code=404)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export-recording/{recording_id}")
async def export_recording(recording_id: str, format: str = "txt"):
    """Export recording in different formats"""
    try:
        db_path = UPLOAD_DIR / "recordings_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                recordings = json.load(f)
            
            if recording_id in recordings:
                recording = recordings[recording_id]
                
                if format == "txt":
                    from fastapi.responses import Response
                    return Response(
                        content=recording["transcript"],
                        media_type="text/plain",
                        headers={"Content-Disposition": f"attachment; filename={recording['title']}.txt"}
                    )
                elif format == "json":
                    return JSONResponse(recording)
        
        raise HTTPException(status_code=404, detail="Recording not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "transcript":
                text = data.get("text", "")
                # Basic cleaning
                import re
                cleaned = re.sub(r'\b(um|uh|ah|er|like)\b', '', text, flags=re.IGNORECASE)
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                await websocket.send_json({
                    "type": "enhanced",
                    "text": cleaned
                })
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🎙️  Voice Note Studio Server Starting...")
    print("="*60)
    print(f"📁 Upload directory: {UPLOAD_DIR.absolute()}")
    print(f"🎵 Audio directory: {AUDIO_DIR.absolute()}")
    print(f"📄 Transcripts directory: {TRANSCRIPTS_DIR.absolute()}")
    print("="*60)
    print("\n✅ Server is running!")
    print("🌐 Open your browser at: http://localhost:8000")
    print("🛑 Press Ctrl+C to stop the server")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
