/**
 * Pipeline Lab - Amdahl's Law Interactive Mathematical Analyzer
 * Calculates speedup, theoretical limits, and generates dynamic SVG curves.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AmdahlCalculator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    class AmdahlCalculator {
        constructor(elements) {
            this.fractionInput = elements.fractionInput;
            this.fractionSlider = elements.fractionSlider;
            this.factorInput = elements.factorInput;
            this.resultOutput = elements.resultOutput;
            this.chartContainer = elements.chartContainer;
            this.theoreticalMaxOutput = elements.theoreticalMaxOutput;

            this.init();
        }

        init() {
            if (this.fractionInput && this.fractionSlider) {
                this.fractionInput.addEventListener('input', () => {
                    let p = Math.max(0, Math.min(100, parseFloat(this.fractionInput.value) || 0));
                    this.fractionSlider.value = p;
                    this.calculate();
                });

                this.fractionSlider.addEventListener('input', () => {
                    this.fractionInput.value = this.fractionSlider.value;
                    this.calculate();
                });
            }

            if (this.factorInput) {
                this.factorInput.addEventListener('input', () => {
                    this.calculate();
                });
            }

            this.calculate();
        }

        calculate() {
            const pPercent = Math.max(0, Math.min(100, parseFloat(this.fractionInput ? this.fractionInput.value : 60) || 0));
            const s = Math.max(1, parseFloat(this.factorInput ? this.factorInput.value : 4) || 1);
            const P = pPercent / 100.0;

            // Amdahl's Law: S_overall = 1 / ((1 - P) + (P / S))
            const denominator = (1 - P) + (P / s);
            const overallSpeedup = denominator > 0 ? (1 / denominator) : 1;

            // Theoretical maximum speedup as S -> infinity: 1 / (1 - P)
            const theoreticalMax = P < 1 ? (1 / (1 - P)) : Infinity;

            if (this.resultOutput) {
                this.resultOutput.textContent = overallSpeedup.toFixed(2) + '×';
            }

            if (this.theoreticalMaxOutput) {
                this.theoreticalMaxOutput.textContent = isFinite(theoreticalMax) ? theoreticalMax.toFixed(2) + '×' : '∞';
            }

            this.renderCurve(P, s, overallSpeedup);
        }

        renderCurve(currentP, currentS, currentSpeedup) {
            if (!this.chartContainer) return;

            const width = 380;
            const height = 140;
            const padding = { top: 15, right: 20, bottom: 25, left: 35 };

            const points = [];
            let maxPlotSpeedup = Math.max(5, currentSpeedup + 1);

            for (let p = 0; p <= 1.0; p += 0.02) {
                const spd = 1 / ((1 - p) + (p / currentS));
                if (spd > maxPlotSpeedup) maxPlotSpeedup = spd;
                points.push({ p, spd });
            }

            const scaleX = p => padding.left + p * (width - padding.left - padding.right);
            const scaleY = spd => (height - padding.bottom) - ((spd - 1) / (maxPlotSpeedup - 1)) * (height - padding.top - padding.bottom);

            let pathD = `M ${scaleX(0)} ${scaleY(1)}`;
            for (const pt of points) {
                pathD += ` L ${scaleX(pt.p)} ${scaleY(pt.spd)}`;
            }

            const currX = scaleX(currentP);
            const currY = scaleY(currentSpeedup);

            this.chartContainer.innerHTML = `
                <svg viewBox="0 0 ${width} ${height}" class="amdahl-svg">
                    <!-- Axes -->
                    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--panel-border)" stroke-width="1.5" />
                    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--panel-border)" stroke-width="1.5" />

                    <!-- Grid line -->
                    <line x1="${padding.left}" y1="${scaleY(maxPlotSpeedup / 2)}" x2="${width - padding.right}" y2="${scaleY(maxPlotSpeedup / 2)}" stroke="var(--panel-border)" stroke-dasharray="3 3" opacity="0.4" />

                    <!-- Labels -->
                    <text x="${padding.left}" y="${height - 6}" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)">0% Parallel</text>
                    <text x="${width - padding.right}" y="${height - 6}" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)" text-anchor="end">100%</text>
                    <text x="${padding.left - 6}" y="${scaleY(1)}" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)" text-anchor="end">1×</text>
                    <text x="${padding.left - 6}" y="${scaleY(maxPlotSpeedup)}" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)" text-anchor="end">${maxPlotSpeedup.toFixed(1)}×</text>

                    <!-- Speedup Curve -->
                    <path d="${pathD}" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linecap="round" />

                    <!-- Current Operating Point -->
                    <circle cx="${currX}" cy="${currY}" r="4.5" fill="var(--cyan)" stroke="#090e17" stroke-width="2" />
                    <text x="${currX}" y="${Math.max(padding.top + 10, currY - 8)}" font-size="9" font-weight="bold" fill="var(--cyan)" font-family="var(--font-mono)" text-anchor="middle">${currentSpeedup.toFixed(2)}×</text>
                </svg>
            `;
        }
    }

    return AmdahlCalculator;
}));
