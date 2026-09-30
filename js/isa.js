/**
 * Pipeline Lab - Instruction Set Architecture & Specifications
 * Supported: R-Type, I-Type, J-Type, and Control operations
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ISA = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    const ISA = {
        // Instruction opcodes and metadata
        INSTRUCTIONS: {
            // Arithmetic / Logic (R-Type)
            'ADD':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs + Rt', aluOp: 'ADD', writesRd: true },
            'SUB':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs - Rt', aluOp: 'SUB', writesRd: true },
            'AND':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs & Rt', aluOp: 'AND', writesRd: true },
            'OR':   { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs | Rt', aluOp: 'OR',  writesRd: true },
            'XOR':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs ^ Rt', aluOp: 'XOR', writesRd: true },
            'NOR':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = ~(Rs | Rt)', aluOp: 'NOR', writesRd: true },
            'SLT':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = (Rs < Rt) ? 1 : 0', aluOp: 'SLT', writesRd: true },
            'MUL':  { type: 'R', format: 'Rd, Rs, Rt', desc: 'Rd = Rs * Rt', aluOp: 'MUL', writesRd: true },

            // Immediate (I-Type)
            'ADDI': { type: 'I', format: 'Rd, Rs, imm', desc: 'Rd = Rs + imm', aluOp: 'ADD', writesRd: true, isImm: true },
            'SUBI': { type: 'I', format: 'Rd, Rs, imm', desc: 'Rd = Rs - imm', aluOp: 'SUB', writesRd: true, isImm: true },
            'SLTI': { type: 'I', format: 'Rd, Rs, imm', desc: 'Rd = (Rs < imm) ? 1 : 0', aluOp: 'SLT', writesRd: true, isImm: true },

            // Memory (I-Type)
            'LW':   { type: 'I', format: 'Rt, offset(Rs)', desc: 'Rt = MEM[Rs + offset]', isLoad: true, writesRd: true },
            'SW':   { type: 'I', format: 'Rt, offset(Rs)', desc: 'MEM[Rs + offset] = Rt', isStore: true, writesRd: false },

            // Branch & Jump
            'BEQ':  { type: 'B', format: 'Rs, Rt, label', desc: 'if (Rs == Rt) branch to label', isBranch: true },
            'BNE':  { type: 'B', format: 'Rs, Rt, label', desc: 'if (Rs != Rt) branch to label', isBranch: true },
            'J':    { type: 'J', format: 'label', desc: 'unconditional jump to label', isJump: true },
            'JR':   { type: 'R', format: 'Rs', desc: 'jump to register address', isJumpReg: true },
            'NOP':  { type: 'N', format: '', desc: 'No Operation', isNop: true }
        },

        // Default initial register values (for reproducible academic benchmarks)
        DEFAULT_REGISTERS: {
            2: 100, 3: 10, 4: 3, 5: 1, 6: 6, 7: 2, 8: 8, 9: 4
        },

        // Default initial memory words
        DEFAULT_MEMORY: {
            100: 7, 104: 11, 108: 15, 112: 24, 116: 42
        },

        // Standard control signals generated for each instruction
        getControlSignals: function(op) {
            switch (op) {
                case 'ADD':
                case 'SUB':
                case 'AND':
                case 'OR':
                case 'XOR':
                case 'NOR':
                case 'SLT':
                case 'MUL':
                    return { RegDst: 1, ALUSrc: 0, MemToReg: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, Branch: 0, ALUOp: op };
                case 'ADDI':
                case 'SUBI':
                case 'SLTI':
                    return { RegDst: 0, ALUSrc: 1, MemToReg: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, Branch: 0, ALUOp: op.slice(0, -1) };
                case 'LW':
                    return { RegDst: 0, ALUSrc: 1, MemToReg: 1, RegWrite: 1, MemRead: 1, MemWrite: 0, Branch: 0, ALUOp: 'ADD' };
                case 'SW':
                    return { RegDst: 0, ALUSrc: 1, MemToReg: 0, RegWrite: 0, MemRead: 0, MemWrite: 1, Branch: 0, ALUOp: 'ADD' };
                case 'BEQ':
                case 'BNE':
                    return { RegDst: 0, ALUSrc: 0, MemToReg: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 1, ALUOp: 'SUB' };
                case 'J':
                case 'JR':
                    return { RegDst: 0, ALUSrc: 0, MemToReg: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 0, Jump: 1, ALUOp: 'NONE' };
                case 'NOP':
                default:
                    return { RegDst: 0, ALUSrc: 0, MemToReg: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 0, ALUOp: 'NOP' };
            }
        }
    };

    return ISA;
}));
