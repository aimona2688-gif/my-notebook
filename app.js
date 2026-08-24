/**
 * Aura Note - Pure Client-side Rich Text Notebook Application
 * Features IndexedDB storage, Quill Rich Text Editor, Custom Image Insertion,
 * Drag-and-drop Image Upload, Full-text Search, Tag Filter, and Word (.docx) Export.
 */

// 初始化 IndexedDB 數據庫
const db = new Dexie('AuraNoteDB');
db.version(1).stores({
  notes: 'id, title, tags, isPinned, createdAt, updatedAt'
});

// 全局狀態
let currentNoteId = null;
let quill = null;
let saveTimeout = null;
let currentFilter = 'all';

// DOM 元素引用
const elements = {
  sidebar: document.getElementById('sidebar'),
  toggleSidebarBtn: document.getElementById('toggle-sidebar'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  newNoteBtn: document.getElementById('new-note-btn'),
  notesList: document.getElementById('notes-list'),
  emptyNotesMsg: document.getElementById('empty-notes-msg'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search'),
  countAll: document.getElementById('count-all'),
  countPinned: document.getElementById('count-pinned'),
  filterTabs: document.querySelectorAll('.tab-btn'),
  themeToggleBtn: document.getElementById('theme-toggle'),
  
  // 編輯器相關
  titleInput: document.getElementById('note-title-input'),
  tagsInput: document.getElementById('note-tags-input'),
  updatedTimeText: document.getElementById('note-updated-time'),
  wordCountText: document.getElementById('word-count'),
  saveStatus: document.getElementById('save-status'),
  pinNoteBtn: document.getElementById('pin-note-btn'),
  deleteNoteBtn: document.getElementById('delete-note-btn'),
  customImageBtn: document.getElementById('custom-image-btn'),
  insertHrBtn: document.getElementById('insert-hr-btn'),
  imageFileInput: document.getElementById('image-file-input'),
  dragDropOverlay: document.getElementById('drag-drop-overlay'),
  
  // 匯出按鈕
  exportWord: document.getElementById('export-word'),
  exportHtml: document.getElementById('export-html'),
  exportTxt: document.getElementById('export-txt'),
  exportJson: document.getElementById('export-json')
};

// 初始化應用程式
document.addEventListener('DOMContentLoaded', async () => {
  initQuillEditor();
  setupEventListeners();
  setupDragAndDrop();
  await loadNotesList();
  
  // 若資料庫為空，建立預設示範筆記
  const count = await db.notes.count();
  if (count === 0) {
    await createDemoNote();
  } else {
    // 載入第一篇筆記
    const firstNote = await db.notes.orderBy('updatedAt').reverse().first();
    if (firstNote) {
      await loadNoteToEditor(firstNote.id);
    }
  }
});

// 初始化 Quill 編輯器
function initQuillEditor() {
  quill = new Quill('#editor-container', {
    modules: {
      toolbar: '#toolbar-container'
    },
    placeholder: '從這裡開始記錄你的創意見解與筆記內容...',
    theme: 'snow'
  });

  // 監聽內容變動 -> 自動觸發儲存與計算字數
  quill.on('text-change', () => {
    updateWordCount();
    triggerAutoSave();
  });
}

// 建立示範筆記
async function createDemoNote() {
  const demoNote = {
    id: 'demo-note-' + Date.now(),
    title: '👋 歡迎使用 Aura Note 尊榮筆記本',
    content: `<h1>✨ 專屬於你的強大個人筆記工具</h1>
<p>這是一款結合高質感視覺介面、強大編輯功能與 <strong>Word (.docx) 匯出功能</strong> 的離線筆記軟體。</p>
<hr>
<h3>💡 核心功能指南：</h3>
<ul>
  <li><strong style="color: rgb(99, 102, 241);">字體與顏色調整</strong>：在上方工具列輕鬆變更字體大小、文字顏色與螢光筆畫線。</li>
  <li><strong style="color: rgb(16, 185, 129);">圖片插入功能</strong>：點擊工具列的 <i class="fa-solid fa-image"></i> 圖示上傳本地照片，或直接將圖片拖拽進編輯區！</li>
  <li><strong style="color: rgb(245, 158, 11);">一鍵匯出 Word</strong>：點擊右上角的「匯出檔案」按鈕，即可將包含樣式與圖片的筆記下載為標準 <code>.docx</code> Word 檔案。</li>
  <li><strong style="color: rgb(239, 68, 68);">全文搜尋</strong>：左側邊欄支援即時搜尋標題與內文關鍵字。</li>
</ul>
<p><br></p>
<p><em>提示：所有筆記數據皆安全保存在您的本地瀏覽器 IndexedDB 中，離線也能順暢使用！</em></p>`,
    tags: ['歡迎', '教學', 'Word匯出'],
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.notes.add(demoNote);
  await loadNotesList();
  await loadNoteToEditor(demoNote.id);
}

// 監聽事件註冊
function setupEventListeners() {
  // 側邊欄開關
  elements.toggleSidebarBtn.addEventListener('click', () => {
    elements.sidebar.classList.toggle('collapsed');
  });

  elements.mobileMenuBtn.addEventListener('click', () => {
    elements.sidebar.classList.toggle('collapsed');
  });

  // 新建筆記
  elements.newNoteBtn.addEventListener('click', () => createNewNote());

  // 標題與標籤變更觸發自動儲存
  elements.titleInput.addEventListener('input', triggerAutoSave);
  elements.tagsInput.addEventListener('change', triggerAutoSave);

  // 釘選切換
  elements.pinNoteBtn.addEventListener('click', async () => {
    if (!currentNoteId) return;
    const note = await db.notes.get(currentNoteId);
    if (note) {
      const updatedPinned = !note.isPinned;
      await db.notes.update(currentNoteId, { isPinned: updatedPinned });
      updatePinButtonUI(updatedPinned);
      await loadNotesList();
    }
  });

  // 刪除筆記
  elements.deleteNoteBtn.addEventListener('click', async () => {
    if (!currentNoteId) return;
    if (confirm('確定要刪除這篇筆記嗎？此操作無法復原。')) {
      await db.notes.delete(currentNoteId);
      currentNoteId = null;
      await loadNotesList();
      const nextNote = await db.notes.orderBy('updatedAt').reverse().first();
      if (nextNote) {
        await loadNoteToEditor(nextNote.id);
      } else {
        createNewNote();
      }
    }
  });

  // 搜尋功能
  elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    elements.clearSearchBtn.classList.toggle('hidden', query === '');
    loadNotesList(query);
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearchBtn.classList.add('hidden');
    loadNotesList();
  });

  // 分頁切換 (全部/釘選)
  elements.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      loadNotesList(elements.searchInput.value.trim());
    });
  });

  // 主題切換 (深色/淺色)
  elements.themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    elements.themeToggleBtn.innerHTML = isLight 
      ? '<i class="fa-solid fa-sun"></i> 淺色模式' 
      : '<i class="fa-solid fa-moon"></i> 深色模式';
  });

  // 插入圖片按鈕觸發
  elements.customImageBtn.addEventListener('click', () => {
    elements.imageFileInput.click();
  });

  elements.imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      insertImageFile(file);
      elements.imageFileInput.value = '';
    }
  });

  // 插入分隔線
  elements.insertHrBtn.addEventListener('click', () => {
    const range = quill.getSelection(true);
    quill.clipboard.dangerouslyPasteHTML(range.index, '<hr><p><br></p>');
  });

  // 匯出功能監聽
  elements.exportWord.addEventListener('click', (e) => {
    e.preventDefault();
    exportToWord();
  });

  elements.exportHtml.addEventListener('click', (e) => {
    e.preventDefault();
    exportToHtml();
  });

  elements.exportTxt.addEventListener('click', (e) => {
    e.preventDefault();
    exportToTxt();
  });

  elements.exportJson.addEventListener('click', (e) => {
    e.preventDefault();
    exportToJson();
  });
}

