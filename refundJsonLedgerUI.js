(function () {
    const status = document.getElementById('refund-json-status');
    const recordsElement = document.getElementById('refund-json-records');
    const importInput = document.getElementById('refund-json-import');
    const copyDialog = document.getElementById('refund-json-copy-dialog');
    const copyTextarea = document.getElementById('refund-json-copy-content');
    let records = [];

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
    }

    function readCurrentRecord() {
        const mode = document.getElementById('cash-calc-mode').value;
        const taxRate = Number(document.getElementById('cash-calc-tax-rate').value);
        const exchangeRate = Number(document.getElementById('cash-calc-fx').value);
        const rows = Array.from(document.querySelectorAll('#cash-calc-items [data-item-row]'));
        let amount;
        let items;

        if (mode === 'items') {
            items = rows.map((row, index) => ({
                name: row.querySelector('[data-item-name]').value.trim() || `商品 ${index + 1}`,
                price: Number(row.querySelector('[data-item-price]').value),
                quantity: Number(row.querySelector('[data-item-quantity]').value),
            }));
            amount = window.cashJapanCalculator.sumPurchaseItems(items);
        } else {
            amount = Number(document.getElementById('cash-calc-amount').value);
            items = [{
                name: mode === 'purchase' ? '購物總額' : '業者退款額',
                price: amount,
                quantity: 1,
            }];
        }

        const storeName = document.getElementById('cash-calc-store-name').value.trim();
        if (!storeName) throw new TypeError('請先輸入商店名稱。');
        if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            throw new TypeError('請確認日圓金額和匯率有效。');
        }

        const calculation = window.cashJapanCalculator.calculateCashJapanRefund({ mode, amount, taxRate, exchangeRate });
        const now = new Date().toISOString();
        return window.refundLedger.createRefundRecord({
            storeName,
            items,
            calculationMode: mode,
            taxRate,
            exchangeRate,
            createdAt: now,
            updatedAt: now,
            calculation,
        });
    }

    function renderRecords() {
        recordsElement.replaceChildren();
        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'refund-ledger-empty';
            empty.textContent = '尚無記帳；新增本筆後即可匯出或複製整份 JSON。';
            recordsElement.append(empty);
            return;
        }

        records.forEach((record, index) => {
            const row = document.createElement('div');
            row.className = 'refund-ledger-record';
            const main = document.createElement('div');
            main.className = 'refund-ledger-record-main';
            const title = document.createElement('strong');
            title.textContent = record.storeName;
            const detail = document.createElement('small');
            detail.textContent = `${record.items.map((item) => item.name).join('、')} · ¥${Number(record.payoutYen).toLocaleString('ja-JP')}`;
            main.append(title, detail);

            const actions = document.createElement('div');
            actions.className = 'refund-ledger-record-actions';
            const loadButton = document.createElement('button');
            loadButton.className = 'refund-ledger-button';
            loadButton.type = 'button';
            loadButton.textContent = '載入';
            loadButton.addEventListener('click', () => loadRecord(record));
            const deleteButton = document.createElement('button');
            deleteButton.className = 'refund-ledger-button';
            deleteButton.type = 'button';
            deleteButton.textContent = '刪除';
            deleteButton.addEventListener('click', () => {
                records.splice(index, 1);
                renderRecords();
                setStatus(`已從本頁清單移除「${record.storeName}」；需匯出 JSON 才會保存變更。`);
            });
            actions.append(loadButton, deleteButton);
            row.append(main, actions);
            recordsElement.append(row);
        });
    }

    function loadRecord(record) {
        document.getElementById('cash-calc-store-name').value = record.storeName;
        document.getElementById('cash-calc-mode').value = record.calculationMode || 'items';
        document.getElementById('cash-calc-tax-rate').value = String(record.taxRate);
        document.getElementById('cash-calc-fx').value = String(record.exchangeRate);
        const amountInput = document.getElementById('cash-calc-amount');
        amountInput.value = String(record.calculationMode === 'refund' ? record.refundBeforeFeeYen : record.purchaseTotalYen);

        const itemContainer = document.getElementById('cash-calc-items');
        const itemRows = Array.from(itemContainer.querySelectorAll('[data-item-row]'));
        while (itemRows.length > 1) itemRows.pop().remove();
        record.items.forEach((item, index) => {
            if (index > 0) document.getElementById('cash-calc-add-item').click();
            const row = itemContainer.querySelectorAll('[data-item-row]')[index];
            row.querySelector('[data-item-name]').value = item.name;
            row.querySelector('[data-item-price]').value = String(item.priceYen);
            row.querySelector('[data-item-quantity]').value = String(item.quantity);
        });
        document.getElementById('cash-calc-mode').dispatchEvent(new Event('change', { bubbles: true }));
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
        itemContainer.dispatchEvent(new Event('input', { bubbles: true }));
        setStatus(`已載入「${record.storeName}」。修改後按「加入本筆」新增一筆記錄。`);
        document.getElementById('refund-calc-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getExportText() {
        const exportRecords = records.length ? records : [readCurrentRecord()];
        return window.refundLedger.serializeRefundBackup(exportRecords);
    }

    function downloadJson(text) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `refund-ledger-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function showCopyFallback(text) {
        copyTextarea.value = text;
        copyDialog.showModal();
        copyTextarea.focus();
        copyTextarea.select();
        copyTextarea.setSelectionRange(0, text.length);
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (_error) {
            copied = false;
        }
        if (copied) {
            copyDialog.close();
            setStatus('JSON 已複製，可貼到記事本。');
        } else {
            setStatus('請在文字框全選並複製 JSON，再貼到記事本。');
        }
    }

    document.getElementById('refund-json-add-record').addEventListener('click', () => {
        try {
            const record = readCurrentRecord();
            records.push(record);
            renderRecords();
            setStatus(`已加入「${record.storeName}」。匯出 JSON 才會保存這份清單。`);
        } catch (error) {
            setStatus(error.message || '無法新增記錄。', true);
        }
    });

    document.getElementById('refund-json-export').addEventListener('click', () => {
        try {
            const text = getExportText();
            downloadJson(text);
            setStatus(records.length
                ? `已匯出 ${records.length} 筆 JSON 備份。`
                : '已匯出目前試算的 JSON；新增至清單後可匯出多筆記錄。');
        } catch (error) {
            setStatus(error.message || 'JSON 匯出失敗。', true);
        }
    });

    document.getElementById('refund-json-copy').addEventListener('click', async () => {
        try {
            const text = getExportText();
            if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    setStatus('JSON 已複製，可貼到記事本。');
                    return;
                } catch (_error) {
                    showCopyFallback(text);
                    return;
                }
            }
            showCopyFallback(text);
        } catch (error) {
            setStatus(error.message || 'JSON 複製失敗。', true);
        }
    });

    importInput.addEventListener('change', async () => {
        const file = importInput.files[0];
        importInput.value = '';
        if (!file) return;
        try {
            const backup = window.refundLedger.parseRefundBackup(await file.text());
            records = backup.records;
            renderRecords();
            setStatus(`已匯入 ${records.length} 筆，並取代目前頁面的記帳清單。`);
        } catch (error) {
            setStatus(error.message || 'JSON 匯入失敗；請確認備份格式。', true);
        }
    });

    document.getElementById('refund-json-copy-close').addEventListener('click', () => copyDialog.close());

    document.getElementById('cash-calc-export-image').addEventListener('click', async () => {
        const exportStatus = document.getElementById('cash-calc-export-status');
        const button = document.getElementById('cash-calc-export-image');
        button.disabled = true;
        exportStatus.textContent = '正在產生記帳圖片…';
        try {
            if (typeof window.html2canvas !== 'function') throw new Error('截圖工具尚未載入。');
            const panel = document.getElementById('refund-calc-panel');
            const bounds = panel.getBoundingClientRect();
            const canvas = await window.html2canvas(panel, {
                backgroundColor: '#111820',
                scale: Math.min(window.devicePixelRatio || 1, 2),
                useCORS: true,
                ignoreElements: (element) => element.classList?.contains('refund-export-hide'),
                width: Math.ceil(bounds.width),
                height: Math.ceil(bounds.height),
                windowWidth: document.documentElement.clientWidth,
                windowHeight: Math.max(document.documentElement.scrollHeight, Math.ceil(bounds.height)),
                onclone: (clonedDocument) => {
                    const activeDay = clonedDocument.getElementById('static-day-6');
                    if (activeDay) activeDay.style.display = 'block';
                },
            });
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('圖片產生失敗。');
            const file = new File([blob], `refund-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: 'Cash Japan 退稅試算' });
                    exportStatus.textContent = '已開啟分享面板，選擇「儲存影像」即可存入照片。';
                    return;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        exportStatus.textContent = '已取消分享。';
                        return;
                    }
                }
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            exportStatus.textContent = 'PNG 已下載；iPhone 可在分享面板選擇儲存影像。';
        } catch (error) {
            exportStatus.textContent = error.message || '圖片匯出失敗。';
        } finally {
            button.disabled = false;
        }
    });

    renderRecords();
    setStatus('記帳只暫存在目前頁面；關閉前請匯出 JSON 備份。');
})();