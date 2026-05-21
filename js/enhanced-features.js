// Enhanced Features for Voice Note Studio

// Feature 1: Dark Mode Toggle
class DarkModeManager {
    constructor() {
        this.init();
    }
    
    init() {
        // Create dark mode toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'dark-mode-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        toggleBtn.onclick = () => this.toggle();
        document.querySelector('.nav-container').appendChild(toggleBtn);
        
        // Load saved preference
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === 'enabled') {
            this.enable();
        }
    }
    
    toggle() {
        if (document.body.classList.contains('dark-mode')) {
            this.disable();
        } else {
            this.enable();
        }
    }
    
    enable() {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
        document.querySelector('.dark-mode-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        this.showToast('Dark mode enabled', 'info');
    }
    
    disable() {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
        document.querySelector('.dark-mode-toggle').innerHTML = '<i class="fas fa-moon"></i>';
        this.showToast('Light mode enabled', 'info');
    }
    
    showToast(msg, type) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

// Feature 2: Search Notes
class SearchManager {
    constructor() {
        this.createSearchBar();
    }
    
    createSearchBar() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <input type="text" id="searchInput" placeholder="🔍 Search notes..." class="search-input">
            <div id="searchResults" class="search-results"></div>
        `;
        document.querySelector('.nav-container').appendChild(searchContainer);
        
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.search(e.target.value));
    }
    
    search(query) {
        if (!query || query.length < 2) {
            document.getElementById('searchResults').style.display = 'none';
            return;
        }
        
        const transcript = document.getElementById('transcriptArea');
        if (transcript && transcript.value) {
            const text = transcript.value.toLowerCase();
            const matches = [];
            const lines = text.split('\n');
            
            lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                    matches.push({ line: line.substring(0, 100), index: index });
                }
            });
            
            this.showResults(matches, query);
        }
    }
    
    showResults(matches, query) {
        const resultsDiv = document.getElementById('searchResults');
        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            resultsDiv.innerHTML = matches.map(match => `
                <div class="search-result-item" onclick="window.searchManager.jumpToLine(${match.index})">
                    <i class="fas fa-file-alt"></i>
                    <span>${match.line.replace(new RegExp(`(${query})`, 'gi'), '<mark>$1</mark>')}</span>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';
    }
    
    jumpToLine(lineIndex) {
        const transcript = document.getElementById('transcriptArea');
        if (transcript) {
            const lines = transcript.value.split('\n');
            let charCount = 0;
            for (let i = 0; i < lineIndex; i++) {
                charCount += lines[i].length + 1;
            }
            transcript.focus();
            transcript.setSelectionRange(charCount, charCount);
            transcript.scrollTop = (charCount / transcript.value.length) * transcript.scrollHeight;
            document.getElementById('searchResults').style.display = 'none';
            document.getElementById('searchInput').value = '';
        }
    }
}

// Feature 3: Save/Load Notes
class NoteStorage {
    constructor() {
        this.loadNoteList();
    }
    
    saveCurrentNote() {
        const transcript = document.getElementById('transcriptArea');
        if (!transcript || !transcript.value) {
            alert('No content to save');
            return;
        }
        
        const noteName = prompt('Enter note name:', `Note_${new Date().toLocaleString()}`);
        if (noteName) {
            const notes = JSON.parse(localStorage.getItem('voiceNotes') || '{}');
            notes[noteName] = {
                content: transcript.value,
                date: new Date().toISOString(),
                wordCount: transcript.value.split(/\s+/).length
            };
            localStorage.setItem('voiceNotes', JSON.stringify(notes));
            this.loadNoteList();
            this.showToast('Note saved successfully!', 'success');
        }
    }
    
