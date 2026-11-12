(function (root) {
    function sumPurchaseItems(items) {
        return items.reduce((total, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            return total + Math.max(0, price) * Math.max(0, quantity);
        }, 0);
    }

    function estimatePurchaseItemRefunds(items, { taxRate, exchangeRate, eligible }) {
        return items.map((item) => {
            const price = Number(item.price);
            const quantity = Number(item.quantity);
            if (!eligible || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
                return {
                    estimatedRefundYen: null,
                    afterRefundTotalYen: null,
                    afterRefundUnitYen: null,
                    afterRefundUnitTwd: null,
                };
            }

            const subtotalYen = price * quantity;
            const estimatedRefundYen = Math.round(subtotalYen * taxRate / (1 + taxRate) * 100) / 100;
            const afterRefundTotalYen = Math.round((subtotalYen - estimatedRefundYen) * 100) / 100;
            const afterRefundUnitYen = Math.round((afterRefundTotalYen / quantity) * 100) / 100;
            return {
                estimatedRefundYen,
                afterRefundTotalYen,
                afterRefundUnitYen,
                afterRefundUnitTwd: Math.round(afterRefundUnitYen * exchangeRate * 100) / 100,
            };
        });
    }

    function roundCashJapanPayout(amountAfterFee) {
        const roundedYen = Math.round(amountAfterFee);
        const base = Math.floor(roundedYen / 100) * 100;
        const tail = roundedYen - base;

        if (tail <= 24) return base;
        if (tail <= 74) return base + 50;
        return base + 100;
    }

    function calculateCashJapanRefund({ mode, amount, taxRate = 0.1, exchangeRate }) {
        if (!Number.isFinite(amount) || amount < 0) {
            throw new RangeError('Amount must be a non-negative number.');
        }
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            throw new RangeError('Exchange rate must be greater than zero.');
        }

        let taxExclusivePurchaseYen = null;
        let refundBeforeFeeYen;
        let eligible = true;

        if (mode === 'purchase' || mode === 'items') {
            if (![0.08, 0.1].includes(taxRate)) {
                throw new RangeError('Tax rate must be 8% or 10%.');
            }
            taxExclusivePurchaseYen = amount / (1 + taxRate);
            eligible = taxExclusivePurchaseYen >= 5000;
            refundBeforeFeeYen = eligible ? Math.round(amount * taxRate / (1 + taxRate)) : 0;
        } else if (mode === 'refund') {
            refundBeforeFeeYen = Math.round(amount);
        } else {
            throw new RangeError('Mode must be purchase or refund.');
        }

        const nominalFeeYen = Math.round(refundBeforeFeeYen * 0.1);
        const amountAfterFeeYen = Math.round(refundBeforeFeeYen * 0.9);
        const payoutYen = eligible ? roundCashJapanPayout(amountAfterFeeYen) : 0;

        return {
            eligible,
            taxExclusivePurchaseYen,
            refundBeforeFeeYen,
            nominalFeeYen,
            amountAfterFeeYen,
            roundingAdjustmentYen: payoutYen - amountAfterFeeYen,
            payoutYen,
            payoutTwd: Math.round(payoutYen * exchangeRate),
        };
    }

    const calculator = {
        calculateCashJapanRefund,
        estimatePurchaseItemRefunds,
        roundCashJapanPayout,
        sumPurchaseItems,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = calculator;
    root.cashJapanCalculator = calculator;
})(globalThis);