(function () {
    const status = document.getElementById('refund-json-status');
    const dialogStatus = document.getElementById('refund-json-dialog-status');
    const jsonDialog = document.getElementById('refund-json-dialog');
    const jsonInput = document.getElementById('refund-json-input');
    const fileInput = document.getElementById('refund-json-file');
    const legacyStoreSelect = document.getElementById('refund-json-legacy-store');
    let importedRecords = [];
    let activeRecord = null;

    function setStatus(message, isError = false) {
        [status, ...(jsonDialog.open ? [dialogStatus] : [])].forEach((element) => {
            if (!element) return;
            element.textContent = message;
            element.classList.toggle('is-error', isError);
        });
    }

    function setImportStatus(message, isError = false) {
        const element = jsonDialog.open ? dialogStatus : status;
        element.textContent = message;
        element.classList.toggle('is-error', isError);
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
        const sameStore = activeRecord && activeRecord.storeName === storeName;
        return window.refundLedger.createRefundRecord({
            id: sameStore ? activeRecord.id : '',
            storeName,
            items,
            calculationMode: mode,
            taxRate,
            exchangeRate,
            createdAt: sameStore ? activeRecord.createdAt : now,
            updatedAt: now,
            calculation,
        });
    }

    function loadRecord(record) {
        activeRecord = window.refundLedger.createRefundRecord(record);
        document.getElementById('cash-calc-store-name').value = activeRecord.storeName;
        document.getElementById('cash-calc-mode').value = activeRecord.calculationMode;
        document.getElementById('cash-calc-tax-rate').value = String(activeRecord.taxRate);
        document.getElementById('cash-calc-fx').value = String(activeRecord.exchangeRate);
        const amountInput = document.getElementById('cash-calc-amount');
        amountInput.value = String(activeRecord.calculationMode === 'refund'
            ? activeRecord.refundBeforeFeeYen
            : activeRecord.purchaseTotalYen);

        const itemContainer = document.getElementById('cash-calc-items');
        const rows = Array.from(itemContainer.querySelectorAll('[data-item-row]'));
        while (rows.length > 1) rows.pop().remove();
        activeRecord.items.forEach((item, index) => {
            if (index > 0) document.getElementById('cash-calc-add-item').click();
            const row = itemContainer.querySelectorAll('[data-item-row]')[index];
            row.querySelector('[data-item-name]').value = item.name;
            row.querySelector('[data-item-price]').value = String(item.priceYen);
            const quantitySelect = row.querySelector('[data-item-quantity]');
            const quantity = String(item.quantity);
            if (!Array.from(quantitySelect.options).some((option) => option.value === quantity)) {
                const option = document.createElement('option');
                option.value = quantity;
                option.textContent = quantity;
                quantitySelect.append(option);
            }
            quantitySelect.value = quantity;
        });
        document.getElementById('cash-calc-mode').dispatchEvent(new Event('change', { bubbles: true }));
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
        itemContainer.dispatchEvent(new Event('input', { bubbles: true }));
        setImportStatus(`已載入「${activeRecord.storeName}」，可直接修改後匯出。`);
        document.getElementById('refund-calc-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function serializeCurrentRecord() {
        const record = readCurrentRecord();
        const text = window.refundLedger.serializeRefundBackup(record);
        activeRecord = record;
        jsonInput.value = text;
        return { record, text };
    }

    function downloadJson(text, storeName) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeStoreName = storeName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'refund';
        link.href = url;
        link.download = `${safeStoreName}-refund.json`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function selectLegacyRecord(index) {
        const record = importedRecords[Number(index)];
        if (!record) return;
        loadRecord(record);
        jsonInput.value = window.refundLedger.serializeRefundBackup(record);
    }

    function loadJsonText(text) {
        const backup = window.refundLedger.parseRefundBackup(text);
        importedRecords = backup.records;
        legacyStoreSelect.replaceChildren();
        legacyStoreSelect.hidden = importedRecords.length < 2;

        if (importedRecords.length === 1) {
            loadRecord(importedRecords[0]);
            jsonInput.value = window.refundLedger.serializeRefundBackup(importedRecords[0]);
            if (jsonDialog.open) jsonDialog.close();
            setStatus(`已載入「${importedRecords[0].storeName}」，可直接修改後匯出。`);
            return;
        }

        importedRecords.forEach((record, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = record.storeName;
            legacyStoreSelect.append(option);
        });
        legacyStoreSelect.value = '0';
        selectLegacyRecord(0);
        dialogStatus.textContent = `舊備份含 ${importedRecords.length} 家店；可選擇店家後逐家匯出。`;
    }

    function showCopyFallback(text) {
        jsonInput.value = text;
        if (!jsonDialog.open) jsonDialog.showModal();
        jsonInput.focus();
        jsonInput.select();
        jsonInput.setSelectionRange(0, text.length);
        setStatus('JSON 已選取，請複製後貼到記事本。');
    }

    document.getElementById('refund-json-open').addEventListener('click', () => {
        if (!jsonDialog.open) jsonDialog.showModal();
        jsonInput.focus();
    });

    document.getElementById('refund-json-dialog-close').addEventListener('click', () => jsonDialog.close());
    jsonDialog.addEventListener('click', (event) => {
        if (event.target === jsonDialog) jsonDialog.close();
    });

    document.getElementById('refund-json-load').addEventListener('click', () => {
        try {
            loadJsonText(jsonInput.value);
        } catch (error) {
            setImportStatus(error.message || 'JSON 匯入失敗；請確認格式。', true);
        }
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            jsonInput.value = text;
            loadJsonText(text);
        } catch (error) {
            setImportStatus(error.message || 'JSON 檔案無法讀取。', true);
        }
    });

    legacyStoreSelect.addEventListener('change', () => selectLegacyRecord(legacyStoreSelect.value));

    document.getElementById('refund-json-export').addEventListener('click', () => {
        try {
            const { record, text } = serializeCurrentRecord();
            downloadJson(text, record.storeName);
            setStatus(`已匯出「${record.storeName}」的單店 JSON。`);
        } catch (error) {
            setStatus(error.message || 'JSON 匯出失敗。', true);
        }
    });

    document.getElementById('refund-json-copy').addEventListener('click', async () => {
        try {
            const { record, text } = serializeCurrentRecord();
            if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    setStatus(`已複製「${record.storeName}」的 JSON，可貼到記事本。`);
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

    document.getElementById('cash-calc-export-image').addEventListener('click', async () => {
        const exportStatus = document.getElementById('cash-calc-export-status');
        const button = document.getElementById('cash-calc-export-image');
        button.disabled = true;
        exportStatus.textContent = '正在排版帳單…';
        try {
            const record = readCurrentRecord();
            const canvas = window.refundInvoice.renderRefundInvoiceCanvas(record);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('帳單圖片產生失敗。');
            const safeStoreName = record.storeName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'refund';
            const file = new File([blob], `${safeStoreName}-refund.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: `${record.storeName} 退稅估算帳單` });
                    exportStatus.textContent = '帳單已開啟分享面板，可選「儲存影像」。';
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
            exportStatus.textContent = '帳單 PNG 已下載。';
        } catch (error) {
            exportStatus.textContent = error.message || '帳單圖片匯出失敗。';
        } finally {
            button.disabled = false;
        }
    });

    status.textContent = '修改後匯出或複製，離開前請保存。';
    dialogStatus.textContent = '貼上 JSON，或選擇此店的 JSON 檔案。';
})();