(function (root) {
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

        if (mode === 'purchase') {
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

    const calculator = { calculateCashJapanRefund, roundCashJapanPayout };
    if (typeof module !== 'undefined' && module.exports) module.exports = calculator;
    root.cashJapanCalculator = calculator;
})(globalThis);