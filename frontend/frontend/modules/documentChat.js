/** @module documentChat — Document upload UI and AI chat with source citations */

// Helper: get the auth token from wherever app.js stores it
function getToken() {
  return (typeof AUTH_TOKEN !== 'undefined' && AUTH_TOKEN)
    ? AUTH_TOKEN
    : localStorage.getItem('bionexus_token');
}

// Helper: escape HTML to prevent XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: minimal markdown → HTML
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}

// Helper: show toast notification (falls back to console if unavailable)
function toast(msg, type = 'info') {
  if (typeof showToast === 'function') showToast(msg, type);
  else console.log(`[${type}] ${msg}`);
}

// ═══════════════════════════════════════════════
//  DC — Document Chat controller
// ═══════════════════════════════════════════════
const DC = {
  currentDocId: null,
  pollingInterval: null,

  init() {
    this.bindUploadArea();
    this.bindChatInput();
    this.loadDocumentList().catch(() => {});
    console.log('[DC] Document Chat module initialized');
  },

  // ── Upload Area ────────────────────────────────
  bindUploadArea() {
    const dropzone = document.getElementById('doc-dropzone');
    const fileInput = document.getElementById('doc-file-input');
    if (!dropzone || !fileInput) {
      console.warn('[DC] Upload area elements not found — will retry on section show');
      return;
    }

    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) this.uploadFile(file);
    });
    // Clicking the dropzone opens the file picker
    dropzone.addEventListener('click', e => {
      // Don't bubble from inner buttons
      if (e.target === fileInput) return;
      fileInput.click();
    });
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this.uploadFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    });
  },

  async uploadFile(file) {
    const MAX_MB = 25;
    if (file.size > MAX_MB * 1024 * 1024) {
      return toast(`File too large. Max size: ${MAX_MB}MB`, 'error');
    }

    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      return toast('Unsupported file type. Use PDF, DOCX, PPTX, TXT, PNG or JPG.', 'error');
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('subject', document.getElementById('doc-subject-select')?.value || 'General');
    formData.append('doc_type', document.getElementById('doc-type-select')?.value || 'other');

    this.showUploadProgress(file.name);

    try {
      const token = getToken();
      if (!token) throw new Error('Not logged in. Please refresh and log in again.');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        // Do NOT set Content-Type — let the browser set multipart/form-data with boundary
        body: formData
      });

      let result;
      try { result = await res.json(); }
      catch { throw new Error(`Server error (${res.status}). Please try again.`); }

      if (!res.ok || result.error) throw new Error(result.error || `Upload failed (${res.status})`);

      toast('Document uploaded! Processing in background...', 'info');
      this.pollDocumentStatus(result.data.documentId, file.name);
    } catch (err) {
      this.hideUploadProgress();
      toast(err.message || 'Upload failed. Please try again.', 'error');
      console.error('[DC] Upload error:', err);
    }
  },

  pollDocumentStatus(docId, filename) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    let attempts = 0;
    this.pollingInterval = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(this.pollingInterval);
        toast('Processing timed out. Please try uploading again.', 'error');
        this.hideUploadProgress();
        return;
      }
      try {
        const token = getToken();
        const res = await fetch(`/api/documents/status/${docId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const { data } = await res.json();
        if (!data) return;

        if (data.status === 'ready') {
          clearInterval(this.pollingInterval);
          this.hideUploadProgress();
          toast(`"${filename}" is ready! Click it to ask questions.`, 'success');
          this.loadDocumentList();
          this.selectDocument(docId, filename);
        } else if (data.status === 'failed') {
          clearInterval(this.pollingInterval);
          this.hideUploadProgress();
          toast('Document processing failed. Please try re-uploading.', 'error');
          this.loadDocumentList();
        }
      } catch (err) {
        console.warn('[DC] Polling error:', err);
      }
    }, 5000);
  },

  // ── Document List ──────────────────────────────
  async loadDocumentList() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { data } = await res.json();
      this.renderDocumentList(data || []);
    } catch (err) {
      console.warn('[DC] Could not load document list:', err);
    }
  },

  renderDocumentList(docs) {
    const list = document.getElementById('doc-list');
    if (!list) return;

    if (!docs.length) {
      list.innerHTML = '<div class="doc-empty">No documents yet. Upload a file above to get started.</div>';
      return;
    }

    list.innerHTML = docs.map(doc => {
      const icon = { pdf: '📄', docx: '📝', pptx: '📊', txt: '📃', image: '🖼' }[doc.file_type] || '📁';
      const size = doc.page_count ? `${doc.page_count} pages` : doc.file_type.toUpperCase();
      const isActive = this.currentDocId === doc.id ? 'active' : '';
      const safeName = escapeHtml(doc.filename);
      const safeId   = escapeHtml(doc.id);

      return `
        <div class="doc-item glass-card ${isActive}" data-doc-id="${safeId}" data-doc-name="${safeName}">
          <div class="doc-icon">${icon}</div>
          <div class="doc-info">
            <div class="doc-name" title="${safeName}">${safeName}</div>
            <div class="doc-meta">${escapeHtml(doc.subject)} &bull; ${size} &bull;
              <span class="doc-status status-${doc.status}">${doc.status}</span>
            </div>
          </div>
          <div class="doc-actions">
            <button class="icon-btn doc-delete-btn" data-doc-id="${safeId}" title="Delete document" aria-label="Delete">&#x2715;</button>
          </div>
        </div>`;
    }).join('');

    // Attach click handlers via delegation (avoids CSP issues with inline onclick)
    list.querySelectorAll('.doc-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.doc-delete-btn')) return; // handled below
        this.selectDocument(item.dataset.docId, item.dataset.docName);
      });
    });
    list.querySelectorAll('.doc-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.deleteDocument(btn.dataset.docId);
      });
    });
  },

  async deleteDocument(docId) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    const token = getToken();
    await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (this.currentDocId === docId) {
      this.currentDocId = null;
      document.getElementById('doc-chat-section').style.display = 'none';
    }
    this.loadDocumentList();
    toast('Document deleted.', 'info');
  },

  // ── Chat Interface ─────────────────────────────
  selectDocument(docId, filename) {
    this.currentDocId = docId;
    const header = document.getElementById('doc-chat-header');
    const section = document.getElementById('doc-chat-section');
    const msgs = document.getElementById('doc-chat-messages');
    if (!header || !section || !msgs) return;

    header.textContent = `Chat: ${filename}`;
    section.style.display = 'flex';
    msgs.innerHTML = '';
    this.addSystemMessage('Document loaded. Ask any question — I will answer with exact page citations.');
    this.loadChatHistory(docId);

    // Highlight active doc
    document.querySelectorAll('.doc-item').forEach(el =>
      el.classList.toggle('active', el.dataset.docId === docId)
    );
  },

  bindChatInput() {
    const input = document.getElementById('doc-chat-input');
    const sendBtn = document.getElementById('doc-chat-send');
    if (!input || !sendBtn) return;

    sendBtn.addEventListener('click', () => this.sendQuestion());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendQuestion();
      }
    });
  },

  async sendQuestion() {
    const input = document.getElementById('doc-chat-input');
    const question = input?.value.trim();
    if (!question || !this.currentDocId) return;

    input.value = '';
    this.addUserMessage(question);
    this.addTypingIndicator();

    try {
      const token = getToken();
      const res = await fetch(`/api/documents/${this.currentDocId}/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });
      const { data, error } = await res.json();
      this.removeTypingIndicator();

      if (error) throw new Error(error);
      this.addAIMessage(data.answer, data.citations, data.confidence);
    } catch (err) {
      this.removeTypingIndicator();
      this.addSystemMessage(`Error: ${escapeHtml(err.message)}`);
    }
  },

  // ── Message Renderers ──────────────────────────
  addUserMessage(text) {
    this._append(`<div class="chat-msg user-msg"><div class="msg-bubble">${escapeHtml(text)}</div></div>`);
  },

  addAIMessage(answer, citations, confidence) {
    const citHtml = (citations && citations.length) ? `
      <div class="citation-block">
        <div class="citation-header">Sources ${confidence != null ? `(${confidence}% confidence)` : ''}</div>
        ${citations.map(c => `
          <div class="citation-item">
            <span class="citation-ref">[Source ${c.sourceIndex}${c.pageNumber ? ` — Page ${c.pageNumber}` : ''}]</span>
            <span class="citation-excerpt">${escapeHtml(c.excerpt)}</span>
          </div>`).join('')}
      </div>` : '';

    this._append(`
      <div class="chat-msg ai-msg">
        <div class="ai-avatar">AI</div>
        <div class="msg-body">
          <div class="msg-bubble">${formatMarkdown(answer)}</div>
          ${citHtml}
        </div>
      </div>`);
  },

  addTypingIndicator() {
    const el = document.createElement('div');
    el.id = 'dc-typing';
    el.className = 'chat-msg ai-msg';
    el.innerHTML = '<div class="ai-avatar">AI</div><div class="msg-bubble typing"><span></span><span></span><span></span></div>';
    document.getElementById('doc-chat-messages')?.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
  },

  removeTypingIndicator() { document.getElementById('dc-typing')?.remove(); },

  addSystemMessage(text) {
    this._append(`<div class="chat-msg system-msg"><div class="msg-bubble">${escapeHtml(text)}</div></div>`);
  },

  _append(html) {
    const c = document.getElementById('doc-chat-messages');
    if (!c) return;
    c.insertAdjacentHTML('beforeend', html);
    c.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  },

  showUploadProgress(filename) {
    const el = document.getElementById('upload-progress');
    const lbl = document.getElementById('upload-progress-label');
    if (lbl) lbl.textContent = `Uploading: ${filename}…`;
    if (el) el.style.display = 'flex';
  },

  hideUploadProgress() {
    const el = document.getElementById('upload-progress');
    if (el) el.style.display = 'none';
  },

  async loadChatHistory(docId) {
    try {
      const token = getToken();
      const res = await fetch(`/api/documents/${docId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { data } = await res.json();
      if (data?.length) {
        data.slice(0, 10).reverse().forEach(h => {
          this.addUserMessage(h.question);
          this.addAIMessage(h.answer, h.citations, null);
        });
      }
    } catch (err) {
      console.warn('[DC] Could not load history:', err);
    }
  }
};

// Make DC globally accessible (required since app.js calls showDashboardSection)
window.DC = DC;

// Auto-init: if DOM already ready, init now; otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DC.init());
} else {
  DC.init();
}
