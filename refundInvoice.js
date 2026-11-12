(function (root) {
    const WIDTH = 1120;
    const SCALE = 2;
    const COLORS = {
        paper: '#fffefa',
        background: '#eeece5',
        ink: '#26343a',
        muted: '#64737a',
        rule: '#d8d8d0',
        orange: '#e36c36',
        teal: '#24736f',
        stripe: '#f5f4ee',
    };

    function formatYen(value) {
        return `¥${Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    }

    function formatEstimateYen(value) {
        return `¥${Number(value).toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function roundRect(context, x, y, width, height, radius, color) {
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
        context.fillStyle = color;
        context.fill();
    }

    function wrapText(context, text, maxWidth) {
        const lines = [];
        let line = '';
        for (const character of String(text)) {
            const candidate = line + character;
            if (line && context.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = character;
            } else {
                line = candidate;
            }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    }

    function renderRefundInvoiceCanvas(input) {
        const model = root.refundLedger.createRefundInvoiceModel(input);
        const measuringCanvas = document.createElement('canvas');
        const measuringContext = measuringCanvas.getContext('2d');
        measuringContext.font = '18px "Noto Sans TC", "PingFang TC", sans-serif';
        const itemLines = model.items.map((item) => wrapText(measuringContext, item.name, 300));
        const rowHeights = itemLines.map((lines) => Math.max(82, lines.length * 23 + 40));
        const itemHeight = rowHeights.reduce((total, height) => total + height, 0);
        const tableTop = 292;
        const summaryRows = model.calculationMode === 'refund'
            ? [
                ['業者退款額', formatYen(model.refundBeforeFeeYen)],
                ['Cash Japan 服務費', `− ${formatYen(model.serviceFeeYen)}`],
                ['¥50 級距調整', `${model.roundingAdjustmentYen > 0 ? '+' : model.roundingAdjustmentYen < 0 ? '−' : ''}${formatYen(Math.abs(model.roundingAdjustmentYen))}`],
            ]
            : [
                ['購物含稅總額', formatYen(model.purchaseTotalYen)],
                ['消費稅率', `${Math.round(model.taxRate * 100)}%`],
                ['同店未稅總額', formatYen(model.taxExclusivePurchaseYen)],
                ['退稅門檻', model.refundEligible ? '已達 ¥5,000' : '未達 ¥5,000'],
                ['估算退款額', formatYen(model.refundBeforeFeeYen)],
                ['Cash Japan 服務費', `− ${formatYen(model.serviceFeeYen)}`],
                ['¥50 級距調整', `${model.roundingAdjustmentYen > 0 ? '+' : model.roundingAdjustmentYen < 0 ? '−' : ''}${formatYen(Math.abs(model.roundingAdjustmentYen))}`],
            ];
        const height = tableTop + 48 + itemHeight + 28 + summaryRows.length * 38 + 18 + 290;
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH * SCALE;
        canvas.height = height * SCALE;
        const context = canvas.getContext('2d');
        context.scale(SCALE, SCALE);
        context.fillStyle = COLORS.background;
        context.fillRect(0, 0, WIDTH, height);

        roundRect(context, 24, 24, WIDTH - 48, height - 48, 18, COLORS.paper);
        context.fillStyle = COLORS.orange;
        context.fillRect(24, 24, 12, height - 48);

        context.fillStyle = COLORS.orange;
        context.font = '700 17px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('JAPAN TAX REFUND', 68, 78);
        context.fillStyle = COLORS.ink;
        context.font = '700 42px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('Cash Japan', 68, 132);
        context.textAlign = 'right';
        context.fillStyle = COLORS.muted;
        context.font = '600 16px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('REFUND STATEMENT', WIDTH - 68, 76);
        context.font = '16px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText(`估算日期  ${new Intl.DateTimeFormat('zh-TW').format(new Date(model.issuedAt))}`, WIDTH - 68, 108);
        context.textAlign = 'left';

        context.fillStyle = COLORS.muted;
        context.font = '600 14px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('STORE', 68, 184);
        context.fillStyle = COLORS.ink;
        context.font = '700 27px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText(model.storeName, 68, 222, 700);

        const columns = { name: 82, unit: 430, quantity: 520, subtotal: 670, refund: 825, postRefund: WIDTH - 82 };
        context.fillStyle = COLORS.ink;
        context.fillRect(68, tableTop, WIDTH - 136, 48);
        context.fillStyle = '#ffffff';
        context.font = '600 15px "Noto Sans TC", "PingFang TC", sans-serif';
        context.textAlign = 'left';
        context.fillText('商品', columns.name, tableTop + 30);
        context.textAlign = 'right';
        context.fillText('單價', columns.unit, tableTop + 30);
        context.fillText('數量', columns.quantity, tableTop + 30);
        context.fillText('小計', columns.subtotal, tableTop + 30);
        context.fillText('預估退稅', columns.refund, tableTop + 30);
        context.fillText('退稅後單價', columns.postRefund, tableTop + 30);

        let y = tableTop + 48;
        model.items.forEach((item, index) => {
            const rowHeight = rowHeights[index];
            context.fillStyle = index % 2 === 0 ? COLORS.stripe : COLORS.paper;
            context.fillRect(68, y, WIDTH - 136, rowHeight);
            context.fillStyle = COLORS.ink;
            context.font = '18px "Noto Sans TC", "PingFang TC", sans-serif';
            itemLines[index].forEach((line, lineIndex) => {
                context.textAlign = 'left';
                context.fillText(line, columns.name, y + 27 + lineIndex * 23, 300);
            });
            context.textAlign = 'right';
            context.fillText(formatYen(item.unitPriceYen), columns.unit, y + 30);
            context.fillText(String(item.quantity), columns.quantity, y + 30);
            context.font = '600 18px "Noto Sans TC", "PingFang TC", sans-serif';
            context.fillText(formatYen(item.subtotalYen), columns.subtotal, y + 30);
            context.fillStyle = item.estimatedRefundYen === null ? COLORS.muted : COLORS.teal;
            context.fillText(item.estimatedRefundYen === null ? '—' : formatEstimateYen(item.estimatedRefundYen), columns.refund, y + 30);
            context.fillStyle = item.postRefundUnitPriceYen === null ? COLORS.muted : COLORS.ink;
            context.font = '600 16px "Noto Sans TC", "PingFang TC", sans-serif';
            context.fillText(item.postRefundUnitPriceYen === null ? '—' : formatEstimateYen(item.postRefundUnitPriceYen), columns.postRefund, y + 28);
            if (item.postRefundUnitPriceTwd !== null) {
                context.fillStyle = COLORS.teal;
                context.font = '12px "Noto Sans TC", "PingFang TC", sans-serif';
                context.fillText(`≈ NT$${Number(item.postRefundUnitPriceTwd).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, columns.postRefund, y + 52);
            }
            context.textAlign = 'left';
            context.fillStyle = COLORS.muted;
            context.font = '12px "Noto Sans TC", "PingFang TC", sans-serif';
            context.fillText(item.refundFormula, columns.name, y + rowHeight - 12, WIDTH - 164);
            context.fillStyle = COLORS.rule;
            context.fillRect(68, y + rowHeight - 1, WIDTH - 136, 1);
            y += rowHeight;
        });

        y += 28;
        const summaryX = 68;
        const summaryRight = WIDTH - 68;
        summaryRows.forEach(([label, value]) => {
            context.fillStyle = COLORS.muted;
            context.font = '17px "Noto Sans TC", "PingFang TC", sans-serif';
            context.textAlign = 'left';
            context.fillText(label, summaryX + 8, y);
            context.fillStyle = COLORS.ink;
            context.font = '600 17px "Noto Sans TC", "PingFang TC", sans-serif';
            context.textAlign = 'right';
            context.fillText(value, summaryRight - 8, y);
            y += 38;
        });

        y += 18;
        roundRect(context, 68, y, WIDTH - 136, 142, 12, COLORS.ink);
        context.textAlign = 'left';
        context.fillStyle = '#b7d8d2';
        context.font = '600 15px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('ESTIMATED PAYOUT', 94, y + 36);
        context.fillStyle = '#ffffff';
        context.font = '700 40px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText(formatYen(model.payoutYen), 94, y + 88);
        context.textAlign = 'right';
        context.fillStyle = '#ffffff';
        context.font = '700 26px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText(`約 NT$${Number(model.payoutTwd).toLocaleString('zh-TW')}`, WIDTH - 94, y + 58);
        context.fillStyle = '#c9d2d3';
        context.font = '14px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText(`JPY / TWD  ${Number(model.exchangeRate).toFixed(5)}`, WIDTH - 94, y + 94);

        y += 178;
        context.fillStyle = COLORS.teal;
        context.fillRect(68, y, 44, 3);
        context.fillStyle = COLORS.muted;
        context.textAlign = 'left';
        context.font = '14px "Noto Sans TC", "PingFang TC", sans-serif';
        context.fillText('商品分項退稅額為估算；實際退稅與服務費以整筆交易計算。', 68, y + 28);
        context.fillText('請保留原始收據；最終金額以退稅業者交易結果為準。', 68, y + 52);

        return canvas;
    }

    root.refundInvoice = { renderRefundInvoiceCanvas };
})(globalThis);