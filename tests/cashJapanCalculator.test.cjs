const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCashJapanRefund, roundCashJapanPayout } = require('../cashJapanCalculator.js');

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