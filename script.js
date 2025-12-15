// Minimal client-side OCR using Tesseract.js (v2)
const fileElem = document.getElementById('fileElem');
const dropArea = document.getElementById('drop-area');
const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressFill = document.getElementById('progressFill');
const statusEl = document.getElementById('status');
const langSelect = document.getElementById('lang');

let selectedFile = null;
let worker = null;

function preventDefaults(e){
  e.preventDefault();
  e.stopPropagation();
}

['dragenter','dragover','dragleave','drop'].forEach(evt => {
  dropArea.addEventListener(evt, preventDefaults, false);
});

dropArea.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
});

fileElem.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files){
  if(!files || files.length === 0) return;
  const file = files[0];
  if(!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.style.display = 'block';
  status('Ready to OCR');
  resetProgress();
}

startBtn.addEventListener('click', async () => {
  if(!selectedFile){
    alert('Please choose or drop an image first.');
    return;
  }
  await runOCR(selectedFile, langSelect.value || 'eng');
});

clearBtn.addEventListener('click', () => {
  selectedFile = null;
  preview.src = '';
  resultText.value = '';
  fileElem.value = '';
  status('Idle');
  resetProgress();
});

copyBtn.addEventListener('click', async () => {
  const text = resultText.value;
  if(!text) return;
  try{
    await navigator.clipboard.writeText(text);
    status('Copied to clipboard');
  }catch(e){
    alert('Copy failed: ' + e.message);
  }
});

downloadBtn.addEventListener('click', () => {
  const text = resultText.value;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ocr-result.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function resetProgress(){
  progressFill.style.width = '0%';
}

function status(msg){
  statusEl.textContent = msg;
}

async function runOCR(file, lang='eng'){
  status('Initializing OCR...');
  resetProgress();
  resultText.value = '';

  try{
    // create worker
    worker = Tesseract.createWorker({
      logger: m => {
        // m.progress is 0..1 during recognizer stages
        if(m.status && m.status === 'recognizing text'){
          const p = Math.round(m.progress * 100);
          progressFill.style.width = p + '%';
          status(`Recognizing text: ${p}%`);
        } else if(m.status){
          status(m.status);
        }
      }
    });

    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);

    const imgUrl = URL.createObjectURL(file);
    const { data: { text } } = await worker.recognize(imgUrl);
    resultText.value = text.trim();
    status('Done');
    progressFill.style.width = '100%';

    await worker.terminate();
    worker = null;
    URL.revokeObjectURL(imgUrl);
  }catch(err){
    console.error(err);
    status('Error: ' + (err.message || err));
    if(worker){
      try{ await worker.terminate(); }catch(e){}
      worker = null;
    }
  }
      }
