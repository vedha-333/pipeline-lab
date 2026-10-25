/**
 * Pipeline Lab - Main Application Controller
 * Orchestrates Parser, Pipeline Engine, Datapath Visualizer, Amdahl Analyzer, and UI.
 */

'use strict';

const EXAMPLES = {
    hazard: {
        name: 'RAW Data Dependency',
        code: `# Read-After-Write Data Hazard Example
ADD R1, R2, R3      # R1 = 100 + 10 = 110
SUB R4, R1, R5      # R4 reads R1 (RAW Hazard on R1)
ADD R6, R4, R7      # R6 reads R4 (RAW Hazard on R4)
SW  R6, 0(R2)       # Store result back to MEM[100]`
    },
    basic: {
        name: 'Independent Instructions',
        code: `# Ideal Pipeline Flow (No Data Hazards)
ADD  R1, R2, R3     # R1 = 100 + 10 = 110
SUB  R4, R5, R6     # R4 = 1 - 6 = -5
ADDI R7, R8, 12     # R7 = 8 + 12 = 20
OR   R9, R2, R3     # R9 = 100 | 10
XOR  R10, R4, R5    # R10 = R4 ^ R5`
    },
    memory: {
        name: 'Load-Use Hazard & Store',
        code: `# Load-Use Data Hazard (Mandatory 1-cycle stall even with forwarding)
LW  R1, 0(R2)       # R1 = MEM[100] (loads 7)
ADD R3, R1, R4      # R3 needs R1 immediately (Load-Use stall)
ADDI R5, R3, 20     # R5 = R3 + 20
SW  R5, 4(R2)       # Store R5 into MEM[104]`
    },
    branch: {
        name: 'Taken Branch & Pipeline Flush',
        code: `# Control Hazard (Taken Branch Penalty)
ADDI R1, R0, 5      # R1 = 5
BEQ  R1, R1, TARGET # Equal -> Branch is TAKEN
ADD  R2, R2, R3     # Young speculative instruction (FLUSHED)
SUB  R4, R5, R6     # Young speculative instruction (FLUSHED)
TARGET: ADDI R4, R0, 99 # Target instruction fetched after branch penalty
SW   R4, 8(R2)      # Store result`
    },
    loop: {
        name: 'Iterative Loop with BNE',
        code: `# Simple 3-iteration Loop
ADDI R1, R0, 3      # Loop counter = 3
ADDI R2, R0, 0      # Sum accumulator = 0
LOOP: ADDI R2, R2, 10 # Accumulate: Sum = Sum + 10
SUBI R1, R1, 1      # Decrement counter
BNE  R1, R0, LOOP   # Loop until R1 == 0
SW   R2, 0(R0)      # Store final sum to MEM[0]`
    },
    logic: {
        name: 'Bitwise & Comparison Ops',
        code: `# Comprehensive ALU Logic Test
ADDI R1, R0, 15     # R1 = 0x0F
ADDI R2, R0, 3      # R2 = 0x03
AND  R3, R1, R2     # R3 = 15 & 3 = 3
OR   R4, R1, R2     # R4 = 15 | 3 = 15
XOR  R5, R1, R2     # R5 = 15 ^ 3 = 12
SLT  R6, R2, R1     # R6 = (3 < 15) ? 1 : 0 = 1`
    },
    shorthand2: {
        name: '2-Operand Shorthand (Rd, Rs)',
        code: `# 2-Operand Shorthand: ADD Rd, Rs  =>  Rd = Rd + Rs
# Great for accumulation and compound expressions

ADDI R1, R0, 10     # R1 = 10  (setup)
ADDI R2, R0, 20     # R2 = 20  (setup)
ADDI R3, R0, 5      # R3 = 5   (setup)

ADD  R1, R2         # R1 = R1 + R2 = 10 + 20 = 30
ADD  R1, R3         # R1 = R1 + R3 = 30 + 5  = 35
SUB  R2, R3         # R2 = R2 - R3 = 20 - 5  = 15
AND  R1, R2         # R1 = R1 & R2 = 35 & 15 = 3`
    },
    shorthand1: {
        name: '1-Operand Shorthand (Rd only)',
        code: `# 1-Operand Shorthand: ADD Rd  =>  Rd = Rd + 1  (auto-increment)
#                        SUB Rd  =>  Rd = Rd - 1  (auto-decrement)

ADDI R1, R0, 0      # R1 = 0  (initialize counter)
ADDI R2, R0, 10     # R2 = 10 (initialize value)

ADD  R1             # R1 = R1 + 1 = 1  (increment)
ADD  R1             # R1 = R1 + 1 = 2  (increment)
ADD  R1             # R1 = R1 + 1 = 3  (increment)
SUB  R2             # R2 = R2 - 1 = 9  (decrement)
SUB  R2             # R2 = R2 - 1 = 8  (decrement)`
    }
};

