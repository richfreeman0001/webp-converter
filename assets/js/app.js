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

    // 新增：畫質滑桿相關元素
    const qualitySlider = document.getElementById('quality-slider');
    const qualityLabel = document.querySelector('label[data-i18n="label_quality"]');

    // --- State ---
    let currentFiles = [];
    let currentLang = 'zh-TW';

    // --- Initialization ---
    updateLanguage(currentLang);
    updateQualityLabel(); // 初始化畫質顯示

    // --- Event Listeners ---

    // 1. Click to Upload
    dropZone.addEventListener('click', () => fileInput.click());

    // 2. Drag & Drop Visual Feedback
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

    // 3. File Input Change
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // 4. Language Switch
    langSwitch.addEventListener('change', (e) => {
        currentLang = e.target.value;
        updateLanguage(currentLang);
    });

    // 5. Clear List
    clearBtn.addEventListener('click', () => {
        currentFiles = [];
        fileInput.value = '';
        renderFileList();
    });

    // 6. Quality Slider Change (即時更新顯示數值)
    qualitySlider.addEventListener('input', updateQualityLabel);

    // 7. Convert All
    convertAllBtn.addEventListener('click', async () => {
        const items = document.querySelectorAll('.file-item');
        convertAllBtn.disabled = true;
        convertAllBtn.classList.add('opacity-50', 'cursor-not-allowed');

        // 取得當前畫質設定 (0.1 ~ 1.0)
        const quality = parseInt(qualitySlider.value) / 100;

        for (let i = 0; i < currentFiles.length; i++) {
            if (!currentFiles[i].isProcessed) {
                // 傳入畫質參數
                await processFile(currentFiles[i], items[i], quality);
                currentFiles[i].isProcessed = true;
            }
        }

        convertAllBtn.disabled = false;
        convertAllBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    });

    // --- Core Functions ---

    function updateQualityLabel() {
        const t = translations[currentLang];
        // 顯示格式： "畫質: 90%" 或 "Quality: 90%"
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
            actionBar.classList.add('flex'); // 確保使用 Flex 佈局
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

    // 新增 quality 參數
    function processFile(file, domElement, quality = 0.92) {
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

                    // 使用動態畫質參數
                    const jpgUrl = canvas.toDataURL('image/jpeg', quality);

                    statusText.textContent = t.status_done;
                    statusText.className = 'status-text text-xs text-green-600 font-bold';
                    statusText.setAttribute('data-original-status', 'done');

                    const downloadBtn = document.createElement('a');
                    downloadBtn.href = jpgUrl;
                    downloadBtn.download = file.name.replace(/\.webp$/i, '.jpg');
                    downloadBtn.className = "text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition ml-2 flex items-center gap-1";
                    downloadBtn.innerHTML = `<span>⬇</span> ${t.download_single}`;

                    if(!statusArea.querySelector('a')) {
                        statusArea.appendChild(downloadBtn);
                    }

                    resolve();
                };
            };
        });
    }

    function updateLanguage(lang) {
        const t = translations[lang];

        // 1. Static Elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        // 2. Update Quality Label specifically (since it has dynamic value)
        updateQualityLabel();

        // 3. Dynamic List Items
        document.querySelectorAll('.file-item').forEach(item => {
            const status = item.querySelector('.status-text');
            const originalStatus = status.getAttribute('data-original-status');

            if (originalStatus === 'waiting') {
                status.textContent = t.status_waiting;
            } else if (originalStatus === 'done') {
                status.textContent = t.status_done;
            }

            const dlBtn = item.querySelector('a');
            if (dlBtn) {
                 dlBtn.innerHTML = `<span>⬇</span> ${t.download_single}`;
            }
        });
    }
});