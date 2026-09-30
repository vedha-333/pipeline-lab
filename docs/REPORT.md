# Computer Organization and Architecture Micro-Project Report
## Design and Implementation of an Interactive 5-Stage RISC CPU Pipeline Simulator with Datapath Visualization and Hazard Analysis

---

### Abstract
Instruction pipelining is a fundamental architectural technique in modern microprocessors to achieve high instruction throughput by exploiting Instruction-Level Parallelism (ILP). However, physical execution is constrained by hazards: Read-After-Write (RAW) data dependencies, load-use memory latencies, structural resource contention, and control flushes resulting from branch mispredictions. 

**Pipeline Lab** is an interactive, educational hardware simulation and visualization workbench engineered to model a classic 5-stage RISC processor (IF, ID, EX, MEM, WB). It features an extended instruction set architecture (ISA), cycle-accurate hazard detection, forwarding bypass circuitry, live datapath hardware inspection, and mathematical performance profiling incorporating Amdahl's Law.

---

### 1. Introduction & Objectives

#### 1.1 Problem Statement
Theoretical comprehension of pipeline overlapping, latch transitions, and forwarding multiplexing is notoriously difficult when taught solely through static timing diagrams. Students require an exploratory environment where they can write arbitrary assembly programs, observe latch transitions cycle by cycle, toggle forwarding units on and off, and quantitatively analyze speedup and CPI metrics.

#### 1.2 Core Project Objectives
1. **Instruction Set & Parsing:** Lexically analyze and parse R-Type (`ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOR`, `SLT`, `MUL`), I-Type (`ADDI`, `SUBI`, `SLTI`, `LW`, `SW`), and Branch/Jump (`BEQ`, `BNE`, `J`, `JR`) assembly with syntax verification and label indexing.
2. **5-Stage Pipeline Engine:** Model the cycle-by-cycle execution of Instruction Fetch (IF), Instruction Decode / Register Read (ID), Execution / Address Calculation (EX), Data Memory Access (MEM), and Register Write Back (WB).
3. **Hazard Detection & Forwarding Unit:**
   - Detect Read-After-Write (RAW) data dependencies.
   - Model forwarding bypass multiplexers from `EX/MEM` and `MEM/WB` to ALU inputs.
   - Detect Load-Use hazards and insert mandatory 1-cycle pipeline stalls in the ID stage.
   - Model structural contention on unified memory architectures (Princeton model).
   - Simulate branch resolution in the EX stage with 2-cycle speculative fetch flushes.
4. **Live Datapath Visualization:** Render an interactive hardware schematic displaying active instructions in each pipeline stage, inter-stage latches (`IF/ID`, `ID/EX`, `EX/MEM`, `MEM/WB`), and control signal buses.
5. **Performance Measurement:** Calculate completed instructions ($N$), clock cycles ($C$), Cycles Per Instruction ($\text{CPI} = C/N$), Throughput ($\text{IPC} = N/C$), Speedup versus unpipelined baseline ($S = \frac{5N}{C}$), and Amdahl's Law curves.

---

### 2. Theoretical Architecture & System Design

#### 2.1 The Classic 5-Stage RISC Pipeline
Each instruction progresses through five discrete stages:
1. **IF (Instruction Fetch):** The Program Counter (PC) addresses instruction memory, fetching a 32-bit instruction word while $\text{PC} \leftarrow \text{PC} + 4$.
2. **ID (Instruction Decode & Register Read):** The opcode and registers are decoded; source operands ($Rs, Rt$) are read from the 32-word dual-port Register File, and immediate constants are sign-extended.
3. **EX (Execution / ALU):** The Arithmetic Logic Unit computes arithmetic/logic results, effective memory addresses ($\text{Base} + \text{Offset}$), or branch comparison outcomes. Forwarding multiplexers select between register operands and bypassed values.
4. **MEM (Data Memory Access):** For `LW` and `SW`, the data cache/RAM is accessed using the address computed during the EX stage.
5. **WB (Write Back):** The computed ALU result or loaded memory word is committed to the destination register ($Rd$ or $Rt$). $R0$ is hardwired to constant 0.

#### 2.2 Pipeline Registers (Latches)
Between adjacent stages, hardware pipeline registers synchronize state across clock edges:
- **`IF/ID`:** Holds fetched instruction and incremented PC.
- **`ID/EX`:** Holds decoded control signals, register contents ($A, B$), immediate constant, and destination register indices.
- **`EX/MEM`:** Holds ALU result, branch outcome, zero flag, memory write data, and destination register index.
- **`MEM/WB`:** Holds memory read data, ALU result, and destination register index.

#### 2.3 Hazard Classification & Mitigation Strategies

$$\text{Pipeline Speedup} = \frac{\text{Pipeline Depth}}{1 + (\text{Stalls per Instruction})}$$

