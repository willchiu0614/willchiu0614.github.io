const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

test('tax rate and exchange rate controls share a collapsed disclosure', () => {
    const disclosure = html.match(/<details class="refund-rate-settings">([\s\S]*?)<\/details>/);

    assert.ok(disclosure, 'expected a rate settings disclosure');
    assert.ok(/id="cash-calc-tax-rate"/.test(disclosure[1]), 'tax rate should be inside the disclosure');
    assert.ok(/id="cash-calc-fx"/.test(disclosure[1]), 'exchange rate should be inside the disclosure');
    assert.doesNotMatch(disclosure[0], /<details\b[^>]*\bopen(?:\s|=|>)/);
});

test('item summary renders before-tax and after-tax totals and unit price in JPY and TWD', () => {
    assert.ok(/退稅前總價/.test(html), 'before-refund total label should be shown');
    assert.ok(/退稅後總價/.test(html), 'after-refund total label should be shown');
    assert.ok(/退稅後單價/.test(html), 'after-refund unit label should be shown');
    assert.ok(/row\.querySelector\('\[data-item-subtotal\]'\)\.textContent\s*=/.test(html), 'before-refund total should render both currencies');
    assert.ok(/row\.querySelector\('\[data-item-after-total\]'\)/.test(html), 'after-refund total output should exist');
    assert.ok(/row\.querySelector\('\[data-item-after-unit\]'\)/.test(html), 'after-refund unit output should exist');
    assert.ok(/estimate\.afterRefundTotalYen \* exchangeRate/.test(html), 'after-refund total should convert to TWD');
    assert.ok(/estimate\.afterRefundUnitTwd/.test(html), 'after-refund unit should render its TWD estimate');
});