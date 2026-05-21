// Voice Note Studio - Professional UI
// Configuration
const API_BASE = window.location.origin;
let ws = null;
let isRecording = false;
let finalTranscript = "";
let recognition = null;
let recordingStartTime = null;
let timerInterval = null;
let sentimentChart = null;

// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const transcriptArea = document.getElementById('transcriptArea');
const statusChip = document.getElementById('statusChip');
const timerDisplay = document.getElementById('timerDisplay');
const charCountSpan = document.getElementById('charCount');
const waveAnimation = document.getElementById('waveAnimation');
const confidenceSpan = document.getElementById('confidenceLevel');

// Helper function to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Toast notification
function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(message)}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Show modal dialog
function showInModal(title, content) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80%; overflow: auto; padding: 1.5rem;">
            <h3 style="margin-bottom: 1rem; color: #1e293b;">${escapeHtml(title)}</h3>
            <div style="line-height: 1.6; color: #475569; white-space: pre-wrap;">${escapeHtml(content)}</div>
            <button onclick="this.closest('div').parentElement.remove()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Initialize WebSocket
function initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/transcribe`);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        showToast('AI enhancement connected', 'success');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'enhanced') {
            console.log('AI enhanced:', data.text.substring(0, 50));
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };
}

// Update confidence display with visual indicator
function updateConfidenceDisplay(confidence) {
    if (!confidenceSpan) return;
    
    console.log('Confidence received:', confidence); // Debug log
    
    // Handle different confidence values
    let percentage = 0;
    let displayText = '';
    let color = '#64748b';
    
    if (confidence === undefined || confidence === null) {
        displayText = '-';
        color = '#64748b';
    } else if (confidence === 0) {
        displayText = 'Processing...';
        color = '#f59e0b';
    } else {
        percentage = Math.round(confidence * 100);
        displayText = `${percentage}%`;
        
        // Set color based on confidence level
        if (percentage >= 70) {
            color = '#10b981'; // Green for high
        } else if (percentage >= 40) {
            color = '#f59e0b'; // Orange for medium
        } else {
            color = '#ef4444'; // Red for low
        }
    }
    
    confidenceSpan.innerHTML = displayText;
    confidenceSpan.style.color = color;
    confidenceSpan.style.fontWeight = '600';
    
    // Add pulse animation
    confidenceSpan.style.animation = 'none';
    setTimeout(() => {
        confidenceSpan.style.animation = 'confidencePulse 0.3s ease';
    }, 10);
}

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function initSpeechRecognition() {
    if (!SpeechRecognition) {
        showToast('Speech recognition not supported in this browser', 'error');
        if (recordBtn) recordBtn.disabled = true;
        if (confidenceSpan) confidenceSpan.innerHTML = 'Not supported';
        return null;
    }
    
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.maxAlternatives = 1;
    
    recog.onstart = () => {
        console.log('🎤 Speech recognition started');
        isRecording = true;
        if (recordBtn) recordBtn.classList.add('recording');
        if (waveAnimation) waveAnimation.style.display = 'flex';
        if (statusChip) {
            statusChip.innerHTML = '<i class="fas fa-microphone-alt"></i> Recording...';
            statusChip.classList.add('recording');
        }
        if (confidenceSpan) {
            confidenceSpan.innerHTML = 'Listening...';
            confidenceSpan.style.color = '#f59e0b';
        }
        recordingStartTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        showToast('Recording started - speak clearly', 'info');
    };
    
    recog.onerror = (event) => {
        console.error('Speech error:', event.error);
        stopRecording();
        if (confidenceSpan) {
            confidenceSpan.innerHTML = 'Error';
            confidenceSpan.style.color = '#ef4444';
        }
        showToast(`Error: ${event.error}`, 'error');
    };
    
    recog.onend = () => {
        console.log('Speech recognition ended');
        if (isRecording) {
            stopRecording();
        }
    };
    
    recog.onresult = (event) => {
        let interim = "";
        let final = "";
        let highestConfidence = 0;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const confidence = result[0].confidence;
            
            // Track highest confidence in this batch
            if (confidence > highestConfidence) {
                highestConfidence = confidence;
            }
            
            if (result.isFinal) {
                final += result[0].transcript + " ";
                console.log(`Final: "${result[0].transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
            } else {
                interim += result[0].transcript;
                console.log(`Interim: "${result[0].transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
            }
        }
        
        // Update confidence display with the highest confidence from this batch
        if (highestConfidence > 0) {
            updateConfidenceDisplay(highestConfidence);
        } else if (final.length > 0 && highestConfidence === 0) {
            // If we have final text but confidence is 0, show a default value
            updateConfidenceDisplay(0.75); // Default to 75% for final text
        }
        
        if (final) {
            finalTranscript += final;
            if (transcriptArea) transcriptArea.value = finalTranscript + interim;
            updateStats();
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'transcript',
                    text: final,
                    enhance: true
                }));
            }
        } else if (interim) {
            if (transcriptArea) transcriptArea.value = finalTranscript + interim;
        }
        
        updateCharCount();
    };
    
    return recog;
}

function startRecording() {
    if (recognition) {
        recognition.stop();
    }
    recognition = initSpeechRecognition();
    if (recognition) {
        recognition.start();
    }
}

function stopRecording() {
    if (recognition) {
        recognition.stop();
        isRecording = false;
        if (recordBtn) recordBtn.classList.remove('recording');
        if (waveAnimation) waveAnimation.style.display = 'none';
        if (statusChip) {
            statusChip.innerHTML = '<i class="fas fa-check-circle"></i> Ready';
            statusChip.classList.remove('recording');
        }
        if (confidenceSpan) {
            confidenceSpan.innerHTML = '-';
            confidenceSpan.style.color = '#64748b';
        }
        if (timerInterval) clearInterval(timerInterval);
        if (timerDisplay) timerDisplay.innerText = "00:00:00";
        showToast('Recording stopped', 'info');
    }
}

function updateTimer() {
    if (!recordingStartTime) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    if (timerDisplay) timerDisplay.innerText = `${hrs}:${mins}:${secs}`;
}

function updateCharCount() {
    const text = transcriptArea ? transcriptArea.value : "";
    if (charCountSpan) charCountSpan.innerText = text.length.toLocaleString() + ' chars';
    updateStats();
}

function updateStats() {
    const text = transcriptArea ? transcriptArea.value : "";
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const readingTime = Math.ceil(words.length / 200);
    
    const wordCountElem = document.getElementById('wordCount');
    const sentenceCountElem = document.getElementById('sentenceCount');
    const uniqueWordsElem = document.getElementById('uniqueWords');
    const readingTimeElem = document.getElementById('readingTime');
    
    if (wordCountElem) wordCountElem.innerText = words.length.toLocaleString();
    if (sentenceCountElem) sentenceCountElem.innerText = sentences.length;
    if (uniqueWordsElem) uniqueWordsElem.innerText = uniqueWords.toLocaleString();
    if (readingTimeElem) readingTimeElem.innerText = readingTime;
}

// API call function
async function callAPI(endpoint, data, successMsg) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('API call failed');
        const result = await response.json();
        
        if (successMsg) showToast(successMsg, 'success');
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error: ' + error.message, 'error');
        return null;
    }
}

// Event Handlers
document.getElementById('scanBtn')?.addEventListener('click', async () => {
    const text = transcriptArea ? transcriptArea.value : "";
    if (!text.trim()) {
        showToast('No text to scan', 'warning');
        return;
    }
    
    const btn = document.getElementById('scanBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Processing...';
    btn.disabled = true;
    
    try {
        const result = await callAPI('/api/scan', { text: text, advanced: true }, 'AI scan complete!');
        if (result && result.cleaned_text && transcriptArea) {
            transcriptArea.value = result.cleaned_text;
            finalTranscript = result.cleaned_text;
            updateCharCount();
            
            if (result.keywords && result.keywords.length > 0) {
                const keywordsHtml = result.keywords.map(k => 
                    `<span class="keyword-tag">${escapeHtml(k)}</span>`
                ).join('');
                const keywordsCloud = document.getElementById('keywordsCloud');
                if (keywordsCloud) keywordsCloud.innerHTML = keywordsHtml;
            }
            
            if (result.action_items && result.action_items.length > 0) {
                const actionsHtml = result.action_items.map(a => 
                    `<div class="action-item">
                        <i class="fas fa-check-circle"></i>
                        <span>${escapeHtml(a)}</span>
                    </div>`
                ).join('');
                const actionsList = document.getElementById('actionsList');
                if (actionsList) actionsList.innerHTML = actionsHtml;
            }
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

document.getElementById('summarizeBtn')?.addEventListener('click', async () => {
    const text = transcriptArea ? transcriptArea.value : "";
    if (!text.trim()) {
        showToast('No text to summarize', 'warning');
        return;
    }
    
    const btn = document.getElementById('summarizeBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Processing...';
    btn.disabled = true;
    
    try {
        const result = await callAPI('/api/summarize', { text: text, length: 'medium' }, 'Summary generated!');
        if (result && result.summary) {
            showInModal('Summary', result.summary);
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

document.getElementById('sentimentBtn')?.addEventListener('click', async () => {
    const text = transcriptArea ? transcriptArea.value : "";
    if (!text.trim()) {
        showToast('No text to analyze', 'warning');
        return;
    }
    
    const btn = document.getElementById('sentimentBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Processing...';
    btn.disabled = true;
    
    try {
        const result = await callAPI('/api/sentiment', { text: text }, 'Sentiment analysis complete!');
        if (result) {
            const sentimentText = `Sentiment: ${result.label.toUpperCase()} (Polarity: ${result.polarity.toFixed(2)})`;
            const sentimentLabel = document.getElementById('sentimentLabel');
            if (sentimentLabel) sentimentLabel.innerHTML = sentimentText;
            
            if (sentimentChart) sentimentChart.destroy();
            const ctx = document.getElementById('sentimentChart')?.getContext('2d');
            if (ctx) {
                sentimentChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Positive', 'Neutral', 'Negative'],
                        datasets: [{
                            data: [
                                result.label === 'positive' ? 60 : 20,
                                result.label === 'neutral' ? 60 : 30,
                                result.label === 'negative' ? 60 : 20
                            ],
                            backgroundColor: ['#10b981', '#6b7280', '#ef4444']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: true }
                });
            }
            
            document.querySelector('[data-tab="sentiment"]')?.click();
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

document.getElementById('extractActionsBtn')?.addEventListener('click', async () => {
    const text = transcriptArea ? transcriptArea.value : "";
    if (!text.trim()) {
        showToast('No text to extract actions from', 'warning');
        return;
    }
    
    const btn = document.getElementById('extractActionsBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Processing...';
    btn.disabled = true;
    
    try {
        const result = await callAPI('/api/extract-actions', { text: text }, 'Actions extracted!');
        const actionsList = document.getElementById('actionsList');
        if (result && result.actions && result.actions.length > 0 && actionsList) {
            const actionsHtml = result.actions.map(a => 
                `<div class="action-item">
                    <i class="fas fa-check-circle"></i>
                    <span>${escapeHtml(a)}</span>
                </div>`
            ).join('');
            actionsList.innerHTML = actionsHtml;
            document.querySelector('[data-tab="actions"]')?.click();
        } else if (actionsList) {
            actionsList.innerHTML = '<p class="placeholder-text">No clear action items found</p>';
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Export functions
document.getElementById('exportTxtBtn')?.addEventListener('click', () => {
    const text = transcriptArea ? transcriptArea.value : "No content";
    const blob = new Blob([text], { type: 'text/plain' });
    saveAs(blob, `voice_notes_${Date.now()}.txt`);
    showToast('Exported as TXT', 'success');
});

document.getElementById('exportDocxBtn')?.addEventListener('click', () => {
    const content = transcriptArea ? transcriptArea.value : "No content";
    const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Voice Notes</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
            h1 { color: #3b82f6; }
            .meta { color: #666; margin-bottom: 2rem; }
        </style>
    </head>
    <body>
        <h1>Voice Transcription Notes</h1>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
        <div>${escapeHtml(content).replace(/\n/g, '<br>')}</div>
    </body>
    </html>`;
    const blob = htmlDocx.asBlob(html);
    saveAs(blob, `voice_notes_${Date.now()}.docx`);
    showToast('Exported as Word', 'success');
});

