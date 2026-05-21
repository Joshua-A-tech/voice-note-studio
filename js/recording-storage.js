// Recording Storage System
class RecordingStorage {
    constructor() {
        this.recordings = [];
        this.currentRecordingId = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isAudioRecording = false;
        this.audioStream = null;
        this.init();
    }
    
    init() {
        this.createStorageUI();
        this.loadRecordings();
        this.setupAudioRecording();
    }
    
    createStorageUI() {
        // Add recordings library section to the page
        const studioContainer = document.querySelector('.studio-container');
        if (studioContainer) {
            const libraryHTML = `
                <div class="recordings-library">
                    <div class="recordings-header">
                        <h3><i class="fas fa-database"></i> Recording Library</h3>
                        <button id="refreshRecordingsBtn" class="icon-button">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                    <div id="recordingsList" class="recordings-list">
                        <div class="loading-spinner">Loading recordings...</div>
                    </div>
                </div>
            `;
            studioContainer.insertAdjacentHTML('afterbegin', libraryHTML);
        }
        
        // Add save recording button to transcript area
        const transcriptActions = document.querySelector('.transcript-actions');
        if (transcriptActions) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'icon-button';
            saveBtn.id = 'saveRecordingBtn';
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Note';
            saveBtn.onclick = () => this.saveCurrentRecording();
            transcriptActions.appendChild(saveBtn);
        }
        
