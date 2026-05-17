import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Copy, Edit, Trash2, ArrowLeft, Share2, Save, Download, FileText } from 'lucide-react';

// --- Firebase Initialization ---
// ⚠️ 請在這裡貼回您的真實 Firebase 密碼
const firebaseConfig = {
  apiKey: "AIzaSyCrrRMUErKDGaUK4UlAxDpORe8_tLtURt8",
  authDomain: "quoteapp-1f573.firebaseapp.com",
  projectId: "quoteapp-1f573",
  storageBucket: "quoteapp-1f573.firebasestorage.app",
  messagingSenderId: "326503531698",
  appId: "1:326503531698:web:bf60a72bb0cee0cf9975ab"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'chaosheng-quote';

// --- Components ---

// 帶有特殊符號按鈕的輸入框
const SymbolInput = ({ label, value, onChange, placeholder }) => {
  const inputRef = useRef(null);

  const insertSymbol = (symbol) => {
    const newVal = value + symbol;
    onChange(newVal);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col mb-4">
      <label className="text-lg font-bold text-gray-900 mb-1">{label}</label>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 p-3 text-lg border-2 border-gray-400 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600 outline-none w-full min-w-0 bg-white text-gray-900 appearance-none"
        />
        <button
          type="button"
          onClick={() => insertSymbol('Ø')}
          className="px-3 py-2 bg-gray-200 text-gray-900 text-xl font-bold rounded-xl border-2 border-gray-400 active:bg-gray-300 flex-shrink-0"
        >
          Ø
        </button>
        <button
          type="button"
          onClick={() => insertSymbol('×')}
          className="px-3 py-2 bg-gray-200 text-gray-900 text-xl font-bold rounded-xl border-2 border-gray-400 active:bg-gray-300 flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// 一般大字體輸入框 (修正 iOS 數字鍵盤導致總計不更新的 Bug)
const BigInput = ({ label, type = "text", value, onChange, placeholder, isNumber = false }) => (
  <div className="flex flex-col mb-3 min-w-0">
    <label className="text-lg font-bold text-gray-900 mb-1">{label}</label>
    <input
      type={isNumber ? "number" : type}
      inputMode={isNumber ? "decimal" : undefined}
      value={value}
      // 取消原本強制轉換 Number 的設定，改用純字串更新以適應 iOS 小數點邏輯
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="p-3 text-lg border-2 border-gray-400 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600 outline-none w-full min-w-0 bg-white text-gray-900 appearance-none"
    />
  </div>
);

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [view, setView] = useState('list');
  const [currentQuote, setCurrentQuote] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  // 載入外部字體與 PDF 生成套件
  useEffect(() => {
    const loadDependencies = () => {
      // 載入 100% 確保有楷體的 Google Web Font (霞鶩文楷)
      if (!document.getElementById('lxgw-font')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'lxgw-font';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }
      
      if (!window.html2canvas) {
        const script1 = document.createElement('script');
        script1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(script1);
      }
      if (!window.jspdf) {
        const script2 = document.createElement('script');
        script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script2);
      }
    };
    loadDependencies();
  }, []);

  // 計算並監聽手機螢幕寬度，動態縮放預覽畫面
  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      // 若螢幕寬度小於 A4 寬度 (794px) + 留白，則進行縮小
      if (width < 820) {
        setPreviewScale((width - 32) / 794);
      } else {
        setPreviewScale(1);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [view]);

  // Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch Quotes
  useEffect(() => {
    if (!user) return;
    const quotesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'quotes');
    
    const unsubscribe = onSnapshot(quotesRef, (snapshot) => {
      const fetchedQuotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => b.createdAt - a.createdAt);
      setQuotes(fetchedQuotes);
    }, (error) => {
      console.error("Fetch Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Helpers ---
  const generateId = () => Math.random().toString(36).substr(2, 9);
  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const createEmptyQuote = () => ({
    id: generateId(),
    createdAt: Date.now(),
    clientName: '',
    projectName: '',
    date: getToday(),
    taxId: '',
    taxType: 'none', 
    items: [
      { id: generateId(), name: '', unit: '', qty: '', price: '', remark: '' }
    ]
  });

  // --- Actions ---
  const handleNewQuote = () => {
    setCurrentQuote(createEmptyQuote());
    setView('edit');
  };

  const handleEditQuote = (quote) => {
    setCurrentQuote(JSON.parse(JSON.stringify(quote)));
    setView('edit');
  };

  const handleDuplicateQuote = async (quote) => {
    const newQuote = JSON.parse(JSON.stringify(quote));
    newQuote.id = generateId();
    newQuote.createdAt = Date.now();
    newQuote.date = getToday();
    await saveQuoteToDb(newQuote);
  };

  const handleDeleteQuote = async (id) => {
    if (window.confirm('確定要刪除這份報價單嗎？')) {
      if (!user) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'quotes', id));
    }
  };

  const saveQuoteToDb = async (quote) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'quotes', quote.id), quote);
    } catch (e) {
      console.error("Save Error", e);
    }
  };

  const handleSaveQuote = async () => {
    await saveQuoteToDb(currentQuote);
  };

  const updateCurrentQuote = (field, value) => {
    setCurrentQuote(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index, field, value) => {
    setCurrentQuote(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setCurrentQuote(prev => ({
      ...prev,
      items: [...prev.items, { id: generateId(), name: '', unit: '', qty: '', price: '', remark: '' }]
    }));
  };

  const removeItem = (index) => {
    setCurrentQuote(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: newItems };
    });
  };

  // --- Calculations ---
  const calculateTotals = () => {
    if (!currentQuote) return { subtotal: 0, tax: 0, total: 0 };
    
    let subtotal = 0;
    currentQuote.items.forEach(item => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      subtotal += (qty * price);
    });

    let tax = 0;
    let total = subtotal;

    if (currentQuote.taxType === 'exclude') {
      tax = Math.round(subtotal * 0.05);
      total = subtotal + tax;
    }

    return { subtotal, tax, total };
  };

  const totals = calculateTotals();

  // --- PDF & Share ---
  const generateAndSharePDF = async () => {
    if (!window.html2canvas || !window.jspdf) {
      alert('檔案處理模組載入中，請稍候再試（請確保網路暢通）。');
      return;
    }
    
    setIsGenerating(true);
    try {
      // 等待外部楷體載入完成
      if (document.fonts) {
        await document.fonts.ready;
      }

      window.scrollTo(0, 0);

      const pages = document.querySelectorAll('.pdf-page-container');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      const fileName = `報價單_${currentQuote.clientName || '超盛工程'}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '超盛報價單',
          text: '您好，附上報價單供您參考，謝謝。'
        });
      } else {
        pdf.save(fileName);
        alert('檔案已下載！您可以手動傳送。');
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('產生 PDF 失敗，請重試。');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Views ---

  if (!user) {
    return <div className="flex items-center justify-center h-screen text-2xl font-bold bg-white text-black">載入中...</div>;
  }

  // 1. 列表畫面
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-100 pb-20" style={{ colorScheme: 'light' }}>
        <header className="bg-blue-600 text-white p-6 shadow-md rounded-b-2xl">
          <h1 className="text-3xl font-black tracking-wider text-center">超盛報價單系統</h1>
        </header>

        <main className="p-4 max-w-2xl mx-auto">
          <button 
            onClick={handleNewQuote}
            className="w-full bg-blue-600 text-white font-bold text-2xl py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-6 active:bg-blue-700"
          >
            <Plus size={32} /> 新增報價單
          </button>

          <h2 className="text-xl font-bold text-gray-700 mb-3 px-2">歷史紀錄</h2>
          
          {quotes.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-lg">目前還沒有報價單喔！</div>
          ) : (
            <div className="space-y-4">
              {quotes.map(quote => (
                <div key={quote.id} className="bg-white p-5 rounded-2xl shadow border-l-8 border-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{quote.clientName || '未命名業主'}</h3>
                      <p className="text-md text-gray-600 mt-1">{quote.projectName || '未填寫工程名稱'}</p>
                      <p className="text-sm text-gray-500 mt-1">{quote.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditQuote(quote)}
                      className="flex-1 bg-gray-100 text-gray-800 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 border-2 border-gray-200 active:bg-gray-200"
                    >
                      <Edit size={18} /> 編輯
                    </button>
                    <button 
                      onClick={() => handleDuplicateQuote(quote)}
                      className="flex-1 bg-green-100 text-green-800 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 border-2 border-green-200 active:bg-green-200"
                    >
                      <Copy size={18} /> 複製
                    </button>
                    <button 
                      onClick={() => handleDeleteQuote(quote.id)}
                      className="bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-bold border-2 border-red-200 active:bg-red-200"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 2. 編輯畫面
  if (view === 'edit' && currentQuote) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32" style={{ colorScheme: 'light' }}>
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center border-b-2 border-gray-200">
          <button onClick={() => setView('list')} className="p-2 text-gray-600 active:bg-gray-100 rounded-full">
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-xl font-bold text-black">編輯報價單</h1>
          <button onClick={async () => { await handleSaveQuote(); setView('list'); }} className="p-2 text-blue-600 active:bg-blue-50 rounded-full">
            <Save size={28} />
          </button>
        </header>

        <main className="p-3 max-w-2xl mx-auto">
          <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-200 mb-5">
            <h2 className="text-xl font-black mb-3 border-b pb-2 text-blue-700">基本資料</h2>
            <BigInput label="業主名稱" value={currentQuote.clientName} onChange={(v) => updateCurrentQuote('clientName', v)} placeholder="例如：王小明" />
            <BigInput label="工程名稱" value={currentQuote.projectName} onChange={(v) => updateCurrentQuote('projectName', v)} placeholder="例如：廠房排風管工程" />
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 overflow-hidden">
              <div className="w-full min-w-0">
                <BigInput label="日期" type="date" value={currentQuote.date} onChange={(v) => updateCurrentQuote('date', v)} />
              </div>
              <div className="w-full min-w-0">
                <BigInput label="統一編號" value={currentQuote.taxId} onChange={(v) => updateCurrentQuote('taxId', v)} />
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-black mb-3 px-2 text-blue-700">工程項目</h2>
            
            {currentQuote.items.map((item, index) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-200 mb-4 relative">
                <div className="absolute -top-3 -left-3 bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm shadow-md">
                  {index + 1}
                </div>
                {currentQuote.items.length > 1 && (
                  <button onClick={() => removeItem(index)} className="absolute top-2 right-2 text-red-500 p-2">
                    <Trash2 size={24} />
                  </button>
                )}
                
                <div className="mt-2">
                  <SymbolInput 
                    label="項目名稱" 
                    value={item.name} 
                    onChange={(v) => updateItem(index, 'name', v)} 
                    placeholder="例如：螺旋風管"
                  />
                  
                  <div className="flex gap-2 mb-3">
                     <div className="w-1/4 min-w-0">
                       <BigInput label="數量" isNumber value={item.qty} onChange={(v) => updateItem(index, 'qty', v)} placeholder="1" />
                     </div>
                     <div className="w-1/4 flex flex-col mb-3 min-w-0">
                       <label className="text-lg font-bold text-gray-900 mb-1">單位</label>
                       <input
                         type="text"
                         value={item.unit}
                         onChange={(e) => updateItem(index, 'unit', e.target.value)}
                         placeholder="式/尺"
                         className="p-3 text-lg border-2 border-gray-400 rounded-xl focus:border-blue-600 outline-none w-full min-w-0 bg-white text-gray-900 appearance-none"
                       />
                     </div>
                     <div className="w-2/4 min-w-0">
                       <BigInput label="單價" isNumber value={item.price} onChange={(v) => updateItem(index, 'price', v)} placeholder="0" />
                     </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-xl flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-gray-700">小計：</span>
                    <span className="text-xl font-black text-blue-700">
                      ${((Number(item.qty) || 0) * (Number(item.price) || 0)).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <label className="text-md font-bold text-gray-900 mb-1">備註</label>
                    <input
                      type="text"
                      value={item.remark}
                      onChange={(e) => updateItem(index, 'remark', e.target.value)}
                      className="p-2.5 text-md border-2 border-gray-400 rounded-xl outline-none w-full min-w-0 bg-white text-gray-900 appearance-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button 
              onClick={addItem}
              className="w-full bg-gray-200 text-gray-900 font-bold text-lg py-3 rounded-2xl border-2 border-gray-400 flex items-center justify-center gap-2 active:bg-gray-300 shadow-sm"
            >
              <Plus size={20} /> 加入新項目
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-200 mb-6 text-gray-900">
            <h2 className="text-xl font-black mb-3 border-b pb-2 text-blue-700">稅金計算</h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl active:bg-gray-50">
                <input 
                  type="radio" 
                  name="tax" 
                  className="w-5 h-5" 
                  checked={currentQuote.taxType === 'none'} 
                  onChange={() => updateCurrentQuote('taxType', 'none')} 
                />
                <span className="text-lg font-bold">不計算稅金</span>
              </label>
              <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl active:bg-gray-50">
                <input 
                  type="radio" 
                  name="tax" 
                  className="w-5 h-5" 
                  checked={currentQuote.taxType === 'exclude'} 
                  onChange={() => updateCurrentQuote('taxType', 'exclude')} 
                />
                <span className="text-lg font-bold">外加 5% 稅金</span>
              </label>
            </div>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-gray-200 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-end mb-2 px-1">
              <div className="text-gray-600 font-bold text-sm">
                {currentQuote.taxType === 'exclude' && <span>稅金：${totals.tax.toLocaleString()}</span>}
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 font-bold">總金額</div>
                <div className="text-2xl font-black text-red-600">${totals.total.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={async () => { await handleSaveQuote(); setView('preview'); }}
                className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-xl flex justify-center items-center gap-2 active:bg-blue-700"
              >
                <FileText size={24} /> 預覽與傳送
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 預覽畫面 (準備產生 PDF)
  if (view === 'preview') {
    const MAX_ROWS = 18;
    const summaryRowsCount = currentQuote.taxType === 'exclude' ? 3 : 1;
    const itemChunks = [];
    const totalItems = currentQuote.items.length;
    
    let i = 0;
    let isSummaryPlaced = false;

    while (i < totalItems || !isSummaryPlaced) {
      const remainingItems = totalItems - i;
      
      if (remainingItems + summaryRowsCount <= MAX_ROWS) {
        itemChunks.push(currentQuote.items.slice(i, i + remainingItems));
        isSummaryPlaced = true;
        break;
      } else {
        const take = Math.min(remainingItems, MAX_ROWS);
        itemChunks.push(currentQuote.items.slice(i, i + take));
        i += take;
      }
    }

    return (
      <div className="min-h-screen bg-gray-600 pb-32" style={{ colorScheme: 'light' }}>
         <header className="bg-white p-4 shadow-sm sticky top-0 z-30 flex justify-between items-center">
          <button onClick={() => setView('edit')} className="p-2 text-gray-600 active:bg-gray-100 rounded-full">
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-xl font-bold text-black">報價單預覽</h1>
          <div className="w-10"></div>
        </header>

        <main className="p-4 flex flex-col items-center gap-8 mb-24 overflow-hidden">
          {itemChunks.map((chunk, pageIndex) => {
            const isLastPage = pageIndex === itemChunks.length - 1;

            return (
              /* 動態縮放的 Wrapper，讓他在手機上能被完整看見，但保留真實的 DOM 尺寸給 PDF 套件截圖 */
              <div key={pageIndex} style={{ width: `${794 * previewScale}px`, height: `${1123 * previewScale}px`, position: 'relative' }}>
                 <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, width: '794px', height: '1123px' }}>
                    <div className="pdf-page-container bg-white shadow-2xl" style={{ width: '794px', height: '1123px', padding: '15px 26px' }}>
                       {/* 注入 Google Font 雲端字體 LXGW WenKai TC (霞鶩文楷) */}
                       <div className="bg-white text-black font-bold relative" style={{ width: '742px', height: '1093px', padding: '8px 19px', boxSizing: 'border-box', fontFamily: "'LXGW WenKai TC', 'Kaiti TC', 'STKaiti', 'BiauKai', 'DFKai-SB', 'KaiTi', serif" }}>
                          
                          {/* 表頭 */}
                          <div className="text-center mb-2 mt-0">
                            <h1 className="text-[44px] font-black tracking-widest text-black">超盛工程行</h1>
                          </div>

                          {/* 聯絡資訊 */}
                          <div className="flex justify-end mb-4 font-normal">
                            <div className="text-[14px] leading-tight text-left text-black">
                              <p>地址：高雄市三民區澄清路649號7F-4</p>
                              <p>聯絡人：黃耀德 / 0925256521</p>
                              <p>統編：36905114</p>
                              <p>E-mail：c1207031@yahoo.com.tw</p>
                            </div>
                          </div>

                          {/* 報價單標題 */}
                          <div className="text-center mb-6 relative">
                            <h2 className="text-[32px] font-bold tracking-[0.5em] inline-block text-black">報價單</h2>
                            {itemChunks.length > 1 && (
                               <span className="absolute right-0 bottom-0 text-[14px] font-normal text-black">頁次：{pageIndex + 1} / {itemChunks.length}</span>
                            )}
                          </div>

                          {/* 業主資訊 */}
                          <div className="flex justify-between text-[16px] mb-3 text-black">
                            <div>
                              <div className="flex mb-2 items-end">
                                <span className="w-24">業主名稱：</span>
                                <span className="min-w-[200px] font-normal inline-block">{currentQuote.clientName}</span>
                              </div>
                              <div className="flex items-end">
                                <span className="w-24">工程名稱：</span>
                                <span className="min-w-[200px] font-normal inline-block">{currentQuote.projectName}</span>
                              </div>
                            </div>
                            <div>
                              <div className="flex mb-2 items-end">
                                <span className="w-16">日期：</span>
                                <span className="min-w-[140px] font-normal inline-block">{currentQuote.date.replace(/-/g, '/')}</span>
                              </div>
                              <div className="flex items-end">
                                <span className="w-16">統編：</span>
                                <span className="min-w-[140px] font-normal inline-block">{currentQuote.taxId}</span>
                              </div>
                            </div>
                          </div>

                          {/* 表格 */}
                          <table className="w-full border-collapse border border-black text-[15px] text-black">
                            <thead>
                              <tr>
                                <th className="border border-black p-2 w-12 text-center text-black">項次</th>
                                <th className="border border-black p-2 text-center text-black">名稱</th>
                                <th className="border border-black p-2 w-14 text-center text-black">單位</th>
                                <th className="border border-black p-2 w-16 text-center text-black">數量</th>
                                <th className="border border-black p-2 w-24 text-center text-black">單價</th>
                                <th className="border border-black p-2 w-28 text-center text-black">複價</th>
                                <th className="border border-black p-2 w-32 text-center text-black">備註</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chunk.map((item, idx) => {
                                const globalIdx = pageIndex * MAX_ROWS + idx;
                                return (
                                  <tr key={item.id}>
                                    <td className="border border-black p-1.5 text-center font-normal">{globalIdx + 1}</td>
                                    <td className="border border-black p-1.5 font-normal">{item.name}</td>
                                    <td className="border border-black p-1.5 text-center font-normal">{item.unit}</td>
                                    <td className="border border-black p-1.5 text-center font-normal">{item.qty}</td>
                                    <td className="border border-black p-1.5 text-right font-normal">{item.price ? Number(item.price).toLocaleString() : ''}</td>
                                    <td className="border border-black p-1.5 text-right font-normal">
                                       {(Number(item.qty) && Number(item.price)) ? (Number(item.qty) * Number(item.price)).toLocaleString() : ''}
                                    </td>
                                    <td className="border border-black p-1.5 font-normal">{item.remark}</td>
                                  </tr>
                                );
                              })}
                              {(() => {
                                const blanksNeeded = isLastPage 
                                  ? MAX_ROWS - chunk.length - summaryRowsCount 
                                  : MAX_ROWS - chunk.length;
                                
                                return [...Array(Math.max(0, blanksNeeded))].map((_, idx) => (
                                  <tr key={`empty-${idx}`} style={{ height: '31px' }}>
                                    <td className="border border-black p-1.5 text-center font-normal">{pageIndex * MAX_ROWS + chunk.length + idx + 1}</td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                    <td className="border border-black p-1.5 font-normal"></td>
                                  </tr>
                                ));
                              })()}
                              
                              {isLastPage ? (
                                 <>
                                   {currentQuote.taxType === 'exclude' && (
                                      <>
                                        <tr>
                                          <td colSpan="5" className="border border-black p-2 text-right">小計：NT$</td>
                                          <td className="border border-black p-2 text-right font-normal">{totals.subtotal.toLocaleString()}</td>
                                          <td className="border border-black p-2"></td>
                                        </tr>
                                        <tr>
                                          <td colSpan="5" className="border border-black p-2 text-right">稅金 (5%)：NT$</td>
                                          <td className="border border-black p-2 text-right font-normal">{totals.tax.toLocaleString()}</td>
                                          <td className="border border-black p-2"></td>
                                        </tr>
                                      </>
                                   )}
                                   <tr>
                                      <td colSpan="5" className="border border-black p-2 text-right text-lg">總計：NT$</td>
                                      <td className="border border-black p-2 text-right font-normal text-lg">{totals.total.toLocaleString()}</td>
                                      <td className="border border-black p-2"></td>
                                   </tr>
                                 </>
                              ) : (
                                 <tr>
                                    <td colSpan="7" className="border border-black p-2 text-center font-normal text-gray-500">
                                       --- 接續下頁 ---
                                    </td>
                                 </tr>
                              )}
                            </tbody>
                          </table>
                       </div>
                    </div>
                 </div>
              </div>
            );
          })}
        </main>

        {/* 底部固定傳送按鈕 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <button 
            onClick={generateAndSharePDF}
            disabled={isGenerating}
            className={`w-full max-w-2xl mx-auto py-4 rounded-2xl font-black text-xl flex justify-center items-center gap-3 ${
              isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#06C755] active:bg-[#05b04b] text-white'
            }`}
          >
            {isGenerating ? (
               <span>產生文件中...</span>
            ) : (
               <>
                 <Share2 size={28} />
                 一鍵傳送至 LINE
               </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}