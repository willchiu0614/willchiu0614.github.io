const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createRefundRecord,
    createRefundBackup,
    serializeRefundBackup,
    createRefundInvoiceModel,
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
    const backup = createRefundBackup(record, '2026-11-12T11:00:00.000Z');
    const parsed = parseRefundBackup(JSON.stringify(backup));

    assert.equal(parsed.version, 2);
    assert.equal(parsed.exportedAt, '2026-11-12T11:00:00.000Z');
    assert.equal(parsed.records[0].storeName, 'Bic Camera Shinjuku');
    assert.equal(parsed.records[0].items[1].name, 'SD card');
});

test('refund JSON export contains exactly one store record', () => {
    const text = serializeRefundBackup(recordInput, '2026-11-12T11:00:00.000Z');
    const parsed = parseRefundBackup(text);

    assert.match(text, /\n  "format":/);
    assert.equal(parsed.records.length, 1);
    assert.equal(parsed.records[0].storeName, 'Bic Camera Shinjuku');
    assert.throws(() => serializeRefundBackup([recordInput, { ...recordInput, storeName: 'Kyoto Store' }]), /one store/i);
});

test('legacy multi-store backups remain readable for individual selection', () => {
    const backup = createRefundBackup(recordInput, '2026-11-12T11:00:00.000Z');
    backup.version = 1;
    backup.records.push(createRefundRecord({ ...recordInput, storeName: 'Kyoto Store' }));

    const parsed = parseRefundBackup(JSON.stringify(backup));

    assert.deepEqual(parsed.records.map((record) => record.storeName), [
        'Bic Camera Shinjuku',
        'Kyoto Store',
    ]);

    const invalidV2 = createRefundBackup(recordInput, '2026-11-12T11:00:00.000Z');
    invalidV2.records.push(createRefundRecord({ ...recordInput, storeName: 'Kyoto Store' }));
    assert.throws(() => parseRefundBackup(invalidV2), /one store/i);
});

test('invoice model contains one store itemization and refund totals', () => {
    const model = createRefundInvoiceModel(createRefundRecord(recordInput), '2026-11-12T12:00:00.000Z');

    assert.equal(model.storeName, 'Bic Camera Shinjuku');
    assert.deepEqual(model.items.map(({ name, quantity, subtotalYen }) => ({ name, quantity, subtotalYen })), [
        { name: 'Camera', quantity: 1, subtotalYen: 50000 },
        { name: 'SD card', quantity: 2, subtotalYen: 4000 },
    ]);
    assert.equal(model.purchaseTotalYen, 54000);
    assert.equal(model.payoutYen, 4450);
    assert.equal(model.issuedAt, '2026-11-12T12:00:00.000Z');
    assert.equal(model.refundEligible, true);
    assert.deepEqual(model.items.map(({ estimatedRefundYen }) => estimatedRefundYen), [
        4545.45,
        363.64,
    ]);
    assert.deepEqual(model.items.map(({ postRefundUnitPriceYen }) => postRefundUnitPriceYen), [
        45454.55,
        1818.18,
    ]);
    assert.deepEqual(model.items.map(({ postRefundUnitPriceTwd }) => postRefundUnitPriceTwd), [
        9545.46,
        381.82,
    ]);
    assert.match(model.items[0].refundFormula, /¥50,000 × 1 × 10% ÷ 110%/);
});

test('invoice hides item refund amounts when the purchase is below the tax-free threshold', () => {
    const calculation = require('../cashJapanCalculator.js').calculateCashJapanRefund({
        mode: 'items',
        amount: 4000,
        taxRate: 0.1,
        exchangeRate: 0.21,
    });
    const model = createRefundInvoiceModel({
        ...recordInput,
        items: [{ name: 'Snack', price: 4000, quantity: 1 }],
        calculation,
    });

    assert.equal(model.refundEligible, false);
    assert.equal(model.items[0].estimatedRefundYen, null);
    assert.equal(model.items[0].postRefundUnitPriceYen, null);
    assert.equal(model.items[0].postRefundUnitPriceTwd, null);
    assert.match(model.items[0].refundFormula, /未達/);
});

test('invoice shows item refund amounts when the untaxed total exactly meets the threshold', () => {
    const calculation = require('../cashJapanCalculator.js').calculateCashJapanRefund({
        mode: 'items',
        amount: 5500,
        taxRate: 0.1,
        exchangeRate: 0.21,
    });
    const model = createRefundInvoiceModel({
        ...recordInput,
        items: [{ name: 'Item', price: 5500, quantity: 1 }],
        calculation,
    });

    assert.equal(model.taxExclusivePurchaseYen, 5000);
    assert.equal(model.refundEligible, true);
    assert.equal(model.items[0].estimatedRefundYen, 500);
});

test('invoice does not split a refund amount supplied by the operator', () => {
    const calculation = require('../cashJapanCalculator.js').calculateCashJapanRefund({
        mode: 'refund',
        amount: 5000,
        exchangeRate: 0.21,
    });
    const model = createRefundInvoiceModel({
        ...recordInput,
        calculationMode: 'refund',
        items: [{ name: '業者退款額', price: 5000, quantity: 1 }],
        calculation,
    });

    assert.equal(model.refundEligible, false);
    assert.equal(model.items[0].estimatedRefundYen, null);
    assert.match(model.items[0].refundFormula, /業者已提供退款額/);
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