        // Add audio recording toggle button
        const recordingControls = document.querySelector('.recording-controls');
        if (recordingControls) {
            const audioRecordBtn = document.createElement('button');
            audioRecordBtn.id = 'audioRecordBtn';
            audioRecordBtn.className = 'record-button audio-record';
            audioRecordBtn.innerHTML = '<i class="fas fa-circle"></i>';
            audioRecordBtn.title = 'Record Audio (save for playback)';
            audioRecordBtn.onclick = () => this.toggleAudioRecording();
            recordingControls.appendChild(audioRecordBtn);
        }
    }
    
    async setupAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioStream = stream;
            this.mediaRecorder = new MediaRecorder(stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.uploadAudio(audioBlob);
                this.audioChunks = [];
                showToast('Audio recording saved!', 'success');
            };
        } catch (err) {
            console.error('Could not access microphone:', err);
            showToast('Microphone access required for audio recording', 'warning');
        }
    }
    
    toggleAudioRecording() {
        if (this.isAudioRecording) {
            this.stopAudioRecording();
        } else {
            this.startAudioRecording();
        }
    }
    
    startAudioRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.audioChunks = [];
            this.mediaRecorder.start(1000); // Record in 1-second chunks
            this.isAudioRecording = true;
            const btn = document.getElementById('audioRecordBtn');
            if (btn) {
                btn.classList.add('recording');
                btn.innerHTML = '<i class="fas fa-stop"></i>';
                btn.style.background = '#ef4444';
            }
            showToast('Audio recording started...', 'info');
        }
    }
    
    stopAudioRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.isAudioRecording = false;
            const btn = document.getElementById('audioRecordBtn');
            if (btn) {
                btn.classList.remove('recording');
                btn.innerHTML = '<i class="fas fa-circle"></i>';
                btn.style.background = '';
            }
        }
    }
    
    async uploadAudio(audioBlob) {
        if (!this.currentRecordingId) {
            this.currentRecordingId = this.generateId();
        }
        
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording_${this.currentRecordingId}.webm`);
        formData.append('recording_id', this.currentRecordingId);
        
        try {
            const response = await fetch('/api/upload-audio', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                console.log('Audio uploaded successfully');
            }
        } catch (error) {
            console.error('Error uploading audio:', error);
        }
    }
    
    async saveCurrentRecording() {
        const transcript = document.getElementById('transcriptArea').value;
        if (!transcript.trim()) {
            showToast('No content to save', 'warning');
            return;
        }
        
        const title = prompt('Enter a title for this recording:', `Recording_${new Date().toLocaleString()}`);
        if (!title) return;
        
        const duration = this.calculateDuration();
        const tags = prompt('Enter tags (comma-separated):', 'meeting,notes');
        
        const recordingData = {
            recording_id: this.currentRecordingId || this.generateId(),
            title: title,
            transcript: transcript,
            duration: duration,
            tags: tags ? tags.split(',').map(t => t.trim()) : []
        };
        
        try {
            const response = await fetch('/api/save-recording', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordingData)
            });
            const result = await response.json();
            
            if (result.success) {
                this.currentRecordingId = result.recording_id;
                showToast('Recording saved successfully!', 'success');
                this.loadRecordings();
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            showToast('Error saving recording', 'error');
        }
    }
    
    async loadRecordings() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            if (data.success) {
                this.recordings = data.recordings;
                this.displayRecordings();
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
        }
    }
    
    displayRecordings() {
        const container = document.getElementById('recordingsList');
        if (!container) return;
        
        if (this.recordings.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No saved recordings yet</p><small>Save your first note to see it here</small></div>';
            return;
        }
        
        container.innerHTML = this.recordings.map(rec => `
            <div class="recording-item" data-id="${rec.id}">
                <div class="recording-info">
                    <i class="fas fa-file-alt"></i>
                    <div>
                        <strong>${this.escapeHtml(rec.title)}</strong>
                        <div class="recording-meta">
                            <span><i class="far fa-calendar"></i> ${new Date(rec.date).toLocaleString()}</span>
                            <span><i class="fas fa-clock"></i> ${this.formatDuration(rec.duration)}</span>
                            <span><i class="fas fa-file-word"></i> ${rec.word_count} words</span>
                        </div>
                        ${rec.tags && rec.tags.length > 0 ? `
                            <div class="recording-tags">
                                ${rec.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="icon-button load-recording" title="Load this recording">
                        <i class="fas fa-folder-open"></i>
                    </button>
                    <button class="icon-button export-recording" title="Export as TXT">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="icon-button delete-recording" title="Delete recording">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.load-recording').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = btn.closest('.recording-item');
                const id = item.dataset.id;
                this.loadRecording(id);
            });
        });
        
        container.querySelectorAll('.delete-recording').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = btn.closest('.recording-item');
                const id = item.dataset.id;
                this.deleteRecording(id);
            });
        });
        
        container.querySelectorAll('.export-recording').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = btn.closest('.recording-item');
                const id = item.dataset.id;
                this.exportRecording(id);
            });
        });
    }
    
    async loadRecording(id) {
        try {
            const response = await fetch(`/api/recording/${id}`);
            const data = await response.json();
            
            if (data.success) {
                const recording = data.recording;
                const transcriptArea = document.getElementById('transcriptArea');
                if (transcriptArea) {
                    transcriptArea.value = recording.transcript;
                    finalTranscript = recording.transcript;
                    updateCharCount();
                    showToast(`Loaded: ${recording.title}`, 'success');
                }
                
                // Switch to studio page
                if (typeof showPage === 'function') {
                    showPage('studio');
                }
            }
        } catch (error) {
            console.error('Error loading recording:', error);
            showToast('Error loading recording', 'error');
        }
    }
    
    async deleteRecording(id) {
        if (!confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/recording/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                showToast('Recording deleted successfully', 'success');
                this.loadRecordings();
            }
        } catch (error) {
            console.error('Error deleting recording:', error);
            showToast('Error deleting recording', 'error');
        }
    }
    
    async exportRecording(id) {
        try {
            const response = await fetch(`/api/export-recording/${id}?format=txt`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording_${id}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Recording exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting recording:', error);
            showToast('Error exporting recording', 'error');
        }
    }
    
    generateId() {
        return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    calculateDuration() {
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            const timeParts = timerDisplay.innerText.split(':');
            return parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
        }
        return 0;
    }
    
    formatDuration(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize recording storage when DOM is ready
let recordingStorage = null;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        recordingStorage = new RecordingStorage();
    }, 1000);
});