class AppController {
    constructor() {
        this.parser = new AssemblyParser();
        this.datapath = new DatapathVisualizer('datapathView');
        this.simulationResult = null;
        this.currentCycle = 1;
        this.isPlaying = false;
        this.playInterval = null;
        this.playbackSpeed = 800; // ms per cycle
        this.registerDisplayFormat = 'dec'; // 'dec', 'hex', 'bin'

        const currentISA = typeof ISA !== 'undefined' ? ISA : (typeof window !== 'undefined' ? window.ISA : null);
        this.customRegisters = { ...(currentISA ? currentISA.DEFAULT_REGISTERS : {}) };
        this.customMemory = { ...(currentISA ? currentISA.DEFAULT_MEMORY : {}) };

        this.dom = {
            program: document.getElementById('program'),
            exampleSelect: document.getElementById('example'),
            forwardingToggle: document.getElementById('forwarding'),
            sharedToggle: document.getElementById('shared'),
            runBtn: document.getElementById('run'),
            stepBtn: document.getElementById('step'),
            prevStepBtn: document.getElementById('prevStep'),
            playBtn: document.getElementById('playBtn'),
            resetBtn: document.getElementById('reset'),
            errorBox: document.getElementById('error'),
            lineCount: document.getElementById('lineCount'),
            themeToggle: document.getElementById('themeToggle'),
            registerGrid: document.getElementById('registerGrid'),
            registerActivity: document.getElementById('registerActivity'),
            memoryView: document.getElementById('memory'),
            timeline: document.getElementById('timeline'),
            timelineNote: document.getElementById('timelineNote'),
            hazardsList: document.getElementById('hazards'),
            hazardCount: document.getElementById('hazardCount'),
            runLabel: document.getElementById('runLabel'),
            mInst: document.getElementById('mInst'),
            mCycles: document.getElementById('mCycles'),
            mStalls: document.getElementById('mStalls'),
            mCpi: document.getElementById('mCpi'),
            mSpeed: document.getElementById('mSpeed'),
            mThrough: document.getElementById('mThrough'),
            regFormatSelect: document.getElementById('regFormatSelect'),
            exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            cycleSlider: document.getElementById('cycleSlider'),
            currentCycleLabel: document.getElementById('currentCycleLabel'),
            tabHazardBadge: document.getElementById('tabHazardBadge')
        };

        this.initAmdahl();
        this.bindEvents();
        this.initTheme();
        this.loadInitialProgram();
        this.renderInitialState(); // Show reset state — registers only populate after clicking Run
    }

    initAmdahl() {
        this.amdahl = new AmdahlCalculator({
            fractionInput: document.getElementById('fraction'),
            fractionSlider: document.getElementById('fractionSlider'),
            factorInput: document.getElementById('factor'),
            resultOutput: document.getElementById('amdahlResult'),
            theoreticalMaxOutput: document.getElementById('amdahlMax'),
            chartContainer: document.getElementById('amdahlChart')
        });
    }

