(function () {
    const status = document.getElementById('refund-cloud-status');
    const recordsElement = document.getElementById('refund-cloud-records');
    const authFields = document.getElementById('refund-cloud-auth');
    const signInButton = document.getElementById('refund-cloud-signin');
    const signUpButton = document.getElementById('refund-cloud-signup');
    const signOutButton = document.getElementById('refund-cloud-signout');
    const saveButton = document.getElementById('refund-cloud-save');
    const exportButton = document.getElementById('refund-cloud-export');
    const importInput = document.getElementById('refund-cloud-import');
    const importLabel = document.getElementById('refund-cloud-import-label');
    const cloudUnavailableMessage = window.refundCloudStore.message || '雲端資料庫目前無法使用。';
    let currentUser = null;
    let records = [];

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
    }

    function updateControls() {
        authFields.hidden = !window.refundCloudStore.configured || Boolean(currentUser);
        signInButton.disabled = !window.refundCloudStore.configured || Boolean(currentUser);
        signUpButton.disabled = signInButton.disabled;
        signOutButton.hidden = !currentUser;
        saveButton.disabled = !currentUser;
        exportButton.disabled = false;
        importInput.disabled = !currentUser;
        importLabel.classList.toggle('is-disabled', !currentUser);
        importLabel.setAttribute('aria-disabled', String(!currentUser));
    }

    function renderRecords() {
        recordsElement.replaceChildren();
        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'refund-ledger-empty';
            empty.textContent = currentUser ? '目前沒有雲端記錄。' : '登入後可查看雲端記錄。';
            recordsElement.append(empty);
            return;
        }

        records.forEach((record) => {
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
            deleteButton.addEventListener('click', async () => {
                if (!window.confirm(`刪除「${record.storeName}」這筆記錄？`)) return;
                try {
                    await window.refundCloudStore.deleteRecord(record.id);
                    await refreshRecords();
                    setStatus('記錄已刪除。');
                } catch (_error) {
                    setStatus('刪除失敗，請確認登入狀態後重試。', true);
                }
            });
            actions.append(loadButton, deleteButton);
            row.append(main, actions);
            recordsElement.append(row);
        });
    }

    async function refreshRecords() {
        records = currentUser ? await window.refundCloudStore.listRecords() : [];
        renderRecords();
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
        return window.refundLedger.createRefundRecord({
            storeName,
            items,
            calculationMode: mode,
            taxRate,
            exchangeRate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            calculation,
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
        while (itemRows.length > 1) {
            itemRows.pop().remove();
        }
        const items = record.items;
        items.forEach((item, index) => {
            if (index > 0) document.getElementById('cash-calc-add-item').click();
            const row = itemContainer.querySelectorAll('[data-item-row]')[index];
            row.querySelector('[data-item-name]').value = item.name;
            row.querySelector('[data-item-price]').value = String(item.priceYen);
            row.querySelector('[data-item-quantity]').value = String(item.quantity);
        });
        document.getElementById('cash-calc-mode').dispatchEvent(new Event('change', { bubbles: true }));
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
        itemContainer.dispatchEvent(new Event('input', { bubbles: true }));
        setStatus(`已載入「${record.storeName}」。儲存會建立一筆新記錄。`);
        document.getElementById('refund-calc-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function downloadJson(backup) {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `refund-ledger-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function runAuthAction(action) {
        const email = document.getElementById('refund-cloud-email').value.trim();
        const password = document.getElementById('refund-cloud-password').value;
        if (!email || !password) {
            setStatus('請輸入電子郵件和密碼。', true);
            return;
        }
        try {
            await window.refundCloudStore[action](email, password);
            document.getElementById('refund-cloud-password').value = '';
        } catch (_error) {
            setStatus(action === 'signIn' ? '登入失敗，請確認帳密或 Firebase 設定。' : '建立帳號失敗，請確認帳號設定。', true);
        }
    }

    signInButton.addEventListener('click', () => runAuthAction('signIn'));
    signUpButton.addEventListener('click', () => runAuthAction('createAccount'));
    signOutButton.addEventListener('click', async () => {
        await window.refundCloudStore.signOut();
        setStatus('已登出。');
    });
    saveButton.addEventListener('click', async () => {
        try {
            const record = readCurrentRecord();
            await window.refundCloudStore.saveRecord(record);
            await refreshRecords();
            setStatus(`已儲存「${record.storeName}」。`);
        } catch (error) {
            setStatus(error instanceof TypeError ? error.message : '儲存失敗，請確認 Firebase 設定與網路。', true);
        }
    });
    exportButton.addEventListener('click', async () => {
        try {
            const backupRecords = currentUser ? records : [readCurrentRecord()];
            downloadJson(window.refundLedger.createRefundBackup(backupRecords));
            setStatus(currentUser ? `已匯出 ${backupRecords.length} 筆雲端記錄。` : '已匯出目前試算為 JSON 備份。');
        } catch (error) {
            setStatus(error.message || 'JSON 匯出失敗。', true);
        }
    });
    importInput.addEventListener('change', async () => {
        const file = importInput.files[0];
        importInput.value = '';
        if (!file) return;
        try {
            const backup = window.refundLedger.parseRefundBackup(await file.text());
            const importedCount = await window.refundCloudStore.importRecords(backup.records);
            await refreshRecords();
            setStatus(`已匯入 ${importedCount} 筆記錄。`);
        } catch (error) {
            setStatus(error.message || 'JSON 匯入失敗；請確認已登入且檔案格式正確。', true);
        }
    });

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
                x: bounds.left,
                y: bounds.top,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
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

    if (!window.refundCloudStore.configured) {
        setStatus(`${cloudUnavailableMessage} 計算及目前試算 JSON 匯出仍可使用。`);
    }
    window.refundCloudStore.subscribeAuth(async (user) => {
        currentUser = user;
        updateControls();
        try {
            await refreshRecords();
            setStatus(user ? `已登入：${user.email || 'Firebase 使用者'}。` : (window.refundCloudStore.configured ? '請登入以使用雲端記帳。' : `${cloudUnavailableMessage} 計算及目前試算 JSON 匯出仍可使用。`));
        } catch (_error) {
            setStatus('無法載入記錄，請確認 Firestore Rules 和網路連線。', true);
        }
    });
    updateControls();
})();