// 拖拽圖片處理 (Drag and Drop)
function setupDragAndDrop() {
  const container = document.querySelector('.main-content');

  ['dragenter', 'dragover'].forEach(eventName => {
    container.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.dragDropOverlay.classList.remove('hidden');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (eventName === 'drop' || (e.target === elements.dragDropOverlay)) {
        elements.dragDropOverlay.classList.add('hidden');
      }
    }, false);
  });

  container.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          insertImageFile(files[i]);
        }
      }
    }
  });
}

// 插入本地圖片至編輯器 (轉為 Base64 URI 以確保全平台相容與可打包至 Word)
function insertImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Url = e.target.result;
    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertEmbed(range.index, 'image', base64Url);
    quill.setSelection(range.index + 1);
    triggerAutoSave();
  };
  reader.readAsDataURL(file);
}

// 新增空白筆記
async function createNewNote() {
  const newNote = {
    id: 'note-' + Date.now(),
    title: '未命名筆記',
    content: '<p><br></p>',
    tags: [],
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.notes.add(newNote);
  await loadNotesList();
  await loadNoteToEditor(newNote.id);
  elements.titleInput.focus();
  elements.titleInput.select();
}

// 載入特定筆記至編輯器
async function loadNoteToEditor(id) {
  currentNoteId = id;
  const note = await db.notes.get(id);
  if (!note) return;

  // 設置標題與標籤
  elements.titleInput.value = note.title || '';
  elements.tagsInput.value = note.tags ? note.tags.join(', ') : '';
  
  // 載入 Quill 內容
  quill.clipboard.dangerouslyPasteHTML(note.content || '<p><br></p>');

  // 更新 UI 狀態
  updatePinButtonUI(note.isPinned);
  elements.updatedTimeText.textContent = formatDate(note.updatedAt);
  updateWordCount();
  highlightActiveNoteInList(id);
}

// 觸發自動儲存
function triggerAutoSave() {
  if (!currentNoteId) return;

  elements.saveStatus.className = 'saving';
  elements.saveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 儲存中...';

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveCurrentNote();
  }, 800);
}

