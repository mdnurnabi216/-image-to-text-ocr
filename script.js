// Updated script.js: supports Bengali (ben) and basic preprocessing
// Uses Tesseract.js v2 and loads language packs from projectnaptha tessdata

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
  const lang = langSelect.value || 'eng';
  await runOCR(selectedFile, lang);
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

// Preprocess image: resize to maxWidth and convert to grayscale to help OCR
async function preprocessFileToDataURL(file, maxWidth = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // draw and convert to grayscale for better OCR
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
        // luminance
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = lum;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    // use object URL for file blob
    img.src = URL.createObjectURL(file);
  });
}

async function runOCR(file, lang='eng'){
  status('Initializing OCR...');
  resetProgress();
  resultText.value = '';

  try{
    // Create worker and point langPath to a public tessdata host
    worker = Tesseract.createWorker({
      logger: m => {
        if (m.status && m.status === 'recognizing text') {
          const p = Math.round(m.progress * 100);
          progressFill.style.width = p + '%';
          status(`Recognizing text: ${p}%`);
        } else if (m.status) {
          status(m.status);
        }
      },
      // langPath tells tesseract where to download traineddata files from
      langPath: 'https://tessdata.projectnaptha.com/4.0.0'
    });

    await worker.load();
    // load the selected language (e.g., 'ben' for Bengali)
    await worker.loadLanguage(lang);
    await worker.initialize(lang);

    // Preprocess image (helps with messy / low-contrast Bengali scans)
    const dataUrl = await preprocessFileToDataURL(file, 1600);

    // Recognize from data URL
    const { data: { text } } = await worker.recognize(dataUrl);
    resultText.value = text.trim();
    status('Done');
    progressFill.style.width = '100%';

    await worker.terminate();
    worker = null;
  }catch(err){
    console.error(err);
    status('Error: ' + (err.message || err));
    if(worker){
      try{ await worker.terminate(); }catch(e){}
      worker = null;
    }
  }
}
