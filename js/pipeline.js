/**
 * Pipeline Lab - 5-Stage RISC Pipeline Simulation Engine
 * Models IF, ID, EX, MEM, WB stages, Hazard Detection, and Forwarding Unit.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./isa.js'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./isa.js'));
    } else {
        root.PipelineSimulator = factory(root.ISA);
    }
}(typeof self !== 'undefined' ? self : this, function(ISA) {
    'use strict';

    class PipelineSimulator {
        constructor(config = {}) {
            const currentISA = ISA || (typeof window !== 'undefined' ? window.ISA : null);
            this.forwardingEnabled = config.forwarding !== undefined ? config.forwarding : true;
            this.sharedMemoryEnabled = config.sharedMemory !== undefined ? config.sharedMemory : false;
            this.branchDelaySlots = config.branchDelaySlots || 0;
            this.initialRegisters = { ...(currentISA ? currentISA.DEFAULT_REGISTERS : {}), ...(config.initialRegisters || {}) };
            this.initialMemory = { ...(currentISA ? currentISA.DEFAULT_MEMORY : {}), ...(config.initialMemory || {}) };
            this.maxCycles = config.maxCycles || 500;
        }

        simulate(parsedProgram) {
            const instructions = parsedProgram.instructions;
            if (!instructions || instructions.length === 0) {
                throw new Error('No instructions to simulate.');
            }

            const registers = Array(32).fill(0);
            for (let i = 0; i < 32; i++) {
                if (this.initialRegisters[i] !== undefined) {
                    registers[i] = this.initialRegisters[i];
                }
            }
            registers[0] = 0;

            const memory = { ...this.initialMemory };
            const events = [];
            const executedInstances = [];

            let pc = 0;
            let guard = 0;

            while (pc < instructions.length && guard++ < this.maxCycles) {
                const ins = instructions[pc];
                const instanceId = executedInstances.length;
                const srcValues = ins.sources.map(r => (r === 0 ? 0 : (registers[r] || 0)));
                const aluRight = ins.usesImmediate ? ins.imm : srcValues[1];
                
                let result = 0;
                let memAddress = 0;
                let branchTaken = false;
                let nextPc = pc + 1;

                switch (ins.op) {
                    case 'ADD':
                        result = srcValues[0] + aluRight;
                        break;
                    case 'SUB':
                        result = srcValues[0] - aluRight;
                        break;
                    case 'AND':
                        result = srcValues[0] & aluRight;
                        break;
                    case 'OR':
                        result = srcValues[0] | aluRight;
                        break;
                    case 'XOR':
                        result = srcValues[0] ^ aluRight;
                        break;
                    case 'NOR':
                        result = ~(srcValues[0] | aluRight);
                        break;
                    case 'SLT':
                        result = srcValues[0] < aluRight ? 1 : 0;
                        break;
                    case 'MUL':
                        result = srcValues[0] * aluRight;
                        break;
                    case 'ADDI':
                        result = srcValues[0] + ins.imm;
                        break;
                    case 'SUBI':
                        result = srcValues[0] - ins.imm;
                        break;
                    case 'SLTI':
                        result = srcValues[0] < ins.imm ? 1 : 0;
                        break;
                    case 'LW':
                        memAddress = (registers[ins.base] || 0) + ins.offset;
                        result = memory[memAddress] !== undefined ? memory[memAddress] : 0;
                        break;
                    case 'SW':
                        memAddress = (registers[ins.base] || 0) + ins.offset;
                        result = registers[ins.storeReg] || 0;
                        memory[memAddress] = result;
                        break;
                    case 'BEQ':
                        branchTaken = srcValues[0] === srcValues[1];
                        if (branchTaken) nextPc = ins.targetIndex;
                        break;
                    case 'BNE':
                        branchTaken = srcValues[0] !== srcValues[1];
                        if (branchTaken) nextPc = ins.targetIndex;
                        break;
                    case 'J':
                        branchTaken = true;
                        nextPc = ins.targetIndex;
                        break;
                    case 'JR':
                        branchTaken = true;
                        nextPc = registers[ins.rs] || 0;
                        break;
                    case 'NOP':
                        break;
                }

                if (ins.rd !== null && ins.rd !== 0) {
                    registers[ins.rd] = result;
                }

                executedInstances.push({
                    instanceId,
                    programIndex: pc,
                    text: ins.text,
                    originalLine: ins.originalLine,
                    op: ins.op,
                    rd: ins.rd,
                    rs: ins.rs,
                    rt: ins.rt,
                    sources: [...ins.sources],
                    srcValues: [...srcValues],
                    result,
                    memAddress,
                    branchTaken,
                    targetIndex: ins.targetIndex,
                    controlSignals: { ...ins.controlSignals },
                    line: ins.line,
                    isLoad: ins.op === 'LW',
                    isStore: ins.op === 'SW',
                    isBranch: ins.op === 'BEQ' || ins.op === 'BNE',
                    isJump: ins.op === 'J' || ins.op === 'JR'
                });

                pc = nextPc;
            }

            const scheduled = this.buildPipelineTiming(executedInstances, events);
            const cycleSnapshots = this.buildCycleSnapshots(scheduled, memory, events);

            const totalCycles = Math.max(0, ...scheduled.rows.flatMap(r => Object.values(r.stages)));
            const instructionCount = executedInstances.length;
            const cpi = instructionCount > 0 ? (totalCycles / instructionCount) : 0;
            const throughput = totalCycles > 0 ? (instructionCount / totalCycles) : 0;
            const serialBaselineCycles = instructionCount * 5;
            const speedup = totalCycles > 0 ? (serialBaselineCycles / totalCycles) : 0;

            return {
                instructions: executedInstances,
                registers,
                memory,
                events,
                rows: scheduled.rows,
                totalCycles,
                instructionCount,
                stallCycles: scheduled.hazardStalls + scheduled.structuralStalls,
                flushCycles: scheduled.flushCycles,
                cpi,
                throughput,
                speedup,
                forwarding: this.forwardingEnabled,
                sharedMemory: this.sharedMemoryEnabled,
                cycleSnapshots
            };
        }

        buildPipelineTiming(instances, events) {
            const active = instances.map(inst => ({
                ...inst,
                stages: {},
                stalls: [],
                flushes: [],
                forwardingInfo: []
            }));

            let hazardStalls = 0;
            let structuralStalls = 0;
            let flushCycles = 0;

            for (let i = 0; i < active.length; i++) {
                const curr = active[i];
                let ifc = i === 0 ? 1 : active[i - 1].stages.IF + 1;
                
                if (i > 0) {
                    const prev = active[i - 1];
                    if ((prev.isBranch && prev.branchTaken) || prev.isJump) {
                        const resumeCycle = prev.stages.EX + 1;
                        if (ifc < resumeCycle) {
                            const penalty = resumeCycle - ifc;
                            flushCycles += penalty;
                            events.push({
                                type: 'CONTROL',
                                cycle: prev.stages.EX,
                                instruction: curr.text,
                                message: `Control Hazard: ${prev.op} at line ${prev.line} taken. 2 speculative cycles flushed; target fetched at cycle ${resumeCycle}.`
                            });
                            ifc = resumeCycle;
                        }
                    }
                }

                let idc = ifc + 1;
                let ex = idc + 1;

                for (let j = 0; j < i; j++) {
                    const prev = active[j];
                    if (prev.rd !== null && prev.rd !== 0 && curr.sources.includes(prev.rd)) {
                        if (this.forwardingEnabled) {
                            let minExAvailable;
                            if (prev.isLoad) {
                                minExAvailable = prev.stages.MEM + 1;
                            } else {
                                minExAvailable = prev.stages.EX + 1;
                            }

                            if (ex < minExAvailable) {
                                const stallCount = minExAvailable - ex;
                                hazardStalls += stallCount;
                                for (let s = 0; s < stallCount; s++) {
                                    curr.stalls.push(ex + s);
                                }
                                ex += stallCount;

                                events.push({
                                    type: 'LOAD-USE',
                                    cycle: idc,
                                    instruction: curr.text,
                                    message: `Load-Use Hazard: ${curr.op} reads R${prev.rd} loaded by ${prev.op} (line ${prev.line}). 1 stall cycle inserted in ID stage.`
                                });
                            } else {
                                const forwardSource = prev.isLoad ? 'MEM/WB' : (prev.stages.EX + 1 === ex ? 'EX/MEM' : 'MEM/WB');
                                curr.forwardingInfo.push({
                                    reg: prev.rd,
                                    fromInst: prev.text,
                                    fromStage: forwardSource,
                                    toStage: 'EX'
                                });
                                events.push({
                                    type: 'FORWARDING',
                                    cycle: ex,
                                    instruction: curr.text,
                                    message: `Forwarding Active: R${prev.rd} forwarded from ${forwardSource} (${prev.op}) directly to EX stage of ${curr.op}.`
                                });
                            }
                        } else {
                            const minExAvailable = prev.stages.WB + 1;
                            if (ex < minExAvailable) {
                                const stallCount = minExAvailable - ex;
                                hazardStalls += stallCount;
                                for (let s = 0; s < stallCount; s++) {
                                    curr.stalls.push(ex + s);
                                }
                                ex += stallCount;
                                events.push({
                                    type: 'RAW DATA',
                                    cycle: idc,
                                    instruction: curr.text,
                                    message: `RAW Data Hazard: ${curr.op} reads R${prev.rd} written by ${prev.op} at WB cycle ${prev.stages.WB}. ${stallCount} stall cycles inserted.`
                                });
                            }
                        }
                    }
                }

                let memc = ex + 1;

                if (this.sharedMemoryEnabled) {
                    for (let j = 0; j < i; j++) {
                        const prev = active[j];
                        if ((prev.isLoad || prev.isStore) && prev.stages.MEM === ifc) {
                            structuralStalls++;
                            ifc++;
                            idc++;
                            ex++;
                            memc++;
                            curr.stalls.push(ifc - 1);
                            events.push({
                                type: 'STRUCTURAL',
                                cycle: ifc - 1,
                                instruction: curr.text,
                                message: `Structural Hazard: Shared memory bus conflict between data access of ${prev.op} and fetch of ${curr.op}. 1 stall inserted.`
                            });
                            break;
                        }
                    }
                }

                const wb = memc + 1;

                curr.stages = {
                    IF: ifc,
                    ID: idc,
                    EX: ex,
                    MEM: memc,
                    WB: wb
                };
            }

            const rows = active.map(inst => {
                const stageMap = { ...inst.stages };
                for (const stallCycle of inst.stalls) {
                    stageMap[`STALL_${stallCycle}`] = stallCycle;
                }
                return {
                    instanceId: inst.instanceId,
                    line: inst.line,
                    text: inst.text,
                    op: inst.op,
                    rd: inst.rd,
                    rs: inst.rs,
                    rt: inst.rt,
                    controlSignals: { ...inst.controlSignals },
                    result: inst.result,
                    stages: stageMap,
                    stalls: inst.stalls,
                    forwardingInfo: inst.forwardingInfo
                };
            });

            return {
                rows,
                hazardStalls,
                structuralStalls,
                flushCycles
            };
        }

        buildCycleSnapshots(scheduled, finalMemory, events) {
            const maxCycle = Math.max(0, ...scheduled.rows.flatMap(r => Object.values(r.stages)));
            const snapshots = [];
            const currentISA = ISA || (typeof window !== 'undefined' ? window.ISA : null);

            for (let cycle = 1; cycle <= maxCycle; cycle++) {
                const state = {
                    cycle,
                    IF: null,
                    ID: null,
                    EX: null,
                    MEM: null,
                    WB: null,
                    forwardA: 0,
                    forwardB: 0,
                    activeEvents: events.filter(e => e.cycle === cycle),
                    stalls: [],
                    signals: {}
                };

                for (const row of scheduled.rows) {
                    if (row.stages.IF === cycle) state.IF = row;
                    if (row.stages.ID === cycle) state.ID = row;
                    if (row.stages.EX === cycle) state.EX = row;
                    if (row.stages.MEM === cycle) state.MEM = row;
                    if (row.stages.WB === cycle) state.WB = row;
                    if (row.stalls.includes(cycle)) state.stalls.push(row);
                }

                if (state.EX) {
                    state.signals = state.EX.controlSignals || (currentISA ? currentISA.getControlSignals(state.EX.op) : {});
                    if (state.MEM && state.MEM.rd && state.MEM.rd !== 0 && state.EX.sources && state.EX.sources.includes(state.MEM.rd)) {
                        state.forwardA = 1;
                    }
                    if (state.WB && state.WB.rd && state.WB.rd !== 0 && state.EX.sources && state.EX.sources.includes(state.WB.rd)) {
                        state.forwardB = 1;
                    }
                }

                snapshots.push(state);
            }

            return snapshots;
        }
    }

    return PipelineSimulator;
}));
