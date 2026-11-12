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

test('item subtotal and after-refund unit render TWD estimates', () => {
    assert.ok(/row\.querySelector\('\[data-item-subtotal-twd\]'\)/.test(html), 'subtotal TWD output should be queried');
    assert.ok(/row\.querySelector\('\[data-item-after-unit-twd\]'\)/.test(html), 'after-refund TWD output should be queried');
    assert.ok(/subtotalTwd\.textContent\s*=/.test(html), 'subtotal TWD output should be rendered');
    assert.ok(/afterUnitTwd\.textContent\s*=/.test(html), 'after-refund TWD output should be rendered');
});