| Hazard Category | Cause | Hardware Mitigation Strategy |
|---|---|---|
| **Data Hazard (RAW)** | Instruction depends on result of preceding instruction not yet written back | Forwarding bypass from `EX/MEM` or `MEM/WB` directly to ALU inputs without stall |
| **Load-Use Hazard** | Instruction depends on data loaded by an immediate predecessor `LW` | Data not available until end of MEM stage; Hazard Detection Unit inserts 1 stall bubble in ID |
| **Control Hazard** | Branch condition evaluated in EX stage; target PC not known immediately | Flush 2 speculative instructions fetched during IF and ID stages |
| **Structural Hazard** | Simultaneous instruction fetch and data memory access in unified memory | Insert 1 stall cycle delaying instruction fetch until memory stage clears |

---

### 3. Implementation Details & Architecture

The simulator is built with a modular, zero-dependency, object-oriented JavaScript architecture:

1. **`js/isa.js` (ISA Specification):**
   Defines instruction formats, operand patterns, and automatic control signal matrices (`RegDst`, `ALUSrc`, `MemToReg`, `RegWrite`, `MemRead`, `MemWrite`, `Branch`, `ALUOp`).
2. **`js/parser.js` (Assembly Lexer & Parser):**
   Two-pass parser handling whitespace normalization, comment stripping, label dictionary resolution, operand syntax checks, and immediate number conversion.
3. **`js/pipeline.js` (Simulation Engine):**
   Maintains architectural state (registers `R0`–`R31`, word-indexed memory map) and constructs cycle timing matrices with precise hazard detection.
4. **`js/datapath.js` (Hardware Visualizer):**
   Renders the interactive SVG/DOM hardware schematic showing live latch contents, active instruction tags, and forwarding multiplexer statuses.
5. **`js/amdahl.js` (Amdahl Analyzer):**
   Evaluates $S_{\text{overall}} = \frac{1}{(1-P) + \frac{P}{S}}$ and dynamically generates interactive SVG speedup curves.
6. **`js/app.js` (Application Controller):**
   Coordinates state, cycle stepping, auto-playback, theme switching, and Markdown/CSV export.

---

### 4. Verification & Experimental Results

The simulator was verified against an extensive 12-test acceptance test suite (`test_suite.js`).

| Test Scenario | Input Assembly | Expected Result | Verified Result |
|---|---|---|---|
| **Arithmetic & Registers** | `ADD R1, R2, R3` ($R2=100, R3=10$) | $R1 = 110$, 5 cycles | ✅ $R1 = 110$, 5 cycles |
| **RAW with Forwarding** | `ADD R1, R2, R3`<br>`SUB R4, R1, R5` | Forwarding active; 0 stalls; 6 cycles | ✅ 0 stalls; 6 cycles |
| **RAW without Forwarding** | `ADD R1, R2, R3`<br>`SUB R4, R1, R5` (No Fwd) | 2 stalls inserted; 8 cycles | ✅ 2 stalls; 8 cycles |
| **Load-Use Hazard** | `LW R1, 0(R2)`<br>`ADD R3, R1, R4` | 1 stall inserted in ID; $R3 = 10$ | ✅ 1 stall; $R3 = 10$ |
| **Taken Branch** | `ADDI R1, R0, 5`<br>`BEQ R1, R1, TARGET`<br>`ADD R2, R2, R3`<br>`TARGET: ADDI R4, R0, 99` | 2-cycle branch penalty; $R4 = 99$ | ✅ 2 flush cycles; $R4 = 99$ |
| **Bitwise Operations** | `AND`, `OR`, `XOR`, `SLT` operations | Bitwise logical correctness | ✅ All outputs verified |

---

### 5. Conclusion & Future Enhancements

Pipeline Lab delivers a comprehensive, cycle-accurate teaching platform for computer architecture education. It successfully demystifies pipelined datapath operations, makes hazard delays tangible, and provides clear quantitative metrics.

**Potential Future Extensions:**
- Dynamic Branch Prediction (2-bit saturating counters, Branch Target Buffer).
- Multi-cycle Functional Units (pipelined floating-point multiplier and divider).
- L1/L2 Cache Hierarchy simulation with hit/miss penalties.
- Out-of-Order Execution (Scoreboarding or Tomasulo's Algorithm with Reorder Buffer).

---

### 6. References
1. David A. Patterson and John L. Hennessy, *Computer Organization and Design: The Hardware/Software Interface*, 5th/6th RISC-V Edition, Morgan Kaufmann.
2. M. Morris Mano, *Computer System Architecture*, 3rd Edition, Pearson.
3. John L. Hennessy and David A. Patterson, *Computer Architecture: A Quantitative Approach*, 6th Edition, Morgan Kaufmann.
