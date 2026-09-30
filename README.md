# Pipeline Lab — 5-Stage RISC Architecture Studio

An interactive Computer Organization and Architecture (COA) simulation platform for exploring instruction-level parallelism, pipeline timing, data hazards, hardware latches, forwarding units, and CPU performance analysis.

> **Live Preview:** Open `index.html` in any modern web browser or start a local server (`python -m http.server 5500`). Zero external dependencies or build steps required.

---

## 🚀 Key Highlights & Capabilities

- **Interactive 5-Stage Datapath Hardware Visualizer:** Live architectural schematic showing active instructions inside `IF`, `ID`, `EX`, `MEM`, and `WB` stages, inter-stage latches (`IF/ID`, `ID/EX`, `EX/MEM`, `MEM/WB`), and control signal lines (`RegWrite`, `ALUSrc`, `MemRead`, `MemWrite`, `Branch`, `MemToReg`).
- **Comprehensive Hazard Modeling & Resolution:**
  - **RAW Data Hazards:** Dynamic bypass forwarding paths from `EX/MEM` and `MEM/WB` directly to the ALU.
  - **Load-Use Hazards:** Automatic detection of memory latency requiring 1 stall bubble in `ID`.
  - **Structural Hazards:** Unified memory bus conflict modeling (Princeton vs. Harvard architecture).
  - **Control Hazards:** Branch penalty simulation with 2-cycle speculative fetch flushing.
- **Extended RISC Instruction Set:**
  - Arithmetic / Logic: `ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOR`, `SLT`, `MUL`, `ADDI`, `SUBI`, `SLTI`
  - Memory: `LW`, `SW` (word-indexed)
  - Control Flow: `BEQ`, `BNE`, `J`, `JR`, `NOP`
- **Cycle-by-Cycle Stepper & Playback:** Interactive scrub slider, single-step forward/backward buttons, and configurable automatic clock playback.
- **State & Memory Inspector:** Real-time register file view (`R0`–`R31`) with Decimal, Hexadecimal, and Binary radix toggles, plus data memory grid.
- **Mathematical Amdahl's Law Speedup Analyzer:** Dynamic SVG plotting of speedup curves versus enhanced parallel fraction $P$ and acceleration factor $S$.
- **Export & Reporting:** One-click export of simulation runs as formatted Markdown reports or raw CSV timeline matrices.

---

## 📂 Project Architecture

```text
COA_Micro_Project/
├── index.html                   # Semantic HTML5 single-page application
├── package.json                 # Project configuration & npm scripts (npm start / npm test)
├── simulator.js                 # Compatibility bridge & Node export layer
├── README.md                    # Project overview & documentation
├── css/
│   └── styles.css               # Modern design system (Dark & Light themes, Glassmorphism)
├── js/
│   ├── isa.js                   # Instruction set specification & control signal generator
│   ├── parser.js                # Assembly lexer & parser with diagnostics & label resolution
│   ├── pipeline.js              # 5-Stage RISC execution engine & hazard detection unit
│   ├── datapath.js              # Interactive hardware schematic SVG/DOM visualizer
│   ├── amdahl.js                # Amdahl's law calculator with dynamic SVG curve rendering
│   └── app.js                   # Main application controller, UI event manager & exporter
├── tests/
│   └── test_suite.js            # Automated verification test suite (100% passing)
└── docs/
    ├── REPORT.md                # Formal academic micro-project report
    ├── DEMO.md                  # Classroom presentation & viva examination guide
    ├── TEST_CASES.md            # Acceptance verification matrix
    └── README.md                # Documentation directory overview
```

---

## ⚡ Quick Start Guide

1. Open `index.html` in your web browser.
2. Select a preset from the **Assembly Program** dropdown:
   - *RAW Data Dependency* (demonstrates forwarding bypassing)
   - *Independent Instructions* (demonstrates ideal $CPI \approx 1.0$)
   - *Load-Use Hazard & Store* (demonstrates mandatory load stall)
   - *Taken Branch Flush* (demonstrates 2-cycle branch penalty)
   - *Iterative Loop (BNE)* (demonstrates loop counters and backward branching)
   - *Bitwise & Comparison* (demonstrates bitwise operations)
3. Click **▶ Run Simulation** or press `Ctrl + Enter`.
4. Switch to the **⚏ 5-Stage Datapath Hardware View** tab and use **Step Next ▸** or **▶ Auto Play** to watch instructions move across processor stages cycle by cycle.

---

## 🔬 Performance Metrics Reference

- **Cycles Per Instruction (CPI):** Total Cycles / Completed Instructions
- **Throughput (IPC):** Completed Instructions / Total Cycles = 1 / CPI
- **Speedup vs Serial Baseline:** (5 × N) / Cycles
- **Amdahl's Law Speedup:** S_overall = 1 / ((1 − P) + P / S)

---

## 🧪 Running Automated Tests

Run the acceptance test suite locally using Node.js:
```bash
npm test
# or: node tests/test_suite.js
```
Expected output:
```text
=== RUNNING PIPELINE LAB ACCEPTANCE TESTS ===
[PASS] ADD R1, R2, R3 calculates 100 + 10 = 110
[PASS] ADD R1, R2, R3 completes in 5 cycles
[PASS] RAW Forwarding resolves in fewer cycles than No Forwarding
[PASS] RAW No Forwarding inserts 2 stalls
[PASS] Load-Use Hazard inserts 1 stall even with forwarding
[PASS] Load-Use Hazard gets correct loaded value (MEM[100]=7 + R4=3 = 10)
[PASS] Branch Taken sets target register R4 to 99
[PASS] Branch Taken reports control hazard event
[PASS] AND 15 & 3 = 3
[PASS] OR 15 | 3 = 15
[PASS] XOR 15 ^ 3 = 12
[PASS] SLT (3 < 15) = 1
Results: 12 / 12 tests passed (100%)
```

---

## 📚 References

1. David A. Patterson and John L. Hennessy, *Computer Organization and Design: The Hardware/Software Interface*, RISC-V / MIPS Editions, Morgan Kaufmann.
2. M. Morris Mano, *Computer System Architecture*, Pearson.
3. John L. Hennessy and David A. Patterson, *Computer Architecture: A Quantitative Approach*, Morgan Kaufmann.
