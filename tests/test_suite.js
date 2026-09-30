/**
 * Pipeline Lab - Automated Acceptance Test Suite
 * Run via: node tests/test_suite.js or npm test
 */

const ISA = require('../js/isa.js');
const AssemblyParser = require('../js/parser.js');
const PipelineSimulator = require('../js/pipeline.js');

function runTests() {
    console.log('=== RUNNING PIPELINE LAB ACCEPTANCE TESTS ===\n');
    const parser = new AssemblyParser();
    let passed = 0;
    let total = 0;

    function assert(name, condition, details = '') {
        total++;
        if (condition) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} - Details: ${details}`);
        }
    }

    // Test 1: Arithmetic & Register File
    try {
        const p1 = parser.parse('ADD R1, R2, R3');
        const sim1 = new PipelineSimulator({ forwarding: true });
        const res1 = sim1.simulate(p1);
        assert('ADD R1, R2, R3 calculates 100 + 10 = 110', res1.registers[1] === 110, `Got: ${res1.registers[1]}`);
        assert('ADD R1, R2, R3 completes in 5 cycles', res1.totalCycles === 5, `Got: ${res1.totalCycles}`);
    } catch (e) {
        assert('Test 1 Exception', false, e.message);
    }

    // Test 2: RAW Dependency with Forwarding vs No Forwarding
    try {
        const p2 = parser.parse('ADD R1, R2, R3\nSUB R4, R1, R5');
        const simFwd = new PipelineSimulator({ forwarding: true });
        const resFwd = simFwd.simulate(p2);
        
        const simNoFwd = new PipelineSimulator({ forwarding: false });
        const resNoFwd = simNoFwd.simulate(p2);

        assert('RAW Forwarding resolves in fewer cycles than No Forwarding', resFwd.totalCycles < resNoFwd.totalCycles, `Fwd: ${resFwd.totalCycles}, NoFwd: ${resNoFwd.totalCycles}`);
        assert('RAW No Forwarding inserts 2 stalls', resNoFwd.stallCycles === 2, `Got stalls: ${resNoFwd.stallCycles}`);
    } catch (e) {
        assert('Test 2 Exception', false, e.message);
    }

    // Test 3: Load-Use Hazard
    try {
        const p3 = parser.parse('LW R1, 0(R2)\nADD R3, R1, R4');
        const sim3 = new PipelineSimulator({ forwarding: true });
        const res3 = sim3.simulate(p3);
        assert('Load-Use Hazard inserts 1 stall even with forwarding', res3.stallCycles === 1, `Got stalls: ${res3.stallCycles}`);
        assert('Load-Use Hazard gets correct loaded value (MEM[100]=7 + R4=3 = 10)', res3.registers[3] === 10, `Got: ${res3.registers[3]}`);
    } catch (e) {
        assert('Test 3 Exception', false, e.message);
    }

    // Test 4: Taken Branch and Flushes
    try {
        const p4 = parser.parse('ADDI R1, R0, 5\nBEQ R1, R1, TARGET\nADD R2, R2, R3\nTARGET: ADDI R4, R0, 99');
        const sim4 = new PipelineSimulator({ forwarding: true });
        const res4 = sim4.simulate(p4);
        assert('Branch Taken sets target register R4 to 99', res4.registers[4] === 99, `Got: ${res4.registers[4]}`);
        assert('Branch Taken reports control hazard event', res4.events.some(e => e.type === 'CONTROL'), 'No control event');
    } catch (e) {
        assert('Test 4 Exception', false, e.message);
    }

    // Test 5: Logic & Bitwise Operations
    try {
        const p5 = parser.parse('ADDI R1, R0, 15\nADDI R2, R0, 3\nAND R3, R1, R2\nOR R4, R1, R2\nXOR R5, R1, R2\nSLT R6, R2, R1');
        const sim5 = new PipelineSimulator({ forwarding: true });
        const res5 = sim5.simulate(p5);
        assert('AND 15 & 3 = 3', res5.registers[3] === 3, `Got: ${res5.registers[3]}`);
        assert('OR 15 | 3 = 15', res5.registers[4] === 15, `Got: ${res5.registers[4]}`);
        assert('XOR 15 ^ 3 = 12', res5.registers[5] === 12, `Got: ${res5.registers[5]}`);
        assert('SLT (3 < 15) = 1', res5.registers[6] === 1, `Got: ${res5.registers[6]}`);
    } catch (e) {
        assert('Test 5 Exception', false, e.message);
    }

    console.log(`\nResults: ${passed} / ${total} tests passed (${((passed / total) * 100).toFixed(0)}%)`);
    if (passed !== total) process.exit(1);
}

runTests();