// 儲存當前筆記至 IndexedDB
async function saveCurrentNote() {
  if (!currentNoteId) return;

  const title = elements.titleInput.value.trim() || '未命名筆記';
  const content = quill.root.innerHTML;
  const rawTags = elements.tagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
  const updatedAt = new Date().toISOString();

  await db.notes.update(currentNoteId, {
    title: title,
    content: content,
    tags: rawTags,
    updatedAt: updatedAt
  });

  elements.saveStatus.className = 'saved';
  elements.saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 已儲存';
  elements.updatedTimeText.textContent = formatDate(updatedAt);

  // 刷新側邊欄標題/預覽
  await loadNotesList(elements.searchInput.value.trim());
}

// 載入側邊欄筆記清單
async function loadNotesList(searchQuery = '') {
  let query = db.notes.orderBy('updatedAt').reverse();
  let notes = await query.toArray();

  // 計算數量
  const totalCount = notes.length;
  const pinnedCount = notes.filter(n => n.isPinned).length;
  elements.countAll.textContent = totalCount;
  elements.countPinned.textContent = pinnedCount;

  // 分頁篩選
  if (currentFilter === 'pinned') {
    notes = notes.filter(n => n.isPinned);
  }

  // 搜尋關鍵字篩選
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    notes = notes.filter(n => {
      const matchTitle = n.title.toLowerCase().includes(q);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = n.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const matchContent = textContent.toLowerCase().includes(q);
      const matchTags = n.tags && n.tags.some(tag => tag.toLowerCase().includes(q));
      return matchTitle || matchContent || matchTags;
    });
  }

  // 將釘選筆記排在前列
  notes.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  // 渲染 DOM
  elements.notesList.innerHTML = '';
  if (notes.length === 0) {
    elements.emptyNotesMsg.classList.remove('hidden');
  } else {
    elements.emptyNotesMsg.classList.add('hidden');
    notes.forEach(note => {
      const li = document.createElement('li');
      li.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
      li.setAttribute('data-id', note.id);

      // 純文字預覽提取
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = note.content;
      const previewText = tempDiv.textContent || tempDiv.innerText || '無內容...';

      const tagsHtml = note.tags && note.tags.length > 0 
        ? note.tags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('') 
        : '';

      li.innerHTML = `
        <div class="note-item-header">
          <span class="note-item-title">${escapeHtml(note.title)}</span>
          ${note.isPinned ? '<i class="fa-solid fa-thumbtack pin-badge"></i>' : ''}
        </div>
        <div class="note-item-preview">${escapeHtml(previewText)}</div>
        <div class="note-item-meta">
          <span>${formatDate(note.updatedAt)}</span>
          <div class="note-tags-badge">${tagsHtml}</div>
        </div>
      `;

      li.addEventListener('click', () => loadNoteToEditor(note.id));
      elements.notesList.appendChild(li);
    });
  }
}

