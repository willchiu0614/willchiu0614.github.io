const test = require('node:test');
const assert = require('node:assert/strict');
const { createRefundRecord } = require('../refundLedger.js');
require('../refundInvoice.js');
const { renderRefundInvoiceCanvas } = global.refundInvoice;

test('exported invoice uses a white background without orange fill blocks', () => {
    const fillRects = [];
    let fillStyle = '';
    const context = {
        set fillStyle(value) {
            fillStyle = value;
        },
        get fillStyle() {
            return fillStyle;
        },
        scale() { },
        fillRect(...rect) {
            fillRects.push({ color: fillStyle, rect });
        },
        beginPath() { },
        roundRect() { },
        fill() { },
        fillText() { },
        measureText(text) {
            return { width: String(text).length * 10 };
        },
    };
    const previousDocument = global.document;
    global.document = {
        createElement() {
            return { getContext: () => context };
        },
    };

    try {
        renderRefundInvoiceCanvas(createRefundRecord({
            storeName: 'Test Store',
            items: [{ name: 'Item', price: 6000, quantity: 1 }],
            taxRate: 0.1,
            exchangeRate: 0.2,
            calculation: {
                taxExclusivePurchaseYen: 5455,
                refundBeforeFeeYen: 545,
                nominalFeeYen: 55,
                roundingAdjustmentYen: 5,
                payoutYen: 500,
                payoutTwd: 100,
            },
            createdAt: '2026-11-13T00:00:00.000Z',
        }));
    } finally {
        if (previousDocument === undefined) delete global.document;
        else global.document = previousDocument;
    }

    assert.equal(fillRects[0].color, '#ffffff');
    assert.ok(fillRects.every(({ color }) => !/orange|#e36c36/i.test(color)));
});