    bindEvents() {
        // Run Simulation
        if (this.dom.runBtn) {
            this.dom.runBtn.addEventListener('click', () => this.runSimulation());
        }

        // Stepping
        if (this.dom.stepBtn) {
            this.dom.stepBtn.addEventListener('click', () => this.stepForward());
        }
        if (this.dom.prevStepBtn) {
            this.dom.prevStepBtn.addEventListener('click', () => this.stepBackward());
        }

        // Auto-play / Pause
        if (this.dom.playBtn) {
            this.dom.playBtn.addEventListener('click', () => this.togglePlay());
        }

        // Cycle Slider
        if (this.dom.cycleSlider) {
            this.dom.cycleSlider.addEventListener('input', (e) => {
                const targetCycle = parseInt(e.target.value, 10);
                this.jumpToCycle(targetCycle);
            });
        }

        // Reset
        if (this.dom.resetBtn) {
            this.dom.resetBtn.addEventListener('click', () => this.resetSimulation());
        }

        // Example Selector
        if (this.dom.exampleSelect) {
            this.dom.exampleSelect.addEventListener('change', () => {
                const key = this.dom.exampleSelect.value;
                if (EXAMPLES[key]) {
                    this.dom.program.value = EXAMPLES[key].code;
                    this.saveProgram();
                    this.updateLineCount();
                    this.resetSimulation();
                    if (this.dom.runLabel) this.dom.runLabel.textContent = 'PRESET LOADED · READY TO RUN';
                }
            });
        }

        // Program Editor Input
        if (this.dom.program) {
            this.dom.program.addEventListener('input', () => {
                this.updateLineCount();
                this.saveProgram();
                if (this.dom.exampleSelect) this.dom.exampleSelect.value = 'custom';
                this.resetSimulation();
                if (this.dom.runLabel) this.dom.runLabel.textContent = 'PROGRAM CHANGED · RUN TO UPDATE';
            });

            this.dom.program.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.runSimulation();
                }
            });
        }

        // Config toggles
        if (this.dom.forwardingToggle) {
            this.dom.forwardingToggle.addEventListener('change', () => {
                this.resetSimulation();
                if (this.dom.runLabel) this.dom.runLabel.textContent = 'SETTING CHANGED · RUN TO UPDATE';
            });
        }
        if (this.dom.sharedToggle) {
            this.dom.sharedToggle.addEventListener('change', () => {
                this.resetSimulation();
                if (this.dom.runLabel) this.dom.runLabel.textContent = 'SETTING CHANGED · RUN TO UPDATE';
            });
        }

        // Theme toggle
        if (this.dom.themeToggle) {
            this.dom.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Register Format Select (Dec / Hex / Bin)
        if (this.dom.regFormatSelect) {
            this.dom.regFormatSelect.addEventListener('change', (e) => {
                this.registerDisplayFormat = e.target.value;
                if (this.simulationResult) {
                    this.updateCycleHighlight();
                } else {
                    this.renderInitialState();
                }
            });
        }

        // Export Buttons
        if (this.dom.exportMarkdownBtn) {
            this.dom.exportMarkdownBtn.addEventListener('click', () => this.exportMarkdown());
        }
        if (this.dom.exportCsvBtn) {
            this.dom.exportCsvBtn.addEventListener('click', () => this.exportCsv());
        }

        // Tab Switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.id === targetTab);
                });
            });
        });

        // Top nav link to Datapath View: activate Datapath tab automatically
        const navDatapathLink = document.querySelector('a[href="#datapath-section"]');
        if (navDatapathLink) {
            navDatapathLink.addEventListener('click', () => {
                const dpBtn = document.querySelector('.tab-btn[data-tab="tab-datapath"]');
                if (dpBtn) dpBtn.click();
            });
        }

        // Hero "Open simulator" button smooth scroll and focus
        const heroOpenBtn = document.getElementById('heroOpenBtn');
        if (heroOpenBtn) {
            heroOpenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const simSection = document.getElementById('simulator');
                if (simSection) {
                    simSection.scrollIntoView({ behavior: 'smooth' });
                    if (this.dom.program) {
                        setTimeout(() => this.dom.program.focus(), 400);
                    }
                }
            });
        }
    }

    loadInitialProgram() {
        let saved = null;
        try {
            saved = localStorage.getItem('pipeline-lab-program');
        } catch (e) {}

        if (saved) {
            this.dom.program.value = saved;
            if (this.dom.exampleSelect) this.dom.exampleSelect.value = 'custom';
        } else {
            this.dom.program.value = EXAMPLES.basic.code;
            if (this.dom.exampleSelect) this.dom.exampleSelect.value = 'basic';
        }
        this.updateLineCount();
    }

    saveProgram() {
        try {
            localStorage.setItem('pipeline-lab-program', this.dom.program.value);
        } catch (e) {}
    }

    updateLineCount() {
        if (!this.dom.program || !this.dom.lineCount) return;
        const count = this.dom.program.value.split(/\r?\n/).length;
        this.dom.lineCount.textContent = `${count} line${count === 1 ? '' : 's'}`;
    }

    clearError() {
        if (this.dom.errorBox) {
            this.dom.errorBox.textContent = '';
            this.dom.errorBox.classList.remove('has-error');
        }
    }

    showError(msg) {
        if (this.dom.errorBox) {
            this.dom.errorBox.textContent = msg;
            this.dom.errorBox.classList.add('has-error');
        }
        if (this.dom.runLabel) this.dom.runLabel.textContent = 'ERROR';
    }

    runSimulation(autoAnimate = true) {
        this.pausePlayback();
        this.finishRunButton();
        this.clearError();
        if (this.dom.runBtn) {
            this.dom.runBtn.classList.add('btn-animating', 'is-running');
            this.dom.runBtn.setAttribute('aria-busy', 'true');
            const label = this.dom.runBtn.querySelector('.run-button-label');
            if (label) label.textContent = 'Running pipeline…';
        }

        try {
            const parsed = this.parser.parse(this.dom.program.value);
            const simulator = new PipelineSimulator({
                forwarding: this.dom.forwardingToggle ? this.dom.forwardingToggle.checked : true,
                sharedMemory: this.dom.sharedToggle ? this.dom.sharedToggle.checked : false,
                initialRegisters: this.customRegisters,
                initialMemory: this.customMemory
            });

            this.simulationResult = simulator.simulate(parsed);
            this.currentCycle = 1;

            [this.dom.stepBtn, this.dom.prevStepBtn, this.dom.playBtn,
                this.dom.exportMarkdownBtn, this.dom.exportCsvBtn].forEach(button => {
                if (button) button.disabled = false;
            });

            if (this.dom.cycleSlider) {
                this.dom.cycleSlider.max = this.simulationResult.totalCycles;
                this.dom.cycleSlider.value = 1;
                this.dom.cycleSlider.disabled = false;
            }

            this.renderMetrics(this.simulationResult);
            this.renderTimeline(this.simulationResult);
            this.renderHazards(this.simulationResult.events);
            this.renderMemory(this.simulationResult.memory);
            this.updateCycleHighlight();

            const simulatorSection = document.getElementById('simulator');
            if (simulatorSection) {
                simulatorSection.classList.remove('results-refresh');
                void simulatorSection.offsetWidth;
                simulatorSection.classList.add('results-refresh');
                setTimeout(() => simulatorSection.classList.remove('results-refresh'), 1200);
            }

            if (this.dom.runLabel) this.dom.runLabel.textContent = 'SIMULATING...';

            // Animated step-through from cycle 1 to totalCycles
            if (autoAnimate && this.simulationResult.totalCycles > 1) {
                this.animateSimulationRun();
            } else {
                if (this.dom.runLabel) this.dom.runLabel.textContent = 'SIMULATED';
                this.finishRunButton();
            }
        } catch (err) {
            this.finishRunButton();
            this.showError(err.message);
        }
    }

    finishRunButton() {
        if (!this.dom.runBtn) return;
        this.dom.runBtn.classList.remove('is-running', 'btn-animating');
        this.dom.runBtn.removeAttribute('aria-busy');
        const label = this.dom.runBtn.querySelector('.run-button-label');
        if (label) label.textContent = 'Run Simulation';
    }

    animateSimulationRun() {
        this.isPlaying = true;
        let c = 1;
        this.jumpToCycle(c);

        if (this.dom.playBtn) {
            this.dom.playBtn.innerHTML = '⏸ Pause';
            this.dom.playBtn.classList.add('btn-playing');
        }

        const animSpeed = Math.min(500, Math.max(200, Math.floor(4000 / this.simulationResult.totalCycles)));

        this.playInterval = setInterval(() => {
            if (c >= this.simulationResult.totalCycles) {
                clearInterval(this.playInterval);
                this.playInterval = null;
                this.isPlaying = false;
                if (this.dom.playBtn) {
                    this.dom.playBtn.innerHTML = '▶ Auto Play';
                    this.dom.playBtn.classList.remove('btn-playing');
                }
                if (this.dom.runLabel) this.dom.runLabel.textContent = 'SIMULATED';
                this.finishRunButton();
            } else {
                c++;
                this.jumpToCycle(c);
            }
        }, animSpeed);
    }

    renderMetrics(result) {
        if (this.dom.mInst) this.dom.mInst.textContent = result.instructionCount;
        if (this.dom.mCycles) this.dom.mCycles.textContent = result.totalCycles;
        if (this.dom.mStalls) this.dom.mStalls.textContent = `${result.stallCycles} (${result.flushCycles} flushes)`;
        if (this.dom.mCpi) this.dom.mCpi.textContent = result.cpi.toFixed(2);
        if (this.dom.mSpeed) this.dom.mSpeed.textContent = result.speedup.toFixed(2) + '×';
        if (this.dom.mThrough) this.dom.mThrough.textContent = result.throughput.toFixed(3) + ' / cycle';

        if (this.dom.timelineNote) {
            this.dom.timelineNote.textContent = `${result.instructionCount} instructions completed across ${result.totalCycles} cycles · ${result.forwarding ? 'Forwarding ON' : 'No Forwarding'} · ${result.sharedMemory ? 'Shared Memory' : 'Separate Memories'}`;
        }
    }

    renderTimeline(result) {
        if (!this.dom.timeline) return;

        const maxCycles = Math.max(1, result.totalCycles);
        let html = '<div class="timeline-table-wrap"><table><thead><tr>';
        html += '<th class="col-inst">INSTRUCTION</th>';
        for (let c = 1; c <= maxCycles; c++) {
            html += `<th class="col-cycle" data-cycle="${c}">C${c}</th>`;
        }
        html += '</tr></thead><tbody>';

        result.rows.forEach((row, rIdx) => {
            html += `<tr><td class="col-inst" title="Line ${row.line}"><b>#${rIdx + 1}</b> ${this.escape(row.text)}</td>`;
            for (let c = 1; c <= maxCycles; c++) {
                let cellClass = '';
                let cellContent = '';

                if (row.stages.IF === c) { cellClass = 'IF'; cellContent = 'IF'; }
                else if (row.stages.ID === c) { cellClass = 'ID'; cellContent = 'ID'; }
                else if (row.stages.EX === c) { cellClass = 'EX'; cellContent = 'EX'; }
                else if (row.stages.MEM === c) { cellClass = 'MEM'; cellContent = 'MEM'; }
                else if (row.stages.WB === c) { cellClass = 'WB'; cellContent = 'WB'; }
                else if (row.stalls.includes(c)) { cellClass = 'STALL'; cellContent = 'STALL'; }

                html += `<td class="stage-cell ${cellClass}" data-cycle="${c}" data-row="${rIdx}">${cellContent}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        this.dom.timeline.classList.remove('empty');
        this.dom.timeline.innerHTML = html;

        // Attach click listener to cycle headers & cells
        this.dom.timeline.querySelectorAll('[data-cycle]').forEach(el => {
            el.addEventListener('click', () => {
                const c = parseInt(el.getAttribute('data-cycle'), 10);
                this.jumpToCycle(c);
            });
        });
    }

    renderHazards(events) {
        if (!this.dom.hazardsList) return;
        if (this.dom.hazardCount) {
            this.dom.hazardCount.textContent = `${events.length} EVENT${events.length === 1 ? '' : 'S'}`;
        }
        if (this.dom.tabHazardBadge) {
            if (events.length > 0) {
                this.dom.tabHazardBadge.textContent = events.length;
                this.dom.tabHazardBadge.style.display = 'inline-block';
            } else {
                this.dom.tabHazardBadge.style.display = 'none';
            }
        }

        if (events.length === 0) {
            this.dom.hazardsList.className = 'hazards';
            this.dom.hazardsList.innerHTML = `
                <div class="hazard-item hazard-none">
                    <strong class="tag-none">✓ ZERO HAZARDS DETECTED</strong>
                    <span>All instructions executed through pipeline with 100% ideal overlap.</span>
                </div>
            `;
            return;
        }

        this.dom.hazardsList.className = 'hazards';
        this.dom.hazardsList.innerHTML = events.map(e => {
            let badgeClass = 'tag-data';
            if (e.type === 'LOAD-USE') badgeClass = 'tag-loaduse';
            else if (e.type === 'CONTROL') badgeClass = 'tag-control';
            else if (e.type === 'STRUCTURAL') badgeClass = 'tag-structural';
            else if (e.type === 'FORWARDING') badgeClass = 'tag-forward';

            return `
                <div class="hazard-item ${badgeClass}-border">
                    <div class="hazard-top">
                        <strong class="${badgeClass}">${e.type} HAZARD</strong>
                        <span class="hazard-cycle">Cycle ${e.cycle ?? '—'}</span>
                    </div>
                    <div class="hazard-msg">${this.escape(e.message)}</div>
                </div>
            `;
        }).join('');
    }

    renderRegisters(registers, modifiedRegisters = [], activeRegister = null) {
        if (!this.dom.registerGrid) return;
        const modifiedRegs = new Set(modifiedRegisters);

        this.dom.registerGrid.innerHTML = registers.map((val, idx) => {
            const isChanged = modifiedRegs.has(idx);
            const isWriting = activeRegister === idx;
            let formattedVal = val;
            if (this.registerDisplayFormat === 'hex') {
                formattedVal = '0x' + (val >>> 0).toString(16).toUpperCase();
            } else if (this.registerDisplayFormat === 'bin') {
                formattedVal = '0b' + (val >>> 0).toString(2).padStart(8, '0');
            }

            return `
                <div class="reg-card ${isChanged ? 'reg-changed' : ''} ${isWriting ? 'reg-writeback' : ''}">
                    <div class="reg-name">R${idx}</div>
                    <div class="reg-val" title="${val}">${formattedVal}</div>
                </div>
            `;
        }).join('');
    }

    renderCycleRegisters(snapshot, cycle) {
        const registers = Array(32).fill(0);
        for (let i = 0; i < 32; i++) {
            if (this.customRegisters[i] !== undefined) registers[i] = this.customRegisters[i];
        }
        registers[0] = 0;

        const writtenRegisters = new Set();
        for (let index = 0; index < cycle; index++) {
            const writeback = this.simulationResult.cycleSnapshots[index]?.WB;
            if (writeback && writeback.rd !== null && writeback.rd !== 0) {
                registers[writeback.rd] = writeback.result;
                writtenRegisters.add(writeback.rd);
            }
        }

        const activeRegister = snapshot.WB && snapshot.WB.rd !== 0 ? snapshot.WB.rd : null;
        this.renderRegisters(registers, [...writtenRegisters], activeRegister);

        if (this.dom.registerActivity) {
            this.dom.registerActivity.textContent = activeRegister !== null
                ? `Cycle ${cycle}: R${activeRegister} ← ${registers[activeRegister]} · register write-back`
                : `Cycle ${cycle}: no register write-back`;
        }
    }

    renderMemory(memory) {
        if (!this.dom.memoryView) return;
        const entries = Object.entries(memory).sort((a, b) => +a[0] - +b[0]);

        if (entries.length === 0) {
            this.dom.memoryView.innerHTML = '<div class="muted-box">No data memory locations modified.</div>';
            return;
        }

        this.dom.memoryView.innerHTML = `
            <div class="memory-grid">
                ${entries.map(([addr, val]) => `
                    <div class="memory-cell">
                        <span class="mem-addr">MEM[${addr}]</span>
                        <b class="mem-val">${val}</b>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderInitialState() {
        const dummyRegs = Array(32).fill(0);
        for (let i = 0; i < 32; i++) {
            if (this.customRegisters[i] !== undefined) dummyRegs[i] = this.customRegisters[i];
        }
        this.renderRegisters(dummyRegs, []);
        this.renderMemory(this.customMemory);
        if (this.dom.registerActivity) this.dom.registerActivity.textContent = 'Run the program to watch register write-back.';
    }

    jumpToCycle(cycle) {
        if (!this.simulationResult) return;
        this.currentCycle = Math.max(1, Math.min(cycle, this.simulationResult.totalCycles));
        if (this.dom.cycleSlider) this.dom.cycleSlider.value = this.currentCycle;
        this.updateCycleHighlight();
    }

    stepForward() {
        if (!this.simulationResult) {
            this.runSimulation();
            return;
        }
        if (this.currentCycle < this.simulationResult.totalCycles) {
            this.jumpToCycle(this.currentCycle + 1);
        } else {
            this.jumpToCycle(1); // loop back
        }
    }

    stepBackward() {
        if (!this.simulationResult) return;
        if (this.currentCycle > 1) {
            this.jumpToCycle(this.currentCycle - 1);
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        if (!this.simulationResult) {
            this.runSimulation();
            if (!this.simulationResult) return;
        }

        this.isPlaying = true;
        if (this.dom.playBtn) {
            this.dom.playBtn.innerHTML = '⏸ Pause';
            this.dom.playBtn.classList.add('btn-playing');
        }

        this.playInterval = setInterval(() => {
            if (this.currentCycle >= this.simulationResult.totalCycles) {
                this.jumpToCycle(1);
            } else {
                this.jumpToCycle(this.currentCycle + 1);
            }
        }, this.playbackSpeed);
    }

    pausePlayback() {
        this.isPlaying = false;
        if (this.playInterval) clearInterval(this.playInterval);
        this.playInterval = null;
        if (this.dom.playBtn) {
            this.dom.playBtn.innerHTML = '▶ Auto Play';
            this.dom.playBtn.classList.remove('btn-playing');
        }
    }

    updateCycleHighlight() {
        if (!this.simulationResult) return;
        const cycle = this.currentCycle;

        if (this.dom.currentCycleLabel) {
            this.dom.currentCycleLabel.textContent = `Cycle ${cycle} / ${this.simulationResult.totalCycles}`;
        }

        // Highlight timeline columns
        if (this.dom.timeline) {
            const table = this.dom.timeline.querySelector('table');
            if (table) {
                table.querySelectorAll('th, td').forEach(cell => {
                    const c = parseInt(cell.getAttribute('data-cycle'), 10);
                    if (!isNaN(c)) {
                        cell.classList.toggle('active-cycle', c === cycle);
                        cell.classList.toggle('past-cycle', c < cycle);
                        cell.classList.toggle('future-cycle', c > cycle);
                    }
                });
            }
        }

        // Render Datapath Hardware Snapshot
        const snapshot = this.simulationResult.cycleSnapshots[cycle - 1];
        this.renderCycleRegisters(snapshot, cycle);
        this.datapath.render(snapshot, this.simulationResult);
    }

    resetSimulation() {
        this.pausePlayback();
        this.finishRunButton();
        this.simulationResult = null;
        this.currentCycle = 1;
        this.clearError();

        if (this.dom.runLabel) this.dom.runLabel.textContent = 'READY';
        ['mInst', 'mCycles', 'mStalls', 'mCpi', 'mSpeed', 'mThrough'].forEach(id => {
            if (this.dom[id]) this.dom[id].textContent = '—';
        });

        if (this.dom.timeline) {
            this.dom.timeline.className = 'timeline empty';
            this.dom.timeline.innerHTML = '<div class="empty-state-text">Run a simulation to generate the 5-Stage execution timeline schedule.</div>';
        }
        if (this.dom.timelineNote) {
            this.dom.timelineNote.textContent = 'Run a program to generate cycle chart.';
        }
        if (this.dom.hazardsList) {
            this.dom.hazardsList.className = 'hazards empty-small';
            this.dom.hazardsList.textContent = 'No simulation results yet.';
        }
        if (this.dom.hazardCount) {
            this.dom.hazardCount.textContent = '0 EVENTS';
        }
        if (this.dom.tabHazardBadge) {
            this.dom.tabHazardBadge.style.display = 'none';
        }
        if (this.dom.cycleSlider) {
            this.dom.cycleSlider.value = 1;
            this.dom.cycleSlider.max = 1;
            this.dom.cycleSlider.disabled = true;
        }
        if (this.dom.currentCycleLabel) this.dom.currentCycleLabel.textContent = 'Run a simulation to explore cycles';
        [this.dom.stepBtn, this.dom.prevStepBtn, this.dom.playBtn,
            this.dom.exportMarkdownBtn, this.dom.exportCsvBtn].forEach(button => {
            if (button) button.disabled = true;
        });

        this.datapath.render(null, null);
        this.renderInitialState();
    }

    exportMarkdown() {
        if (!this.simulationResult) {
            alert('Please run a simulation before exporting.');
            return;
        }
        const res = this.simulationResult;
        let md = `# Pipeline Lab - Simulation Report\n\n`;
        md += `**Date:** ${new Date().toLocaleString()}\n`;
        md += `**Total Instructions:** ${res.instructionCount}\n`;
        md += `**Total Cycles:** ${res.totalCycles}\n`;
        md += `**Stalls & Flushes:** ${res.stallCycles} stalls, ${res.flushCycles} flushes\n`;
        md += `**CPI:** ${res.cpi.toFixed(2)}\n`;
        md += `**Throughput:** ${res.throughput.toFixed(3)} instructions/cycle\n`;
        md += `**Speedup vs Non-pipelined:** ${res.speedup.toFixed(2)}×\n\n`;
        md += `## Assembly Program\n\`\`\`asm\n${this.dom.program.value}\n\`\`\`\n\n`;
        md += `## Detected Hazard Events\n`;
        if (res.events.length === 0) {
            md += `*No hazards detected.*\n\n`;
        } else {
            res.events.forEach(e => {
                md += `- **[${e.type}]** Cycle ${e.cycle || '—'}: ${e.message}\n`;
            });
            md += `\n`;
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline_simulation_report_${Date.now()}.md`;
        a.click();
    }

    exportCsv() {
        if (!this.simulationResult) {
            alert('Please run a simulation before exporting.');
            return;
        }
        const res = this.simulationResult;
        let csv = 'Instruction,IF,ID,EX,MEM,WB,Stalls\n';
        res.rows.forEach(r => {
            csv += `"${r.text.replace(/"/g, '""')}",${r.stages.IF || ''},${r.stages.ID || ''},${r.stages.EX || ''},${r.stages.MEM || ''},${r.stages.WB || ''},"${r.stalls.join(';')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline_timeline_${Date.now()}.csv`;
        a.click();
    }

    initTheme() {
        let theme = 'dark';
        try {
            theme = localStorage.getItem('pipeline-lab-theme') || 'dark';
        } catch (e) {}
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        document.body.classList.toggle('light', theme === 'light');
        if (this.dom.themeToggle) {
            this.dom.themeToggle.textContent = theme === 'light' ? '☾' : '☼';
            this.dom.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
        }
        try {
            localStorage.setItem('pipeline-lab-theme', theme);
        } catch (e) {}
    }

    toggleTheme() {
        const isLight = document.body.classList.contains('light');
        this.applyTheme(isLight ? 'dark' : 'light');
        if (this.amdahl) this.amdahl.calculate();
    }

    escape(s) {
        return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

// Global initialization on DOM ready
function initPipelineLab() {
    if (!window.pipelineApp) {
        window.pipelineApp = new AppController();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPipelineLab);
} else {
    initPipelineLab();
}
