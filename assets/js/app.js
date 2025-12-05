document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const actionBar = document.getElementById('action-bar');
    const fileCountSpan = document.getElementById('file-count');
    const clearBtn = document.getElementById('clear-btn');
    const convertAllBtn = document.getElementById('convert-all-btn');
    const langSwitch = document.getElementById('lang-switch');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityLabel = document.querySelector('label[data-i18n="label_quality"]');
    const installBtn = document.getElementById('install-btn'); // PWA Install Button

    // --- State ---
    let currentFiles = [];
    let currentLang = 'zh-TW';
    let deferredPrompt; // PWA Event Stash

    // --- Initialization ---
    updateLanguage(currentLang);
    updateQualityLabel();

    // --- Event Listeners ---

    // 1. File Upload Logic
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // 2. Language & Quality
    langSwitch.addEventListener('change', (e) => {
        currentLang = e.target.value;
        updateLanguage(currentLang);
    });

    qualitySlider.addEventListener('input', updateQualityLabel);

    // 3. Clear List
    clearBtn.addEventListener('click', () => {
        currentFiles = [];
        fileInput.value = '';
        renderFileList();
    });

    // 4. Convert All + ZIP Download
    convertAllBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0) return;

        const items = document.querySelectorAll('.file-item');
        convertAllBtn.disabled = true;
        convertAllBtn.classList.add('opacity-50', 'cursor-not-allowed');

        const zip = new JSZip();
        const quality = parseInt(qualitySlider.value) / 100;
        let processedCount = 0;

        for (let i = 0; i < currentFiles.length; i++) {
            // Get dataUrl for ZIP
            const jpgDataUrl = await processFile(currentFiles[i], items[i], quality, true);

            if (jpgDataUrl) {
                const base64Data = jpgDataUrl.split(',')[1];
                const newFileName = currentFiles[i].name.replace(/\.webp$/i, '.jpg');
                zip.file(newFileName, base64Data, {base64: true});
                processedCount++;
            }
        }

        if (processedCount > 0) {
            const originalBtnText = convertAllBtn.textContent;
            convertAllBtn.textContent = "Zipping...";

            zip.generateAsync({type:"blob"}).then(function(content) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = "converted_images.zip";
                link.click();

                convertAllBtn.textContent = originalBtnText;
                convertAllBtn.disabled = false;
                convertAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            });
        } else {
             convertAllBtn.disabled = false;
             convertAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });

    // 5. PWA Install Logic (New Integration)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
        console.log('PWA install prompt intercepted');
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
        installBtn.classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
        installBtn.classList.add('hidden');
        deferredPrompt = null;
        console.log('PWA was installed');
    });


    // --- Core Functions ---

    function updateQualityLabel() {
        const t = translations[currentLang];
        qualityLabel.textContent = `${t.label_quality}${qualitySlider.value}%`;
    }

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(f => f.type === 'image/webp');
        if (validFiles.length === 0) {
            alert(translations[currentLang].error_file_type);
            return;
        }
        const newFiles = validFiles.map(f => {
            f.isProcessed = false;
            return f;
        });
        currentFiles = [...currentFiles, ...newFiles];
        renderFileList();
    }

    function renderFileList() {
        fileList.innerHTML = '';
        fileCountSpan.textContent = currentFiles.length;

        if (currentFiles.length > 0) {
            actionBar.classList.remove('hidden');
            actionBar.classList.add('flex');
        } else {
            actionBar.classList.add('hidden');
            actionBar.classList.remove('flex');
        }

        currentFiles.forEach((file, index) => {
            const size = (file.size / 1024).toFixed(1) + ' KB';
            const t = translations[currentLang];
            const statusText = file.isProcessed ? t.status_done : t.status_waiting;
            const statusClass = file.isProcessed ? 'text-green-600 font-bold' : 'text-gray-500';

            const html = `
                <div class="file-item bg-white p-4 rounded shadow-sm border border-gray-200 flex items-center justify-between transition-all hover:shadow-md" id="item-${index}">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-12 h-12 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center text-xs text-gray-500 font-mono">WEBP</div>
                        <div class="min-w-0">
                            <p class="font-medium text-sm truncate text-gray-700">${file.name}</p>
                            <p class="text-xs text-gray-400">${size}</p>
                        </div>
                    </div>
                    <div class="status-area flex items-center gap-2">
                        <span class="status-text text-xs ${statusClass}" data-original-status="${file.isProcessed ? 'done' : 'waiting'}">${statusText}</span>
                    </div>
                </div>
            `;
            fileList.insertAdjacentHTML('beforeend', html);
        });
    }

    function processFile(file, domElement, quality = 0.92, returnDataUrl = false) {
        return new Promise((resolve) => {
            const statusText = domElement.querySelector('.status-text');
            const statusArea = domElement.querySelector('.status-area');
            const t = translations[currentLang];

            statusText.textContent = t.status_converting;
            statusText.className = 'status-text text-xs text-blue-600 font-bold';

            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    const jpgUrl = canvas.toDataURL('image/jpeg', quality);

                    statusText.textContent = t.status_done;
                    statusText.className = 'status-text text-xs text-green-600 font-bold';
                    statusText.setAttribute('data-original-status', 'done');

                    if(!statusArea.querySelector('a')) {
                        const downloadBtn = document.createElement('a');
                        downloadBtn.href = jpgUrl;
                        downloadBtn.download = file.name.replace(/\.webp$/i, '.jpg');
                        downloadBtn.className = "text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition ml-2 flex items-center gap-1";
                        downloadBtn.innerHTML = `<span>⬇</span> ${t.download_single}`;
                        statusArea.appendChild(downloadBtn);
                    }

                    if (returnDataUrl) {
                        resolve(jpgUrl);
                    } else {
                        resolve();
                    }
                };
            };
        });
    }

    function updateLanguage(lang) {
        const t = translations[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });
        updateQualityLabel();

        document.querySelectorAll('.file-item').forEach(item => {
            const status = item.querySelector('.status-text');
            const originalStatus = status.getAttribute('data-original-status');

            if (originalStatus === 'waiting') status.textContent = t.status_waiting;
            else if (originalStatus === 'done') status.textContent = t.status_done;

            const dlBtn = item.querySelector('a');
            if (dlBtn) dlBtn.innerHTML = `<span>⬇</span> ${t.download_single}`;
        });
    }
});