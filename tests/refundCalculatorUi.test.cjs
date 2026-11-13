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

test('per-item refund estimates stay collapsed until requested', () => {
    assert.ok(/estimateDetails\.className = 'refund-item-estimate'/.test(html));
    assert.ok(/estimateToggle\.textContent = '查看退稅估算'/.test(html));
    assert.ok(/estimateDetails\.append\(estimateToggle, summary\)/.test(html));
    assert.ok(/summary\.append\(subtotalLine, afterRefund, afterUnitLine\)/.test(html));
    assert.ok(/row\.querySelector\('\[data-item-estimate-preview\]'\)\.textContent\s*=/.test(html));
    assert.doesNotMatch(html, /estimateDetails\.open\s*=\s*true/);
});

test('refund fee breakdown and formula are inside a collapsed details section', () => {
    const details = html.match(/<details class="refund-result-details">([\s\S]*?)<\/details>/);

    assert.ok(details, 'refund details should be collapsible');
    assert.ok(/refund-result-breakdown/.test(details[1]));
    assert.ok(/refund-formula/.test(details[1]));
    assert.equal((html.match(/id="cash-calc-refund"/g) || []).length, 1);
    assert.equal((html.match(/id="cash-calc-fee"/g) || []).length, 1);
    assert.ok(/cash-calc-message/.test(html.slice(0, html.indexOf(details[0]))), 'eligibility message should stay visible');
    assert.doesNotMatch(details[0], /<details\b[^>]*\bopen(?:\s|=|>)/);
});

test('refund disclosure has an explicit expand and collapse icon', () => {
    assert.ok(/\.refund-result-details > summary::after/.test(html));
    assert.ok(/\.refund-result-details\[open\] > summary::after/.test(html));
});

test('rate settings and refund details share the same disclosure styling and icon', () => {
    assert.ok(/\.refund-rate-settings > summary,\s*\.refund-result-details > summary\s*\{/.test(html));
    assert.ok(/\.refund-rate-settings > summary::-webkit-details-marker,\s*\.refund-result-details > summary::-webkit-details-marker/.test(html));
    assert.ok(/\.refund-rate-settings > summary::after,\s*\.refund-result-details > summary::after/.test(html));
    assert.ok(/\.refund-rate-settings\[open\] > summary::after,\s*\.refund-result-details\[open\] > summary::after/.test(html));
});

test('calculator explanation stays in a collapsed disclosure with its source link', () => {
    const note = html.match(/<details class="refund-result-details refund-calc-note-details">([\s\S]*?)<\/details>/);

    assert.ok(note, 'calculator explanation should be collapsible');
    assert.ok(note[1].includes('購物總額模式按含稅價格推算稅額'));
    assert.ok(note[1].includes('單筆最低／最高費及實際退款額仍依交易而異'));
    assert.ok(/href="https:\/\/www\.exchangerate-api\.com\/"/.test(note[1]));
    assert.doesNotMatch(note[0], /<details\b[^>]*\bopen(?:\s|=|>)/);
});

test('calculator entry fields have no placeholder hints or introductory heading', () => {
    assert.ok(!/現金退稅試算/.test(html));
    assert.ok(!/<input\s+id="cash-calc-store-name"[^>]*placeholder=/s.test(html));
    assert.ok(!/nameInput\.placeholder\s*=|priceInput\.placeholder\s*=/.test(html));
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