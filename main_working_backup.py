"""
Voice Note Studio - Working Backend
Optimized for your Python 3.14 environment
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
import json
import uuid
from datetime import datetime
from pathlib import Path
import asyncio
from collections import Counter

app = FastAPI(title="Voice Note Studio", version="3.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Serve static files
if Path("css").exists():
    app.mount("/css", StaticFiles(directory="css"), name="css")
if Path("js").exists():
    app.mount("/js", StaticFiles(directory="js"), name="js")

# WebSocket connection manager
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

# Request/Response Models
class ScanRequest(BaseModel):
    text: str
    advanced: bool = True

class SummaryRequest(BaseModel):
    text: str
    length: str = "medium"

class TextRequest(BaseModel):
    text: str

# AI Processing Functions
def clean_text_advanced(text: str) -> Dict[str, Any]:
    """Advanced text cleaning and enhancement"""
    original = text
    
    # Remove filler words and speech disfluencies
    fillers = r'\b(um|uh|ah|er|like|you know|actually|basically|literally|so|well|i mean|sort of|kind of|hmm|uhh)\b'
    cleaned = re.sub(fillers, '', text, flags=re.IGNORECASE)
    
    # Remove repeated words
    cleaned = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', cleaned, flags=re.IGNORECASE)
    
    # Fix spacing and punctuation
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = re.sub(r'\s+([.,!?;:])', r'\1', cleaned)
    
    # Capitalize sentences
    cleaned = re.sub(r'(^|\.\s+|\?\s+|\!\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), cleaned)
    
    # Add missing punctuation at the end if needed
    if cleaned and cleaned[-1] not in '.!?':
        cleaned += '.'
    
    # Extract keywords (words with 4+ letters that appear frequently)
    words = re.findall(r'\b[a-z]{4,}\b', cleaned.lower())
    word_freq = Counter(words)
    keywords = [word for word, count in word_freq.most_common(10)]
    
    # Extract potential action items
    action_patterns = [
        r'(?:need to|should|must|have to|will|going to)\s+(\w+(?:\s+\w+)*)',
        r'(?:action item|task|todo):\s*(.+)',
        r'(?:please|kindly|remember to)\s+(\w+(?:\s+\w+)*)'
    ]
    
    actions = []
    for pattern in action_patterns:
        matches = re.findall(pattern, cleaned, re.IGNORECASE)
        actions.extend([m.strip().capitalize() for m in matches if len(m) > 5])
    
    # Remove duplicates
    actions = list(dict.fromkeys(actions))[:5]
    
    return {
        "cleaned_text": cleaned,
        "stats": {
            "original_length": len(original),
            "cleaned_length": len(cleaned),
            "reduction": len(original) - len(cleaned),
            "reduction_percent": f"{(len(original) - len(cleaned)) / len(original) * 100:.1f}%" if original else "0%"
        },
        "keywords": keywords,
        "action_items": actions
    }

def summarize_text(text: str, length: str = "medium") -> str:
    """Extractive text summarization"""
    if not text or len(text) < 100:
        return text
    
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    # Determine number of sentences to keep
    if length == "short":
        ratio = 0.2
    elif length == "long":
        ratio = 0.5
    else:  # medium
        ratio = 0.3
    
    num_sentences = max(1, min(len(sentences), int(len(sentences) * ratio)))
    
    # Simple scoring based on word frequency
    word_freq = {}
    for sent in sentences:
        words = re.findall(r'\b\w+\b', sent.lower())
        for word in words:
            if len(word) > 3:
                word_freq[word] = word_freq.get(word, 0) + 1
    
    # Score each sentence
    sentence_scores = {}
    for i, sent in enumerate(sentences):
        words = re.findall(r'\b\w+\b', sent.lower())
        if words:
            score = sum(word_freq.get(word, 0) for word in words) / len(words)
            sentence_scores[i] = score
    
    # Get top sentences while preserving order
    if sentence_scores:
        top_indices = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
        top_indices.sort()
        summary = ' '.join(sentences[i] for i in top_indices)
        return summary
    
    # Fallback: return first few sentences
    return ' '.join(sentences[:num_sentences])

# API Endpoints
@app.get("/")
async def root():
    """Serve the main HTML interface"""
    if Path("index.html").exists():
        return FileResponse("index.html")
    return JSONResponse({"error": "index.html not found", "message": "Please ensure index.html exists in the current directory"})

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "3.0.0",
        "packages": {
            "fastapi": "installed",
            "websockets": "installed"
        }
    }

@app.post("/api/scan")
async def scan_text(request: ScanRequest):
    """Advanced AI text scanning and enhancement"""
    try:
        if not request.text or not request.text.strip():
            return JSONResponse({
                "cleaned_text": "",
                "stats": {"original_length": 0, "cleaned_length": 0, "reduction": 0},
                "keywords": [],
                "action_items": []
            })
        
        result = clean_text_advanced(request.text)
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scanning error: {str(e)}")

@app.post("/api/summarize")
async def summarize(request: SummaryRequest):
    """Generate summary of transcribed text"""
    try:
        if not request.text or not request.text.strip():
            return JSONResponse({
                "summary": "",
                "original_length": 0,
                "summary_length": 0,
                "compression_ratio": "0%"
            })
        
        summary = summarize_text(request.text, request.length)
        return JSONResponse({
            "summary": summary,
            "original_length": len(request.text),
            "summary_length": len(summary),
            "compression_ratio": f"{len(summary)/len(request.text)*100:.1f}%" if request.text else "0%"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")

@app.post("/api/sentiment")
async def analyze_sentiment(request: TextRequest):
    """Basic sentiment analysis"""
    try:
        if not request.text or not request.text.strip():
            return JSONResponse({"polarity": 0, "subjectivity": 0, "label": "neutral"})
        
        # Keyword-based sentiment
        positive_words = ["good", "great", "excellent", "amazing", "wonderful", "happy", "love", "best", "awesome", "fantastic", "perfect"]
        negative_words = ["bad", "terrible", "awful", "horrible", "sad", "hate", "worst", "poor", "disappointing", "awful", "terrible"]
        
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
        
        return JSONResponse({
            "polarity": round(polarity, 3),
            "subjectivity": 0.5,
            "label": label,
            "stats": {"positive_words": pos_count, "negative_words": neg_count}
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis error: {str(e)}")

@app.post("/api/extract-actions")
async def extract_action_items(request: TextRequest):
    """Extract action items and tasks from notes"""
    try:
        if not request.text or not request.text.strip():
            return JSONResponse({"actions": [], "count": 0})
        
        patterns = [
            r'(?:need to|should|must|have to|will|going to|would like to|wish to)\s+(\w+(?:\s+\w+)*)',
            r'(?:action item|task|todo|next step|follow up):\s*(.+)',
            r'(?:please|kindly|remember to|don\'t forget to)\s+(\w+(?:\s+\w+)*)',
            r'(?:plan to|prepare to|start|begin)\s+(\w+(?:\s+\w+)*)'
        ]
        
        actions = []
        for pattern in patterns:
            matches = re.findall(pattern, request.text, re.IGNORECASE)
            actions.extend([m.strip().capitalize() for m in matches if len(m) > 5])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_actions = []
        for action in actions:
            if action not in seen:
                seen.add(action)
                unique_actions.append(action)
        
        return JSONResponse({
            "actions": unique_actions[:10],
            "count": len(unique_actions)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action extraction error: {str(e)}")

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription enhancement"""
    session_id = await manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            if data.get("type") == "transcript":
                text = data.get("text", "")
                
                # Quick AI enhancement (lightweight cleaning)
                cleaned = re.sub(r'\b(um|uh|ah|er|like|you know)\b', '', text, flags=re.IGNORECASE)
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                
                # Store in history
                if session_id in manager.transcription_history:
                    manager.transcription_history[session_id].append({
                        "timestamp": datetime.now().isoformat(),
                        "original": text,
                        "cleaned": cleaned
                    })
                
                # Send enhanced version back
                await manager.send_message(websocket, {
                    "type": "enhanced",
                    "text": cleaned,
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat()
                })
            
            elif data.get("type") == "get_history":
                # Send transcription history
                history = manager.transcription_history.get(session_id, [])
                await manager.send_message(websocket, {
                    "type": "history",
                    "history": history[-50:]  # Last 50 entries
                })
            
            elif data.get("type") == "clear_history":
                # Clear history for this session
                if session_id in manager.transcription_history:
                    manager.transcription_history[session_id] = []
                await manager.send_message(websocket, {
                    "type": "history_cleared",
                    "session_id": session_id
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Run the application
if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🎙️  Voice Note Studio - Server Starting...")
    print("="*50)
    print(f"📂 Working directory: {Path.cwd()}")
    print(f"🌐 Server will run at: http://localhost:8000")
    print(f"📡 WebSocket endpoint: ws://localhost:8000/ws/transcribe")
    print("="*50)
    print("\n✅ Press Ctrl+C to stop the server\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
