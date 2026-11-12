(function (root) {
    const BACKUP_FORMAT = 'kansai-tax-refund-ledger';
    const BACKUP_VERSION = 2;

    function toIsoString(value) {
        if (value && typeof value.toDate === 'function') value = value.toDate();
        const date = value instanceof Date ? value : new Date(value || Date.now());
        if (Number.isNaN(date.getTime())) throw new TypeError('Invalid record date.');
        return date.toISOString();
    }

    function createRefundRecord(input) {
        const storeName = String(input.storeName || '').trim();
        if (!storeName || [...storeName].length > 120) throw new TypeError('A valid store name is required for a refund record.');
        if (!Array.isArray(input.items) || input.items.length === 0) {
            throw new TypeError('At least one item is required for a refund record.');
        }
        if (input.items.length > 100) throw new TypeError('A refund record cannot contain more than 100 items.');

        const items = input.items.map((item, index) => {
            const name = String(item.name || '').trim() || `商品 ${index + 1}`;
            const priceYen = Number(item.priceYen ?? item.price);
            const quantity = Number(item.quantity);
            if ([...name].length > 120 || !Number.isFinite(priceYen) || priceYen < 0
                || !Number.isInteger(quantity) || quantity < 1) {
                throw new TypeError(`Invalid item values at row ${index + 1}.`);
            }
            return { name, priceYen, quantity, subtotalYen: priceYen * quantity };
        });

        const taxRate = Number(input.taxRate);
        const exchangeRate = Number(input.exchangeRate);
        if (![0.08, 0.1].includes(taxRate)) throw new TypeError('Invalid tax rate.');
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new TypeError('Invalid exchange rate.');

        const calculation = input.calculation || input;
        const resultFields = {
            taxExclusivePurchaseYen: input.calculationMode === 'refund' && calculation.taxExclusivePurchaseYen == null
                ? null
                : Number(calculation.taxExclusivePurchaseYen),
            refundBeforeFeeYen: Number(calculation.refundBeforeFeeYen),
            serviceFeeYen: Number(calculation.serviceFeeYen ?? calculation.nominalFeeYen),
            payoutYen: Number(calculation.payoutYen),
            payoutTwd: Number(calculation.payoutTwd),
            roundingAdjustmentYen: Number(calculation.roundingAdjustmentYen),
        };
        for (const [field, value] of Object.entries(resultFields)) {
            if (value === null && field === 'taxExclusivePurchaseYen') continue;
            if (!Number.isFinite(value) || value < 0 && field !== 'roundingAdjustmentYen') {
                throw new TypeError(`Invalid calculation field: ${field}.`);
            }
        }

        const calculationMode = input.calculationMode || 'items';
        if (!['items', 'purchase', 'refund'].includes(calculationMode)) {
            throw new TypeError('Invalid calculation mode.');
        }

        return {
            schemaVersion: BACKUP_VERSION,
            id: input.id ? String(input.id) : '',
            storeName,
            createdAt: toIsoString(input.createdAt),
            updatedAt: toIsoString(input.updatedAt || input.createdAt),
            calculationMode,
            items,
            purchaseTotalYen: items.reduce((total, item) => total + item.subtotalYen, 0),
            taxRate,
            exchangeRate,
            ...resultFields,
        };
    }

    function createRefundBackup(record, exportedAt = new Date()) {
        if (!record || Array.isArray(record)) throw new TypeError('A backup must contain one store record.');
        return {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: toIsoString(exportedAt),
            records: [createRefundRecord(record)],
        };
    }

    function serializeRefundBackup(record, exportedAt = new Date()) {
        return JSON.stringify(createRefundBackup(record, exportedAt), null, 2);
    }

    function createRefundInvoiceModel(input, issuedAt = new Date()) {
        const record = createRefundRecord(input);
        const refundEligible = record.calculationMode !== 'refund'
            && record.taxExclusivePurchaseYen >= 5000
            && record.refundBeforeFeeYen > 0;
        const taxPercent = Math.round(record.taxRate * 100);
        const formatYen = (value, fractionDigits = 0) => Number(value).toLocaleString('ja-JP', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        });
        return {
            ...record,
            issuedAt: toIsoString(issuedAt),
            refundEligible,
            items: record.items.map((item) => {
                const estimatedRefundYen = refundEligible
                    ? Math.round((item.subtotalYen * record.taxRate / (1 + record.taxRate)) * 100) / 100
                    : null;
                const postRefundUnitPriceYen = estimatedRefundYen === null
                    ? null
                    : Math.round((item.priceYen - estimatedRefundYen / item.quantity) * 100) / 100;
                const refundFormula = record.calculationMode === 'refund'
                    ? '業者已提供退款額，不按商品拆分。'
                    : refundEligible
                        ? `¥${formatYen(item.priceYen)} × ${formatYen(item.quantity)} × ${taxPercent}% ÷ ${100 + taxPercent}% = ¥${formatYen(estimatedRefundYen, 2)}`
                        : `未達退稅門檻：未稅總額 ¥${formatYen(record.taxExclusivePurchaseYen)} < ¥5,000`;
                return {
                    ...item,
                    unitPriceYen: item.priceYen,
                    estimatedRefundYen,
                    postRefundUnitPriceYen,
                    postRefundUnitPriceTwd: postRefundUnitPriceYen === null
                        ? null
                        : Math.round(postRefundUnitPriceYen * record.exchangeRate * 100) / 100,
                    refundFormula,
                };
            }),
        };
    }

    function parseRefundBackup(source) {
        let backup;
        try {
            backup = typeof source === 'string' ? JSON.parse(source) : source;
        } catch (_error) {
            throw new TypeError('Backup is not valid JSON.');
        }
        if (!backup || backup.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(backup.version)) {
            throw new TypeError('Unsupported refund backup format or version.');
        }
        if (!Array.isArray(backup.records)) throw new TypeError('Backup records must be an array.');
        if (backup.records.length === 0 || backup.version === BACKUP_VERSION && backup.records.length !== 1) {
            throw new TypeError('Each JSON backup must contain exactly one store record.');
        }
        return {
            format: BACKUP_FORMAT,
            version: backup.version,
            exportedAt: toIsoString(backup.exportedAt),
            records: backup.records.map((record) => createRefundRecord(record)),
        };
    }

    const refundLedger = {
        BACKUP_FORMAT,
        BACKUP_VERSION,
        createRefundRecord,
        createRefundBackup,
        serializeRefundBackup,
        createRefundInvoiceModel,
        parseRefundBackup,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = refundLedger;
    root.refundLedger = refundLedger;
})(globalThis);