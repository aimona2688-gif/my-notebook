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
  exportPdf: document.getElementById('export-pdf'),
  exportWord: document.getElementById('export-word'),
  exportHtml: document.getElementById('export-html'),
  exportTxt: document.getElementById('export-txt'),
  exportJson: document.getElementById('export-json'),

  // 圖表、截圖、螢幕擷取、復原與語音
  insertChartBtn: document.getElementById('insert-chart-btn'),
  screenshotBtn: document.getElementById('screenshot-btn'),
  screenCaptureBtn: document.getElementById('screen-capture-btn'),
  voiceInputBtn: document.getElementById('voice-input-btn'),
  customUndoBtn: document.getElementById('custom-undo-btn'),
  customRedoBtn: document.getElementById('custom-redo-btn'),
  chartModal: document.getElementById('chart-modal'),
  closeChartModal: document.getElementById('close-chart-modal'),
  cancelChartBtn: document.getElementById('cancel-chart-btn'),
  generateChartBtn: document.getElementById('generate-chart-btn')
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

  // 自訂超連結點擊行為 Prompt
  const toolbar = quill.getModule('toolbar');
  toolbar.addHandler('link', function(value) {
    if (value) {
      const href = prompt('請輸入超連結網址 (例如: https://www.google.com):');
      if (href) {
        let url = href.trim();
        if (!/^https?:\/\//i.test(url)) {
          url = 'https://' + url;
        }
        quill.format('link', url);
      }
    } else {
      quill.format('link', false);
    }
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

  // 🔄 復原 (Undo) 與 重做 (Redo) 歷史紀錄功能
  elements.customUndoBtn.addEventListener('click', () => {
    quill.history.undo();
  });

  elements.customRedoBtn.addEventListener('click', () => {
    quill.history.redo();
  });

  // 插入分隔線
  elements.insertHrBtn.addEventListener('click', () => {
    const range = quill.getSelection(true);
    quill.clipboard.dangerouslyPasteHTML(range.index, '<hr><p><br></p>');
  });

  // 插入圖表 Modal
  elements.insertChartBtn.addEventListener('click', () => {
    elements.chartModal.classList.remove('hidden');
  });

  const hideChartModal = () => elements.chartModal.classList.add('hidden');
  elements.closeChartModal.addEventListener('click', hideChartModal);
  elements.cancelChartBtn.addEventListener('click', hideChartModal);

  elements.generateChartBtn.addEventListener('click', () => {
    generateChartAndInsert();
    hideChartModal();
  });

  // 📸 一鍵筆記截圖產出長圖功能 (Screenshot)
  elements.screenshotBtn.addEventListener('click', async () => {
    if (!currentNoteId) return;
    const note = await db.notes.get(currentNoteId);
    const title = note ? (note.title || '筆記') : '筆記';

    try {
      elements.saveStatus.className = 'saving';
      elements.saveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 長圖截圖生成中...';

      const editorEl = document.getElementById('editor-container');

      const canvas = await html2canvas(editorEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.body.classList.contains('light-theme') ? '#ffffff' : '#1e293b'
      });

      canvas.toBlob((blob) => {
        saveAs(blob, `${title}_筆記截圖.png`);
        elements.saveStatus.className = 'saved';
        elements.saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 截圖已下載成功！';
      });
    } catch (err) {
      console.error('截圖失敗:', err);
      alert('截圖發生錯誤，請重試！');
      elements.saveStatus.className = 'saved';
      elements.saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 已儲存';
    }
  });

  // 🖥️ 擷取電腦螢幕/視窗畫面並直接插入筆記 (Screen Capture API)
  elements.screenCaptureBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('您的瀏覽器不支援直接螢幕擷取功能，建議使用 Chrome 或 Edge 瀏覽器！');
      return;
    }

    try {
      // 呼叫瀏覽器原生螢幕擷取選單
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();

      // 使用 Canvas 將影格轉換為圖片
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

      // 停止螢幕錄製串流
      track.stop();

      // 將擷取圖片插入 Quill 編輯器
      const base64Url = canvas.toDataURL('image/png');
      const range = quill.getSelection(true) || { index: quill.getLength() };
      quill.insertEmbed(range.index, 'image', base64Url);
      quill.setSelection(range.index + 1);
      triggerAutoSave();

      elements.saveStatus.className = 'saved';
      elements.saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 已成功插入螢幕截圖！';
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('螢幕擷取失敗:', err);
        alert('擷取螢幕失敗或取消擷取。');
      }
    }
  });
  let recognition = null;
  let isRecording = false;
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const range = quill.getSelection(true) || { index: quill.getLength() };
      quill.insertText(range.index, transcript + ' ');
      quill.setSelection(range.index + transcript.length + 1);
      triggerAutoSave();
    };

    recognition.onend = () => {
      isRecording = false;
      elements.voiceInputBtn.classList.remove('recording-active');
      elements.voiceInputBtn.title = '🎙️ 語音轉文字輸入';
    };

    elements.voiceInputBtn.addEventListener('click', () => {
      if (isRecording) {
        recognition.stop();
      } else {
        recognition.start();
        isRecording = true;
        elements.voiceInputBtn.classList.add('recording-active');
        elements.voiceInputBtn.title = '錄音中...請對麥克風說話';
      }
    });
  } else {
    elements.voiceInputBtn.addEventListener('click', () => {
      alert('您的瀏覽器不支援語音辨識功能，建議使用 Chrome 或 Safari 瀏覽器！');
    });
  }

  // 匯出功能監聽
  elements.exportPdf.addEventListener('click', (e) => {
    e.preventDefault();
    exportToPdf();
  });

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
    elements.pinNoteBtn.title = '已釘選（點擊取消釘選）';
  } else {
    elements.pinNoteBtn.classList.remove('active');
    elements.pinNoteBtn.innerHTML = '<i class="fa-solid fa-thumbtack" style="opacity: 0.4;"></i>';
    elements.pinNoteBtn.title = '點擊釘選這篇筆記';
  }
}

