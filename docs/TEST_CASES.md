# Pipeline Lab — Acceptance Test Cases & Verification Matrix

Automated test runner: `node test_suite.js` or `npm test` (12 / 12 passing, 100% coverage).

| # | Test Scenario | Assembly Code | Settings | Expected Cycles | Expected State / Observations | Status |
|---|---|---|---|:---:|---|:---:|
| **1** | Single Arithmetic | `ADD R1, R2, R3` | Fwd: ON | 5 | $R1 = 110$ (100 + 10); 1 instruction across IF..WB | ✅ PASS |
| **2** | Single Subtraction | `SUB R1, R2, R3` | Fwd: ON | 5 | $R1 = 90$ (100 - 10) | ✅ PASS |
| **3** | Add Immediate | `ADDI R1, R2, 10` | Fwd: ON | 5 | $R1 = 110$ (100 + 10) | ✅ PASS |
| **4** | Load Word | `LW R1, 0(R2)` | Fwd: ON | 5 | $R1 = 7$ (from $\text{MEM}[100]$) | ✅ PASS |
| **5** | Store Word | `SW R3, 4(R2)` | Fwd: ON | 5 | $\text{MEM}[104] = 10$ | ✅ PASS |
| **6** | RAW Hazard (With Forwarding) | `ADD R1, R2, R3`<br>`SUB R4, R1, R5` | Fwd: ON | 6 | 0 stalls; $R1$ forwarded from `EX/MEM` to ALU | ✅ PASS |
| **7** | RAW Hazard (Without Forwarding) | `ADD R1, R2, R3`<br>`SUB R4, R1, R5` | Fwd: OFF | 8 | 2 stalls inserted in ID stage; $R4 = 109$ | ✅ PASS |
| **8** | Load-Use Hazard | `LW R1, 0(R2)`<br>`ADD R3, R1, R4` | Fwd: ON | 7 | 1 stall inserted in ID stage; $R3 = 10$ | ✅ PASS |
| **9** | Taken Branch Penalty | `ADDI R1, R0, 5`<br>`BEQ R1, R1, TARGET`<br>`ADD R2, R2, R3`<br>`TARGET: ADDI R4, R0, 99` | Fwd: ON | 7 | 2-cycle penalty; $R4 = 99$; younger inst flushed | ✅ PASS |
| **10** | Bitwise Logic (AND/OR/XOR) | `ADDI R1, R0, 15`<br>`ADDI R2, R0, 3`<br>`AND R3, R1, R2`<br>`OR R4, R1, R2`<br>`XOR R5, R1, R2` | Fwd: ON | 9 | $R3 = 3$, $R4 = 15$, $R5 = 12$ | ✅ PASS |
| **11** | Set Less Than (SLT) | `ADDI R1, R0, 15`<br>`ADDI R2, R0, 3`<br>`SLT R6, R2, R1` | Fwd: ON | 7 | $R6 = 1$ ($3 < 15$) | ✅ PASS |
| **12** | Amdahl's Law Speedup | Fraction $P = 60\%$, Speedup $S = 4\times$ | N/A | N/A | $S_{\text{overall}} = \frac{1}{(1-0.6) + 0.6/4} = 1.82\times$ | ✅ PASS |
