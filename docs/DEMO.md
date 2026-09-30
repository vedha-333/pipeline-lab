# Pipeline Lab — Presentation & Viva Demonstration Walkthrough (5–7 Mins)

This walkthrough outlines an optimal, high-scoring live demonstration flow for presentations, classroom demonstrations, or viva examinations.

---

### Step 1: Introduction & System Architecture (1 Min)
1. Open `index.html` in your browser.
2. Introduce the **5-Stage RISC Pipeline**:
   - **IF** (Instruction Fetch)
   - **ID** (Instruction Decode & Register Read)
   - **EX** (Execution / ALU / Branch resolution)
   - **MEM** (Data Memory Access)
   - **WB** (Register Write Back)
3. Note that the project is completely standalone, client-side, responsive, and supports both dark and light modes.

---

### Step 2: Ideal Pipeline Flow & Performance Baseline (1 Min)
1. Select preset **Preset: Independent Instructions**.
2. Click **▶ Run Simulation**.
3. Point out the performance summary:
   - Completed instructions ($N=5$)
   - Total cycles ($C=9$)
   - CPI ($\approx 1.8$, converging toward $1.0$ as $N \to \infty$)
   - Idealized speedup ($\approx 2.78\times$ vs serial baseline).
4. Highlight that each consecutive instruction enters the pipeline with a 1-cycle skew without any stalls.

---

### Step 3: RAW Data Hazard & Forwarding Unit Comparison (1.5 Mins)
1. Select preset **Preset: RAW Data Dependency**:
   - `ADD R1, R2, R3`
   - `SUB R4, R1, R5` (reads `R1` produced by the first instruction)
2. **With Forwarding ON:**
   - Click **Run Simulation**. Show that 0 stall cycles are inserted because data is forwarded directly from the `EX/MEM` latch to the ALU in cycle 4.
3. **With Forwarding OFF:**
   - Uncheck the **Forwarding Unit** checkbox.
   - Click **Run Simulation**.
   - Show that **2 stall cycles (bubbles)** are inserted because `SUB` must wait for `ADD` to write back in stage 5 (WB).
4. Open the **⚠ Hazard Event Log** tab to show the automated diagnosis.

---

### Step 4: Load-Use Hazard & Datapath Hardware Inspection (1.5 Mins)
1. Select preset **Preset: Load-Use Hazard & Store**.
2. Run the simulation. Explain that even with forwarding enabled, a `LW` instruction's data is only available at the end of the `MEM` stage, forcing the Hazard Detection Unit to insert **1 mandatory stall bubble** in the `ID` stage.
3. Switch to the **⚏ 5-Stage Datapath Hardware View** tab:
   - Use the **Step Next ▸** or **▶ Auto Play** buttons.
   - Show the instruction labels moving across the stage cards (`IF`, `ID`, `EX`, `MEM`, `WB`).
   - Point out the active pipeline latches (`IF/ID`, `ID/EX`, `EX/MEM`, `MEM/WB`) and the live hardware control signals (`RegWrite`, `ALUSrc`, `MemRead`, etc.).

---

### Step 5: Control Hazards & Branch Flushes (1 Min)
1. Select preset **Preset: Taken Branch Flush**.
2. Run simulation and inspect the timeline:
   - `BEQ R1, R1, TARGET` evaluates to true during `EX`.
   - The two younger speculatively fetched instructions are flushed.
   - Execution resumes at `TARGET` with a 2-cycle branch penalty.

---

### Step 6: Amdahl's Law Speedup Analyzer (30 Secs)
1. Scroll to the **Amdahl's Law Speedup Analyzer** section.
2. Drag the **Parallel / Enhanced Fraction ($P$)** slider (e.g., set to $80\%$, Speedup factor $S=4\times$).
3. Show the real-time speedup calculation ($2.50\times$) and the dynamic SVG curve illustrating the diminishing returns curve.
