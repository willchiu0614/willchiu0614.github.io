const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateCashJapanRefund,
    estimatePurchaseItemRefunds,
    roundCashJapanPayout,
    sumPurchaseItems,
} = require('../cashJapanCalculator.js');

test('gross purchase below the daily tax-free threshold returns zero', () => {
    const result = calculateCashJapanRefund({
        mode: 'purchase',
        amount: 1000,
        taxRate: 0.1,
        exchangeRate: 0.21,
    });

    assert.equal(result.eligible, false);
    assert.equal(result.payoutYen, 0);
});

test('gross purchase estimates tax, Cash Japan fee, rounding, and TWD', () => {
    const result = calculateCashJapanRefund({
        mode: 'purchase',
        amount: 5500,
        taxRate: 0.1,
        exchangeRate: 0.21,
    });

    assert.equal(result.eligible, true);
    assert.equal(result.refundBeforeFeeYen, 500);
    assert.equal(result.nominalFeeYen, 50);
    assert.equal(result.payoutYen, 450);
    assert.equal(result.payoutTwd, 95);
});

test('purchase threshold adjusts for the selected consumption tax rate', () => {
    const result = calculateCashJapanRefund({
        mode: 'purchase',
        amount: 5400,
        taxRate: 0.08,
        exchangeRate: 0.21,
    });

    assert.equal(result.eligible, true);
    assert.equal(result.taxExclusivePurchaseYen, 5000);
});

test('direct operator refund amount skips tax estimation', () => {
    const result = calculateCashJapanRefund({
        mode: 'refund',
        amount: 1000,
        exchangeRate: 0.21,
    });

    assert.equal(result.refundBeforeFeeYen, 1000);
    assert.equal(result.payoutYen, 900);
    assert.equal(result.payoutTwd, 189);
});

test('Cash Japan rounds the post-fee payout to the nearest 50 yen', () => {
    assert.equal(roundCashJapanPayout(424), 400);
    assert.equal(roundCashJapanPayout(425), 450);
    assert.equal(roundCashJapanPayout(474), 450);
    assert.equal(roundCashJapanPayout(475), 500);
});

test('purchase items sum unit price multiplied by quantity', () => {
    assert.equal(sumPurchaseItems([
        { price: 1200, quantity: 2 },
        { price: 350, quantity: 3 },
    ]), 3450);
});

test('empty purchase item list sums to zero', () => {
    assert.equal(sumPurchaseItems([]), 0);
});

test('item list mode uses the summed gross purchase amount', () => {
    const result = calculateCashJapanRefund({
        mode: 'items',
        amount: sumPurchaseItems([
            { price: 5000, quantity: 1 },
            { price: 500, quantity: 1 },
        ]),
        taxRate: 0.1,
        exchangeRate: 0.21,
    });

    assert.equal(result.eligible, true);
    assert.equal(result.refundBeforeFeeYen, 500);
    assert.equal(result.payoutYen, 450);
});

test('eligible purchase items show estimated after-refund totals and unit prices', () => {
    const result = estimatePurchaseItemRefunds([
        { name: 'Coffee', price: 5500, quantity: 1 },
        { name: 'Tea', price: 1000, quantity: 2 },
    ], { taxRate: 0.1, exchangeRate: 0.2, eligible: true });

    assert.deepEqual(result.map(({ estimatedRefundYen, afterRefundTotalYen, afterRefundUnitYen, afterRefundUnitTwd }) => ({
        estimatedRefundYen,
        afterRefundTotalYen,
        afterRefundUnitYen,
        afterRefundUnitTwd,
    })), [
        { estimatedRefundYen: 500, afterRefundTotalYen: 5000, afterRefundUnitYen: 5000, afterRefundUnitTwd: 1000 },
        { estimatedRefundYen: 181.82, afterRefundTotalYen: 1818.18, afterRefundUnitYen: 909.09, afterRefundUnitTwd: 181.82 },
    ]);
});

test('ineligible purchases do not show estimated after-refund prices', () => {
    const result = estimatePurchaseItemRefunds([
        { name: 'Snack', price: 3000, quantity: 1 },
    ], { taxRate: 0.1, exchangeRate: 0.2, eligible: false });

    assert.equal(result[0].estimatedRefundYen, null);
    assert.equal(result[0].afterRefundTotalYen, null);
    assert.equal(result[0].afterRefundUnitYen, null);
    assert.equal(result[0].afterRefundUnitTwd, null);
});

test('incomplete item rows do not produce NaN after-refund values', () => {
    const result = estimatePurchaseItemRefunds([
        { name: 'Editing row', price: 1200, quantity: 0 },
    ], { taxRate: 0.1, exchangeRate: 0.2, eligible: true });

    assert.equal(result[0].afterRefundUnitYen, null);
    assert.equal(result[0].afterRefundUnitTwd, null);
});