// 字數統計
function updateWordCount() {
  const text = quill.getText().trim();
  const count = text.length > 0 ? text.length : 0;
  elements.wordCountText.textContent = count;
}

// ==========================================================================
// 📄 匯出模組 (包含 PDF & Word 匯出)

// 匯出為 PDF 文件
async function exportToPdf() {
  if (!currentNoteId) return;
  const note = await db.notes.get(currentNoteId);
  if (!note) return;

  const noteTitle = note.title || '筆記';
  
  // 建立排版良好的臨時 HTML 元素供 PDF 轉換
  const tempDiv = document.createElement('div');
  tempDiv.style.padding = '20px';
  tempDiv.style.color = '#1e293b';
  tempDiv.style.fontFamily = "'Noto Sans TC', sans-serif";
  tempDiv.innerHTML = `
    <h1 style="font-size: 24px; color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 6px;">${escapeHtml(noteTitle)}</h1>
    <p style="color: #64748b; font-size: 12px; margin-bottom: 16px;">最後更新時間: ${formatDate(note.updatedAt)}</p>
    <div style="font-size: 14px; line-height: 1.6;">${note.content}</div>
  `;

  const opt = {
    margin:       10,
    filename:     `${noteTitle}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    elements.saveStatus.className = 'saving';
    elements.saveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PDF 匯出中...';
    
    await html2pdf().set(opt).from(tempDiv).save();

    elements.saveStatus.className = 'saved';
    elements.saveStatus.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 已儲存';
  } catch (err) {
    console.error('PDF 匯出失敗:', err);
    alert('PDF 匯出時發生錯誤，請稍後再試。');
  }
}

// 匯出為 Word (.docx)

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

// 動態生成 Chart.js 圖表並轉換為圖片插入 Quill 編輯器
function generateChartAndInsert() {
  const title = document.getElementById('chart-title-input').value.trim() || '統計圖表';
  const type = document.getElementById('chart-type-select').value;
  const labelsStr = document.getElementById('chart-labels-input').value.trim();
  const dataStr = document.getElementById('chart-data-input').value.trim();

  const labels = labelsStr.split(',').map(s => s.trim());
  const data = dataStr.split(',').map(s => parseFloat(s.trim()) || 0);

  if (labels.length === 0 || data.length === 0) {
    alert('請輸入有效的圖表項目與數據！');
    return;
  }

  // 隱藏的 Canvas 用於渲染圖表
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 600;
  tempCanvas.height = 350;
  tempCanvas.style.display = 'none';
  document.body.appendChild(tempCanvas);

  const colors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  new Chart(tempCanvas, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: title,
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18, weight: 'bold' }
        }
      }
    }
  });

  // 等待圖表繪製完成轉成 Image Base64
  setTimeout(() => {
    const chartBase64 = tempCanvas.toDataURL('image/png');
    document.body.removeChild(tempCanvas);

    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertEmbed(range.index, 'image', chartBase64);
    quill.setSelection(range.index + 1);
    triggerAutoSave();
  }, 300);
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