// 標示當前選擇的筆記
function highlightActiveNoteInList(id) {
  document.querySelectorAll('.note-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-id') === id);
  });
}

// 更新釘選按鈕狀態
function updatePinButtonUI(isPinned) {
  if (isPinned) {
    elements.pinNoteBtn.classList.add('active');
    elements.pinNoteBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    elements.pinNoteBtn.title = '取消釘選';
  } else {
    elements.pinNoteBtn.classList.remove('active');
    elements.pinNoteBtn.innerHTML = '<i class="fa-regular fa-thumbtack"></i>';
    elements.pinNoteBtn.title = '釘選這篇筆記';
  }
}

// 字數統計
function updateWordCount() {
  const text = quill.getText().trim();
  const count = text.length > 0 ? text.length : 0;
  elements.wordCountText.textContent = count;
}

// ==========================================================================
// 📄 匯出模組 (包含核心 Word .docx 匯出)
// ==========================================================================

// 匯出為 Word (.docx)
async function exportToWord() {
  if (!currentNoteId) return;
  const note = await db.notes.get(currentNoteId);
  if (!note) return;

  const noteTitle = note.title || '筆記';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(noteTitle)}</title>
      <style>
        body { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; line-height: 1.6; padding: 20px; }
        h1 { color: #1e293b; font-size: 24pt; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
        h2 { color: #334155; font-size: 18pt; }
        h3 { color: #475569; font-size: 14pt; }
        p { font-size: 12pt; color: #334155; }
        blockquote { border-left: 4px solid #6366f1; padding-left: 10px; color: #64748b; font-style: italic; }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #cbd5e1; padding: 8px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(noteTitle)}</h1>
      <p style="color: #64748b; font-size: 10pt;">最後修改時間: ${formatDate(note.updatedAt)}</p>
      <hr>
      ${note.content}
    </body>
    </html>
  `;

  try {
    // 使用 html-docx-js 轉碼打包為原生 Word 二進位檔
    const converted = htmlDocx.asBlob(htmlContent);
    saveAs(converted, `${noteTitle}.docx`);
  } catch (err) {
    console.error('Word 匯出失敗:', err);
    alert('匯出 Word 檔案時發生錯誤，將為您切換為 HTML 下載。');
    exportToHtml();
  }
}

// 匯出為 HTML
async function exportToHtml() {
  const note = await db.notes.get(currentNoteId);
  if (!note) return;
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title></head><body><h1>${escapeHtml(note.title)}</h1>${note.content}</body></html>`;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${note.title || '筆記'}.html`);
}

// 匯出為 TXT
async function exportToTxt() {
  const note = await db.notes.get(currentNoteId);
  if (!note) return;
  const text = `${note.title}\n${'='.repeat(20)}\n\n${quill.getText()}`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${note.title || '筆記'}.txt`);
}

// 備份全數據為 JSON
async function exportToJson() {
  const allNotes = await db.notes.toArray();
  const jsonStr = JSON.stringify(allNotes, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  saveAs(blob, `AuraNote_Backup_${new Date().toISOString().slice(0, 10)}.json`);
}

// 輔助函式: 時間格式化
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// 輔助函式: HTML 轉義
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}