    loadNoteList() {
        const notes = JSON.parse(localStorage.getItem('voiceNotes') || '{}');
        const noteList = document.getElementById('savedNotesList');
        if (noteList) {
            if (Object.keys(notes).length === 0) {
                noteList.innerHTML = '<p class="placeholder-text">No saved notes yet</p>';
            } else {
                noteList.innerHTML = Object.entries(notes).map(([name, data]) => `
                    <div class="saved-note-item" onclick="window.noteStorage.loadNote('${name}')">
                        <i class="fas fa-file-alt"></i>
                        <div>
                            <strong>${name}</strong>
                            <small>${new Date(data.date).toLocaleString()} (${data.wordCount} words)</small>
                        </div>
                        <button onclick="event.stopPropagation(); window.noteStorage.deleteNote('${name}')" class="delete-note">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('');
            }
        }
    }
    
    loadNote(name) {
        const notes = JSON.parse(localStorage.getItem('voiceNotes') || '{}');
        const note = notes[name];
        if (note) {
            const transcript = document.getElementById('transcriptArea');
            if (transcript) {
                transcript.value = note.content;
                finalTranscript = note.content;
                updateCharCount();
                this.showToast(`Loaded: ${name}`, 'success');
            }
        }
    }
    
    deleteNote(name) {
        if (confirm(`Delete "${name}"?`)) {
            const notes = JSON.parse(localStorage.getItem('voiceNotes') || '{}');
            delete notes[name];
            localStorage.setItem('voiceNotes', JSON.stringify(notes));
            this.loadNoteList();
            this.showToast('Note deleted', 'info');
        }
    }
    
    showToast(msg, type) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

// Feature 4: Export to Google Docs
async function exportToGoogleDocs() {
    const content = document.getElementById('transcriptArea').value;
    if (!content) {
        alert('No content to export');
        return;
    }
    
    // Create a Blob and trigger download as HTML (Google Docs can open HTML)
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Voice Notes Export</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
                h1 { color: #667eea; }
            </style>
        </head>
        <body>
            <h1>Voice Notes</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <hr>
            <div>${content.replace(/\n/g, '<br>')}</div>
        </body>
        </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url);
    showToast('Open in browser, then copy to Google Docs', 'info');
}

// Feature 5: Keyboard Shortcuts
class KeyboardShortcuts {
    constructor() {
        this.init();
    }
    
    init() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: Save note
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (window.noteStorage) {
                    window.noteStorage.saveCurrentNote();
                }
            }
            
            // Ctrl/Cmd + N: New note
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (confirm('Clear current note?')) {
                    document.getElementById('transcriptArea').value = '';
                    finalTranscript = '';
                    updateCharCount();
                    showToast('New note created', 'info');
                }
            }
            
            // Ctrl/Cmd + F: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
            
            // Ctrl/Cmd + Shift + R: Start/Stop recording
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                document.getElementById('recordBtn')?.click();
            }
            
            // Escape: Clear search
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    document.getElementById('searchResults').style.display = 'none';
                }
            }
        });
        
        this.showShortcutsHelp();
    }
    
    showShortcutsHelp() {
        const helpHtml = `
            <div class="shortcuts-help">
                <i class="fas fa-keyboard"></i>
                <div class="shortcuts-list">
                    <div><kbd>Ctrl+S</kbd> Save note</div>
                    <div><kbd>Ctrl+N</kbd> New note</div>
                    <div><kbd>Ctrl+F</kbd> Search</div>
                    <div><kbd>Ctrl+Shift+R</kbd> Record</div>
                    <div><kbd>Esc</kbd> Clear search</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', helpHtml);
    }
}

// Feature 6: Export Statistics
function exportStatistics() {
    const text = document.getElementById('transcriptArea').value;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const readingTime = Math.ceil(words.length / 200);
    
    const stats = {
        date: new Date().toISOString(),
        totalWords: words.length,
        totalSentences: sentences.length,
        uniqueWords: uniqueWords,
        readingTimeMinutes: readingTime,
        averageWordLength: (words.join('').length / words.length).toFixed(1),
        characterCount: text.length
    };
    
    const statsText = JSON.stringify(stats, null, 2);
    const blob = new Blob([statsText], { type: 'application/json' });
    saveAs(blob, `note_statistics_${Date.now()}.json`);
    showToast('Statistics exported!', 'success');
}

// Initialize all features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add saved notes section to the UI
    const analyticsCard = document.querySelector('.card:has(.tabs)');
    if (analyticsCard) {
        const savedNotesSection = document.createElement('div');
        savedNotesSection.className = 'card';
        savedNotesSection.innerHTML = `
            <div class="card-header">
                <h2 class="card-title">
                    <i class="fas fa-save"></i> Saved Notes
                </h2>
            </div>
            <div class="card-body">
                <button id="saveNoteBtn" class="btn-primary" style="width: 100%; margin-bottom: 1rem;">
                    <i class="fas fa-save"></i> Save Current Note
                </button>
                <div id="savedNotesList" class="saved-notes-list"></div>
            </div>
        `;
        analyticsCard.parentNode.insertBefore(savedNotesSection, analyticsCard);
    }
    
    // Add export statistics button
    const exportCard = document.querySelector('.card:has(.export-grid)');
    if (exportCard) {
        const statsBtn = document.createElement('button');
        statsBtn.className = 'btn-export-full';
        statsBtn.style.marginTop = '0.75rem';
        statsBtn.innerHTML = '<i class="fas fa-chart-line"></i> Export Statistics (JSON)';
        statsBtn.onclick = exportStatistics;
        exportCard.querySelector('.card-body').appendChild(statsBtn);
    }
    
    // Initialize features
    window.darkMode = new DarkModeManager();
    window.searchManager = new SearchManager();
    window.noteStorage = new NoteStorage();
    window.keyboardShortcuts = new KeyboardShortcuts();
    
    // Add save button event
    const saveBtn = document.getElementById('saveNoteBtn');
    if (saveBtn) {
        saveBtn.onclick = () => window.noteStorage.saveCurrentNote();
    }
    
    // Add Google Docs export button
    const exportGrid = document.querySelector('.export-grid');
    if (exportGrid) {
        const gdocsBtn = document.createElement('button');
        gdocsBtn.className = 'btn-export';
        gdocsBtn.innerHTML = '<i class="fab fa-google"></i> Google Docs';
        gdocsBtn.onclick = exportToGoogleDocs;
        exportGrid.appendChild(gdocsBtn);
    }
});
