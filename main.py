from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import json
import re
import uuid
from datetime import datetime
import os
from pathlib import Path

app = FastAPI(title="Advanced Voice Note AI Studio", version="2.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

# Create directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Store active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.transcription_history: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        session_id = str(uuid.uuid4())
        self.transcription_history[session_id] = []
        return session_id

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

manager = ConnectionManager()

# Models
class ScanRequest(BaseModel):
    text: str
    advanced: bool = True

class SummaryRequest(BaseModel):
    text: str
    length: str = "medium"

class SentimentRequest(BaseModel):
    text: str

# Advanced AI Text Processing Functions
def clean_text_advanced(text: str) -> dict:
    """Advanced text cleaning with AI enhancements"""
    original = text
    
    # Remove filler words
    fillers = r'\b(um|uh|ah|er|like|you know|actually|basically|literally|so|well|i mean|sort of|kind of)\b'
    cleaned = re.sub(fillers, '', text, flags=re.IGNORECASE)
    
    # Remove repeated words
    cleaned = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', cleaned, flags=re.IGNORECASE)
    
    # Fix spacing and punctuation
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = re.sub(r'\s+([.,!?;:])', r'\1', cleaned)
    
    # Capitalize sentences
    cleaned = re.sub(r'(^|\.\s+|\?\s+|\!\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), cleaned)
    
    # Add missing punctuation
    if cleaned and cleaned[-1] not in '.!?':
        cleaned += '.'
    
    # Extract keywords
    words = re.findall(r'\b[a-z]{4,}\b', cleaned.lower())
    from collections import Counter
    word_freq = Counter(words)
    keywords = [word for word, count in word_freq.most_common(10)]
    
    # Extract action items
    action_patterns = [
        r'(?:need to|should|must|have to|will|going to)\s+(\w+(?:\s+\w+)*)',
        r'(?:action item|task|todo):\s*(.+)'
    ]
    actions = []
    for pattern in action_patterns:
        matches = re.findall(pattern, cleaned, re.IGNORECASE)
        actions.extend(matches)
    actions = list(set([a.strip().capitalize() for a in actions if len(a) > 5]))[:5]
    
    return {
        "cleaned_text": cleaned,
        "stats": {
            "original_length": len(original),
            "cleaned_length": len(cleaned),
            "reduction": len(original) - len(cleaned)
        },
        "keywords": keywords,
        "action_items": actions
    }

def summarize_text(text: str, length: str = "medium") -> str:
    """Extractive text summarization"""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    if length == "short":
        ratio = 0.2
    elif length == "long":
        ratio = 0.5
    else:
        ratio = 0.3
    
    num_sentences = max(1, int(len(sentences) * ratio))
    
    # Simple scoring based on word frequency
    word_freq = {}
    for sent in sentences:
        words = re.findall(r'\b\w+\b', sent.lower())
        for word in words:
            if len(word) > 3:
                word_freq[word] = word_freq.get(word, 0) + 1
    
    sentence_scores = {}
    for i, sent in enumerate(sentences):
        words = re.findall(r'\b\w+\b', sent.lower())
        score = sum(word_freq.get(word, 0) for word in words) / max(len(words), 1)
        sentence_scores[i] = score
    
    top_indices = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
    top_indices.sort()
    
    summary = ' '.join(sentences[i] for i in top_indices)
    return summary

# API Endpoints
@app.get("/")
async def root():
    """Serve the main HTML interface"""
    return FileResponse("index.html")

@app.post("/api/scan")
async def scan_text(request: ScanRequest):
    """Advanced AI text scanning and enhancement"""
    try:
        result = clean_text_advanced(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize")
async def summarize(request: SummaryRequest):
    """Generate summary of transcribed text"""
    try:
        summary = summarize_text(request.text, request.length)
        return {
            "summary": summary,
            "original_length": len(request.text),
            "summary_length": len(summary),
            "compression_ratio": f"{len(summary)/len(request.text)*100:.1f}%"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sentiment")
async def analyze_sentiment(request: SentimentRequest):
    """Sentiment analysis on text"""
    try:
        # Simple keyword-based sentiment analysis
        positive_words = ["good", "great", "excellent", "amazing", "wonderful", "happy", "positive", "love", "best"]
        negative_words = ["bad", "terrible", "awful", "horrible", "sad", "negative", "poor", "hate", "worst"]
        
        text_lower = request.text.lower()
        pos_count = sum(1 for word in positive_words if word in text_lower)
        neg_count = sum(1 for word in negative_words if word in text_lower)
        
        total = pos_count + neg_count
        if total == 0:
            polarity = 0
            label = "neutral"
        else:
            polarity = (pos_count - neg_count) / total
            label = "positive" if polarity > 0.1 else "negative" if polarity < -0.1 else "neutral"
        
        return {
            "polarity": polarity,
            "subjectivity": 0.5,
            "label": label
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-actions")
async def extract_action_items(request: SentimentRequest):
    """Extract action items and tasks from notes"""
    try:
        action_patterns = [
            r'(?:need to|should|must|have to|will|going to)\s+(\w+(?:\s+\w+)*)',
            r'(?:action item|task|todo):\s*(.+)',
            r'(?:please|kindly)\s+(\w+(?:\s+\w+)*)',
            r'(?:next steps?|follow up):\s*(.+)'
        ]
        
        actions = []
        for pattern in action_patterns:
            matches = re.findall(pattern, request.text, re.IGNORECASE)
            actions.extend(matches)
        
        # Clean and deduplicate
        actions = list(set([a.strip().capitalize() for a in actions if len(a) > 5]))
        
        return {"actions": actions[:10], "count": len(actions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription"""
    session_id = await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "transcript":
                text = data.get("text", "")
                
                # Quick cleaning
                cleaned = re.sub(r'\b(um|uh|ah|er|like)\b', '', text, flags=re.IGNORECASE)
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                
                manager.transcription_history[session_id].append({
                    "timestamp": datetime.now().isoformat(),
                    "original": text,
                    "cleaned": cleaned
                })
                
                await manager.send_message(websocket, {
                    "type": "enhanced",
                    "text": cleaned,
                    "session_id": session_id
                })
            
            elif data.get("type") == "get_history":
                await manager.send_message(websocket, {
                    "type": "history",
                    "history": manager.transcription_history.get(session_id, [])
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
