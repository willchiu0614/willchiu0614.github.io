const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
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

test('stores with coupons open locally saved coupon images in a dialog', () => {
    const expectedCoupons = new Map([
        ['Bic Camera', 'bic-camera'],
        ['山田電機 LABI', 'yamada-denki'],
        ['鶴羽藥妝', 'tsuruha-drug'],
        ['松本清', 'matsumoto-kiyoshi'],
        ['Cocokara Fine', 'cocokara-fine'],
        ['札幌藥妝', 'sapporo-drug'],
        ['SUNDRUG', 'sundrug'],
        ['唐吉訶德', 'don-quijote'],
        ['KoKuMiN', 'kokumin'],
        ['COSMOS*', 'cosmos'],
        ['Sugi 藥局', 'sugi-pharmacy'],
        ['LAOX（合作門市）', 'laox'],
        ['大丸京都店', 'daimaru'],
        ['大丸梅田店', 'daimaru'],
        ['大丸心齋橋店', 'daimaru'],
    ]);
    const couponButtons = new Map();
    const buttonPattern = /<button\b([^>]*)data-coupon-store="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g;

    for (const match of html.matchAll(buttonPattern)) {
        const attributes = `${match[1]} ${match[3]}`;
        couponButtons.set(match[2], {
            image: attributes.match(/\bdata-coupon-image="([^"]+)"/)?.[1],
            type: attributes.match(/\btype="([^"]+)"/)?.[1],
            dialog: attributes.match(/\baria-controls="([^"]+)"/)?.[1],
            text: match[4].replace(/<[^>]*>/g, '').trim(),
        });
    }

    for (const [store, image] of expectedCoupons) {
        const button = couponButtons.get(store);
        assert.ok(button, `${store} should open its coupon image`);
        assert.equal(button.image, `./assets/coupons/${image}.png`);
        assert.equal(button.type, 'button');
        assert.equal(button.dialog, 'refund-coupon-dialog');
        assert.ok(button.text.includes(store));
        assert.ok(statSync(join(__dirname, '..', button.image)).size > 0, `${image}.png should exist`);
    }

    assert.match(html, /<dialog\b[^>]*id="refund-coupon-dialog"/);
    assert.doesNotMatch(html, /<a\b[^>]*data-coupon-store=/, 'coupon stores should not navigate away');
});