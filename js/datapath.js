/**
 * Pipeline Lab - Interactive 5-Stage RISC Datapath Visualizer
 * Renders an animated SVG schematic of the pipeline hardware with active instructions,
 * pipeline registers (IF/ID, ID/EX, EX/MEM, MEM/WB), forwarding wires, and control signals.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DatapathVisualizer = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    class DatapathVisualizer {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
        }

        render(snapshot, result) {
            if (!this.container) return;
            if (!snapshot || !result) {
                this.container.innerHTML = `
                    <div class="datapath-placeholder" style="padding: 40px; text-align: center; color: var(--text-muted);">
                        <div class="datapath-empty-icon" style="font-size: 2rem; margin-bottom: 12px; color: var(--cyan);">⚏</div>
                        <p>Run simulation and scrub through cycles to view active instructions in the 5-Stage RISC Datapath architecture.</p>
                    </div>
                `;
                return;
            }

            const ifInst = snapshot.IF ? snapshot.IF.text : 'Bubble (Idle)';
            const idInst = snapshot.ID ? snapshot.ID.text : 'Bubble (Idle)';
            const exInst = snapshot.EX ? snapshot.EX.text : 'Bubble (Idle)';
            const memInst = snapshot.MEM ? snapshot.MEM.text : 'Bubble (Idle)';
            const wbInst = snapshot.WB ? snapshot.WB.text : 'Bubble (Idle)';

            const isForwardA = snapshot.forwardA > 0 || (snapshot.EX && snapshot.EX.forwardingInfo && snapshot.EX.forwardingInfo.length > 0);
            const isForwardB = snapshot.forwardB > 0;
            const isStall = snapshot.stalls && snapshot.stalls.length > 0;

            const signals = snapshot.signals || {};

            this.container.innerHTML = `
                <div class="datapath-wrapper">
                    <div class="datapath-header">
                        <div class="cycle-pill">Clock Cycle: <b>${snapshot.cycle}</b> of ${result.totalCycles}</div>
                        <div class="datapath-status-pills">
                            <span class="dp-tag ${isStall ? 'dp-tag-stall' : 'dp-tag-active'}">${isStall ? '⚠ STALL INSERTED' : '✓ NORMAL FLOW'}</span>
                            <span class="dp-tag ${isForwardA ? 'dp-tag-forward' : ''}">${isForwardA ? '⇄ FORWARDING ACTIVE' : 'NO FORWARDING'}</span>
                        </div>
                    </div>

                    <div class="datapath-stages-grid">
                        <!-- IF STAGE -->
                        <div class="stage-card ${snapshot.IF ? 'stage-card-active if-active' : 'stage-card-idle'}">
                            <div class="stage-card-head">
                                <span class="stage-code">IF</span>
                                <span class="stage-name">Instruction Fetch</span>
                            </div>
                            <div class="stage-inst">${this.escape(ifInst)}</div>
                            <div class="stage-details">
                                <div class="hw-block"><small>PC Unit</small><span>PC: 0x${((snapshot.cycle - 1) * 4).toString(16).padStart(4, '0')}</span></div>
                                <div class="hw-block"><small>I-Cache</small><span>32-bit Fetch</span></div>
                            </div>
                        </div>

                        <!-- LATCH IF/ID -->
                        <div class="pipeline-latch ${snapshot.IF && snapshot.ID ? 'latch-active' : ''}">
                            <div class="latch-label">IF/ID</div>
                        </div>

                        <!-- ID STAGE -->
                        <div class="stage-card ${snapshot.ID ? 'stage-card-active id-active' : 'stage-card-idle'}">
                            <div class="stage-card-head">
                                <span class="stage-code">ID</span>
                                <span class="stage-name">Decode / Reg Read</span>
                            </div>
                            <div class="stage-inst">${this.escape(idInst)}</div>
                            <div class="stage-details">
                                <div class="hw-block"><small>Reg Read</small><span>Rs: ${snapshot.ID ? 'R' + (snapshot.ID.rs ?? '—') : '—'}, Rt: ${snapshot.ID ? 'R' + (snapshot.ID.rt ?? '—') : '—'}</span></div>
                                <div class="hw-block"><small>Hazard Unit</small><span>${isStall ? 'Stall Bubble' : 'No Conflict'}</span></div>
                            </div>
                        </div>

                        <!-- LATCH ID/EX -->
                        <div class="pipeline-latch ${snapshot.ID && snapshot.EX ? 'latch-active' : ''}">
                            <div class="latch-label">ID/EX</div>
                        </div>

                        <!-- EX STAGE -->
                        <div class="stage-card ${snapshot.EX ? 'stage-card-active ex-active' : 'stage-card-idle'}">
                            <div class="stage-card-head">
                                <span class="stage-code">EX</span>
                                <span class="stage-name">Execution / ALU</span>
                            </div>
                            <div class="stage-inst">${this.escape(exInst)}</div>
                            <div class="stage-details">
                                <div class="hw-block"><small>ALU Op</small><span>${signals.ALUOp || '—'}</span></div>
                                <div class="hw-block"><small>Forward MUX</small><span>${isForwardA ? 'EX/MEM Bypass' : 'Direct Reg'}</span></div>
                            </div>
                        </div>

                        <!-- LATCH EX/MEM -->
                        <div class="pipeline-latch ${snapshot.EX && snapshot.MEM ? 'latch-active' : ''}">
                            <div class="latch-label">EX/MEM</div>
                        </div>

                        <!-- MEM STAGE -->
                        <div class="stage-card ${snapshot.MEM ? 'stage-card-active mem-active' : 'stage-card-idle'}">
                            <div class="stage-card-head">
                                <span class="stage-code">MEM</span>
                                <span class="stage-name">Data Memory</span>
                            </div>
                            <div class="stage-inst">${this.escape(memInst)}</div>
                            <div class="stage-details">
                                <div class="hw-block"><small>Access</small><span>${snapshot.MEM ? (snapshot.MEM.isLoad ? 'READ MEM' : snapshot.MEM.isStore ? 'WRITE MEM' : 'NOP') : 'Idle'}</span></div>
                                <div class="hw-block"><small>Data Out</small><span>${snapshot.MEM ? snapshot.MEM.result : '—'}</span></div>
                            </div>
                        </div>

                        <!-- LATCH MEM/WB -->
                        <div class="pipeline-latch ${snapshot.MEM && snapshot.WB ? 'latch-active' : ''}">
                            <div class="latch-label">MEM/WB</div>
                        </div>

                        <!-- WB STAGE -->
                        <div class="stage-card ${snapshot.WB ? 'stage-card-active wb-active' : 'stage-card-idle'}">
                            <div class="stage-card-head">
                                <span class="stage-code">WB</span>
                                <span class="stage-name">Write Back</span>
                            </div>
                            <div class="stage-inst">${this.escape(wbInst)}</div>
                            <div class="stage-details">
                                <div class="hw-block"><small>RegWrite</small><span>${snapshot.WB && snapshot.WB.rd ? `R${snapshot.WB.rd} ← ${snapshot.WB.result}` : 'None'}</span></div>
                                <div class="hw-block"><small>MemToReg</small><span>${snapshot.WB ? (snapshot.WB.isLoad ? 'Memory' : 'ALU') : '—'}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Hardware Control Signals Table -->
                    <div class="datapath-signals-panel">
                        <div class="signals-title">Active Control Signals (EX Stage)</div>
                        <div class="signals-grid">
                            <div class="sig-item"><span>RegDst</span><b>${signals.RegDst ?? 0}</b></div>
                            <div class="sig-item"><span>ALUSrc</span><b>${signals.ALUSrc ?? 0}</b></div>
                            <div class="sig-item"><span>MemToReg</span><b>${signals.MemToReg ?? 0}</b></div>
                            <div class="sig-item"><span>RegWrite</span><b>${signals.RegWrite ?? 0}</b></div>
                            <div class="sig-item"><span>MemRead</span><b>${signals.MemRead ?? 0}</b></div>
                            <div class="sig-item"><span>MemWrite</span><b>${signals.MemWrite ?? 0}</b></div>
                            <div class="sig-item"><span>Branch</span><b>${signals.Branch ?? 0}</b></div>
                            <div class="sig-item"><span>ALUOp</span><b>${signals.ALUOp ?? 'NOP'}</b></div>
                        </div>
                    </div>
                </div>
            `;
        }

        escape(str) {
            return (str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
    }

    return DatapathVisualizer;
}));