document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const text = transcriptArea ? transcriptArea.value : "No content";
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 10, 10);
    doc.save(`voice_notes_${Date.now()}.pdf`);
    showToast('Exported as PDF', 'success');
});

document.getElementById('exportMdBtn')?.addEventListener('click', () => {
    const text = transcriptArea ? transcriptArea.value : "No content";
    const wordCount = text.split(/\s+/).length;
    const md = `# Voice Notes\n\n**Date:** ${new Date().toLocaleString()}\n\n**Word Count:** ${wordCount}\n\n---\n\n${text}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    saveAs(blob, `voice_notes_${Date.now()}.md`);
    showToast('Exported as Markdown', 'success');
});

document.getElementById('clearTextBtn')?.addEventListener('click', () => {
    if (confirm('Clear all text? This action cannot be undone.')) {
        if (transcriptArea) transcriptArea.value = "";
        finalTranscript = "";
        updateCharCount();
        showToast('Cleared', 'info');
    }
});

document.getElementById('copyTextBtn')?.addEventListener('click', () => {
    if (transcriptArea) {
        transcriptArea.select();
        document.execCommand('copy');
        showToast('Copied to clipboard!', 'success');
    }
});

recordBtn?.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        const tabContent = document.getElementById(`${tabName}Tab`);
        if (tabContent) tabContent.style.display = 'block';
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Add animation keyframes to document
const style = document.createElement('style');
style.textContent = `
    @keyframes confidencePulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialize
initWebSocket();
updateCharCount();
if (transcriptArea) {
    transcriptArea.addEventListener('input', updateCharCount);
}

console.log('✅ Voice Note Studio initialized successfully');
console.log('💡 Click the microphone and start speaking to see confidence levels');
