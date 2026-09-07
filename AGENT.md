超盛報價單系統 (Chaosheng Quote App) - AGENT.md
1. 專案概述 (Project Overview)
本專案為「超盛工程行」量身打造的行動端報價單網頁應用程式（PWA / Web App），主要使用者為具備老花眼、僅熟悉 LINE 基本操作的長輩工班師傅。
￼ 核心目標：讓長輩在 iPhone (iOS Safari) 上透過直覺、少打字、大字體的高對比度介面填寫報價單，並能 1:1 產出符合公司既有 Excel 格式的繁體標楷體 A4 PDF 檔案，一鍵分享至客戶的 LINE。
￼ 部署平台：Vercel (前端託管) + Firebase (雲端存檔與離線暫存) + iOS Safari（加入主畫面 PWA 全螢幕模式）。
2. 目標使用者與 UI/UX 核心原則 (Persona & Design Rules)
Jules 在進行任何介面修改或新功能開發時，必須嚴格遵守以下無障礙原則：
1. 極度防呆與大觸控區：
￼ 所有的按鈕、輸入框必須具備足夠的點擊熱區（高度至少 ⁠48px⁠ 以上）。
￼ 顏色對比度必須鮮明（藍底白字、白底黑字、高對比邊框），禁止使用低對比度的淺灰字。
2. 特殊符號快充鍵 (風管工程特化)：
￼ 項目名稱輸入框旁必須常駐 ⁠Ø⁠ (直徑) 與 ⁠×⁠ (乘號) 快捷按鈕，點擊後自動接續插入至游標/文字尾端，避免長輩切換手機鍵盤尋找符號。
3. 強制鎖定亮色模式 (Light Mode Lock)：
￼ 所有輸入框必須強制指定 ⁠bg-white text-gray-900 appearance-none⁠，並在頂層容器設定 ⁠colorScheme: 'light'⁠，防止 iOS 系統深色模式自動將輸入框變黑導致無法辨識。
4. 數字鍵盤優化：
￼ 數量與單價輸入框需啟用 ⁠inputMode="decimal"⁠，喚起手機數字小鍵盤；同時避免在 React ⁠onChange⁠ 中過早強制轉型為 ⁠Number⁠，以免小數點或清空文字時造成介面閃爍或計算中斷。
3. 技術堆疊 (Tech Stack)
￼ 前端框架：React 18 / 19 + Vite
￼ 樣式庫：Tailwind CSS (目前透過 CDN 載入，亦可升級為本機 Tailwind PostCSS)
￼ 圖示庫：⁠lucide-react⁠
￼ 後端與資料庫：Firebase v9+ (Modular SDK)
￼ Firebase Authentication: 匿名登入 (Anonymous Auth)
￼ Cloud Firestore: 歷史報價單即時同步與離線快取
￼ PDF 生成與分享：
￼ ⁠html2canvas⁠ (DOM 畫布渲染)
￼ ⁠jspdf⁠ (A4 多頁 PDF 組裝)
￼ Web Share API (⁠navigator.share⁠)：呼叫 iOS 原生分享選單直接傳送 PDF 檔案至 LINE
￼ 字型引擎：Google Fonts ⁠LXGW WenKai TC⁠ (霞鶩文楷 TC，繁體楷體) 作為首選字體。
4. 關鍵架構與核心防坑指南 (Critical Constraints & Bug Fixes)
4.1. iOS Safari PDF 截圖跑版與文字擠壓問題 (⁠html2canvas⁠)
￼ 現象：在 iPhone 窄螢幕 (約 390px) 截取 794px 的 A4 DOM 時，文字會被嚴重擠壓重疊成一團。
￼ 解法：
1. 截圖時必須強制帶入 ⁠windowWidth: 1024⁠。
2. 截圖前必須執行 ⁠window.scrollTo(0, 0)⁠，並確保 ⁠document.fonts.ready⁠ 完成載入。
3. 進入生成狀態時，需透過全螢幕 Loading 遮罩暫時解除手機端的 CSS ⁠transform: scale()⁠ 縮放，將 DOM 復原至 100% 原始解析度後再進行截圖。
4.2. 全域標楷體 (KaiTi) 策略
￼ 問題：iOS Safari 無內建微軟標楷體 (⁠DFKai-SB⁠)，且隨意載入未最佳化字型會導致截圖文字座標崩潰。
￼ 解法：
￼ 引入 Google 開源字型 ⁠LXGW WenKai TC⁠，並結合 ⁠font-family: 'LXGW WenKai TC', 'DFKai-SB', 'BiauKai', 'TW-Kai', 'Kaiti TC', serif⁠ 降級鏈。
￼ 確保在預覽與 PDF 產出時皆能呈現道地的繁體中文楷書風格。
4.3. A4 多頁自動分頁引擎 (18 行規則)
￼ 固定高度：A4 單頁表格容量限制為 18 行 (⁠MAX_ROWS = 18⁠)。
￼ 小計與稅金預留：
￼ 「外加 5% 稅金」佔用 3 行（小計、稅金、總計）。
￼ 「不計稅」佔用 1 行（總計）。
￼ 動態切頁演算法：系統會在迴圈中動態計算最後一頁剩餘項目數量是否足夠容納總計區塊。若空間不足，會自動觸發分頁，並將總計區塊順延至次頁，其餘不足 18 行之頁面自動補齊空白表格線，確保整齊度。
5. 資料結構 (Data Schema)
Firestore 路徑
⁠artifacts/{appId}/users/{userId}/quotes/{quoteId}⁠
報價單物件結構 (Quote Object)
6. 本地開發與部署 (Local Development & Deployment)
啟動指令
Firebase 金鑰環境設定
專案於 ⁠src/App.jsx⁠ 支援自動讀取 Canvas 注入變數或本地手動配置：
7. 後續研發功能清單 (Roadmap for Jules)
Jules 接手後可依需求逐步執行的待辦事項：
1. 常用項目與快選清單 (Quick Item Presets)：
￼ 建立「常用風管配件庫」（例如：螺旋風管、彎頭、三通、風門、消音箱、保溫管），點擊即可一鍵帶入名稱、預設單位與參考單價。
2. 拆分單一檔案架構 (Modular Refactoring)：
￼ 目前程式碼集中於 ⁠src/App.jsx⁠，可重構拆分為：
￼ ⁠components/QuoteForm.jsx⁠ (編輯表單)
￼ ⁠components/QuoteList.jsx⁠ (歷史單據清單)
￼ ⁠components/PDFPreview.jsx⁠ (A4 多頁預覽與 PDF 匯出)
￼ ⁠services/firebase.js⁠ (資料庫連線抽象化)
3. PWA 離線強化 (Offline PWA & Manifest)：
￼ 加入 ⁠manifest.json⁠ 與 Service Worker 快取，讓長輩在無網路環境下依然能無縫開啟 App、填單，待聯網後自動同步至 Firestore。
4. 報價單搜尋與歷史篩選：
￼ 歷史清單支援以「業主名稱」或「工程名稱」關鍵字即時模糊搜尋。
5. 電子簽名功能 (Optional Signature Pad)：
￼ 提供彈出式全螢幕簽名板，簽署完畢後將簽名圖片直接壓印於 PDF 底部的「客戶簽章」欄位。