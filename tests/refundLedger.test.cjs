const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createRefundRecord,
    createRefundBackup,
    parseRefundBackup,
} = require('../refundLedger.js');

const recordInput = {
    storeName: '  Bic Camera Shinjuku  ',
    items: [
        { name: 'Camera', price: 50000, quantity: 1 },
        { name: 'SD card', price: 2000, quantity: 2 },
    ],
    taxRate: 0.1,
    exchangeRate: 0.21,
    calculation: {
        taxExclusivePurchaseYen: 49091,
        refundBeforeFeeYen: 4909,
        nominalFeeYen: 491,
        roundingAdjustmentYen: -18,
        payoutYen: 4450,
        payoutTwd: 935,
    },
    createdAt: '2026-11-12T10:00:00.000Z',
};

test('refund record trims store name and preserves named item details and totals', () => {
    const record = createRefundRecord(recordInput);

    assert.equal(record.storeName, 'Bic Camera Shinjuku');
    assert.deepEqual(record.items.map(({ name, subtotalYen }) => ({ name, subtotalYen })), [
        { name: 'Camera', subtotalYen: 50000 },
        { name: 'SD card', subtotalYen: 4000 },
    ]);
    assert.equal(record.purchaseTotalYen, 54000);
    assert.equal(record.payoutYen, 4450);
    assert.equal(record.calculationMode, 'items');
});

test('refund amount records preserve a null purchase tax base and calculation mode', () => {
    const record = createRefundRecord({
        ...recordInput,
        calculationMode: 'refund',
        calculation: { ...recordInput.calculation, taxExclusivePurchaseYen: null },
    });

    assert.equal(record.calculationMode, 'refund');
    assert.equal(record.taxExclusivePurchaseYen, null);
    assert.equal(record.createdAt, '2026-11-12T10:00:00.000Z');
});

test('refund record rejects a missing store name or invalid item values', () => {
    assert.throws(() => createRefundRecord({ ...recordInput, storeName: '  ' }), /store name/i);
    assert.throws(() => createRefundRecord({ ...recordInput, items: [{ name: 'Bad', price: -1, quantity: 1 }] }), /item/i);
});

test('refund record rejects names and item counts beyond the storage contract', () => {
    assert.throws(() => createRefundRecord({ ...recordInput, storeName: 's'.repeat(121) }), /store name/i);
    assert.throws(() => createRefundRecord({
        ...recordInput,
        items: [{ name: 'n'.repeat(121), price: 1, quantity: 1 }],
    }), /item/i);
    assert.throws(() => createRefundRecord({
        ...recordInput,
        items: Array.from({ length: 101 }, () => ({ name: 'Item', price: 1, quantity: 1 })),
    }), /item/i);
});

test('refund backup round-trips records with a version and export timestamp', () => {
    const record = createRefundRecord(recordInput);
    const backup = createRefundBackup([record], '2026-11-12T11:00:00.000Z');
    const parsed = parseRefundBackup(JSON.stringify(backup));

    assert.equal(parsed.version, 1);
    assert.equal(parsed.exportedAt, '2026-11-12T11:00:00.000Z');
    assert.equal(parsed.records[0].storeName, 'Bic Camera Shinjuku');
    assert.equal(parsed.records[0].items[1].name, 'SD card');
});

test('refund backup rejects unknown versions and malformed records', () => {
    assert.throws(() => parseRefundBackup(JSON.stringify({ version: 99, records: [] })), /version/i);
    assert.throws(() => parseRefundBackup(JSON.stringify({
        format: 'kansai-tax-refund-ledger',
        version: 1,
        exportedAt: '2026-11-12T11:00:00.000Z',
        records: [{}],
    })), /record/i);
});