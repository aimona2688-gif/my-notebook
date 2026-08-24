# 📘 全功能 Web 筆記本軟體開發與 GitHub 部署完整指南 (Developer Tutorial)

這是一份完整的零基礎教學筆記，記錄了我們如何從頭打造 **Aura Note 尊榮個人筆記本**、加入多項高級功能，並免費發布至 **GitHub Pages** 與安裝為 **手機 PWA App** 的完整流程。

---

## 📑 目錄
1. [專案核心功能與技術選型](#1-專案核心功能與技術選型)
2. [第一階段：筆記本前端架構設計](#2-第一階段筆記本前端架構設計)
3. [第二階段：實作進階功能模組](#3-第二階段實作進階功能模組)
4. [第三階段：發布至 GitHub Pages 免費雲端](#4-第三階段發布至-github-pages-免費雲端)
5. [第四階段：手機 PWA (Web App) 隨身帶著走](#5-第四階段手機-pwa-web-app-隨身帶著走)
6. [日後維護與跨裝置資料同步技巧](#6-日後維護與跨裝置資料同步技巧)

---

## 1. 專案核心功能與技術選型

在開始寫程式前，我們先確立了軟體的核心需求與對應採用的開放原始碼程式庫（JS Libraries）：

| 功能需求 | 技術選型 / 工具庫 | 說明 |
| :--- | :--- | :--- |
| **富文本編輯器** | **Quill.js** | 支援字體大小、文字顏色、畫線背景、粗斜體、列表與圖片上傳 |
| **本地離線數據庫** | **Dexie.js (IndexedDB)** | 安全地將筆記與 Base64 圖片完整儲存在使用者本地瀏覽器中 |
| **Word 檔案匯出** | **html-docx-js + FileSaver.js** | 一鍵打包 HTML 與樣式為標準 `.docx` 文件 |
| **PDF 文件匯出** | **html2pdf.js** | 將筆記樣式精準轉化為高畫質 A4 PDF 文件 |
| **動態統計圖表** | **Chart.js** | 輸入數據自動繪製圓餅圖、長條圖、折線圖並插入筆記 |
| **語音轉文字** | **Web Speech API** | 點擊麥克風即可進行廣東話/繁體中文語音輸入 |
| **螢幕/畫面擷取** | **Screen Capture API + html2canvas**| 支援擷取電腦視窗畫面，或將筆記產出為高清 PNG 截圖 |

---

## 2. 第一階段：筆記本前端架構設計

專案主要由 5 個核心檔案組成：

- `index.html`：網頁 UI 結構與第三方庫 CDN 引用。
- `styles.css`：質感深色模式、CSS 變數、自適應響應式 (RWD) 樣式。
- `app.js`：所有的邏輯控制（編輯器初始化、IndexedDB 讀寫、匯出、搜尋）。
- `manifest.json`：PWA 手機 App 圖示與主題顏色配置。
- `sw.js` (Service Worker)：離線快取檔案，確保沒網路也能開啟 App。

---

## 3. 第二階段：實作進階功能模組

### 核心 1：本地圖片拖拽與插入 (`app.js`)
利用 HTML5 FileReader API 將圖片檔案轉碼為 Data URL (Base64) 格式，直接插入 Quill 編輯器中，確保全平台可讀且可打包進 Word：
```javascript
function insertImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Url = e.target.result;
    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertEmbed(range.index, 'image', base64Url);
    quill.setSelection(range.index + 1);
  };
  reader.readAsDataURL(file);
}
```

### 核心 2：Word (.docx) 匯出打包
利用 `html-docx-js` 將編輯器的 HTML 與 CSS 樣式打包成二進位 Blob，並透過 `FileSaver.js` 下載：
```javascript
const converted = htmlDocx.asBlob(htmlContent);
saveAs(converted, `${noteTitle}.docx`);
```

---

## 4. 第三階段：發布至 GitHub Pages 免費雲端

只需 4 個步驟，將本地檔案變成全網可存取的免費專屬網站：

### 步驟 1：建立 GitHub 儲存庫
1. 登入 [GitHub.com](https://github.com/) ➔ 點擊右上角 `+` ➔ 選擇 **New repository**。
2. 命名為 `my-notebook` ➔ 確認設定為 **Public** ➔ 點擊 **Create repository**。

### 步驟 2：上傳專案檔案
1. 點擊 **uploading an existing file**。
2. 將電腦資料夾中的 5 個核心檔案（`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`）拖拉上傳。
3. 點擊綠色的 **Commit changes**。

### 步驟 3：開啟 GitHub Pages 免費託管
1. 在專案頁面點擊 **Settings** (齒輪圖示)。
2. 左側欄點擊 **Pages**。
3. 在 **Build and deployment** 選擇 **Branch: `main`** ➔ 點擊 **Save**。
4. 約 1 分鐘後，即可取得專屬網址：`https://您的帳號.github.io/my-notebook/`

---

## 5. 第四階段：手機 PWA (Web App) 隨身帶著走

### 🍎 iPhone / iPad (iOS Safari)
1. 用 Safari 打開您的 GitHub Pages 網址。
2. 點擊畫面正下方中間的 **分享按鈕 📤**。
3. 選擇 **「新增至主畫面」 (Add to Home Screen)** ➔ 點擊新增。

### 🤖 Android 手機 / 平板 (Chrome)
1. 用 Chrome 打開您的 GitHub Pages 網址。
2. 點擊右上角 **三個點選單 `⋮`** ➔ 選擇 **「安裝應用程式」** 或 **「新增至主畫面」**。

---

## 6. 日後維護與跨裝置資料同步技巧

1. **更新程式碼**：日後若想修改程式，只需打開 GitHub 專案，將新檔案點擊 `Upload files` 覆蓋 `main` 分支即可。
2. **跨裝置筆記同步**：在電腦寫完筆記後，點右上角 **「匯出檔案 ➔ 備份 JSON 數據」**，手機開啟網頁匯入備份檔，即可完成跨裝置同步！
