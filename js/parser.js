/**
 * Pipeline Lab - Assembly Lexer & Parser
 * Converts human-written assembly code into structured instruction objects
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./isa.js'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./isa.js'));
    } else {
        root.AssemblyParser = factory(root.ISA);
    }
}(typeof self !== 'undefined' ? self : this, function(ISA) {
    'use strict';

    class AssemblyParser {
        constructor() {
            this.labels = {};
            this.rawLines = [];
            this.errors = [];
        }

        static isRegisterToken(token) {
            if (!token) return false;
            const cleaned = token.toUpperCase().trim();
            return /^R([0-9]|[12][0-9]|3[01])$/.test(cleaned) || /^\$([0-9]|[12][0-9]|3[01])$/.test(cleaned);
        }

        static parseRegister(token, lineNum) {
            if (!token) {
                throw new Error(`Line ${lineNum}: Missing expected register operand.`);
            }
            const cleaned = token.toUpperCase().trim();
            const match = cleaned.match(/^R([0-9]|[12][0-9]|3[01])$/) || cleaned.match(/^\$([0-9]|[12][0-9]|3[01])$/);
            if (!match) {
                throw new Error(`Line ${lineNum}: Invalid register name "${token}". Must be R0 to R31.`);
            }
            return parseInt(match[1], 10);
        }

        static parseImmediate(token, lineNum) {
            if (!token) {
                throw new Error(`Line ${lineNum}: Missing expected immediate integer.`);
            }
            const trimmed = token.trim();
            let val;
            if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
                val = parseInt(trimmed, 16);
            } else if (/^[-+]?\d+$/.test(trimmed)) {
                val = parseInt(trimmed, 10);
            } else {
                throw new Error(`Line ${lineNum}: Invalid immediate value "${token}". Must be an integer (e.g. 12, -4, 0x10).`);
            }
            return val;
        }

        static parseMemoryOperand(token, lineNum) {
            if (!token) {
                throw new Error(`Line ${lineNum}: Missing memory operand (e.g. 0(R2)).`);
            }
            const trimmed = token.trim();
            const match = trimmed.match(/^([-+]?\d+|0x[0-9a-fA-F]+)\s*\(\s*(R(?:[0-9]|[12][0-9]|3[01])|\$(?:[0-9]|[12][0-9]|3[01]))\s*\)$/i);
            if (!match) {
                throw new Error(`Line ${lineNum}: Memory operand "${token}" must be formatted like "offset(Rs)", e.g. "4(R2)" or "-8(R29)".`);
            }
            const offset = match[1].startsWith('0x') || match[1].startsWith('0X') ? parseInt(match[1], 16) : parseInt(match[1], 10);
            const base = AssemblyParser.parseRegister(match[2], lineNum);
            return { offset, base };
        }

        parse(sourceCode) {
            this.labels = {};
            this.rawLines = [];
            this.errors = [];

            if (!sourceCode || !sourceCode.trim()) {
                throw new Error('Assembly program is empty. Please enter one or more instructions.');
            }

            const lines = sourceCode.split(/\r?\n/);

            // Pass 1: Extract labels and filter comments
            for (let i = 0; i < lines.length; i++) {
                const rawLine = lines[i];
                const lineNum = i + 1;

                let text = rawLine.replace(/(#|\/\/|;).*$/, '').trim();
                if (!text) continue;

                const labelMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
                if (labelMatch) {
                    const labelName = labelMatch[1].toUpperCase();
                    if (this.labels[labelName] !== undefined) {
                        throw new Error(`Line ${lineNum}: Duplicate label definition "${labelMatch[1]}".`);
                    }
                    this.labels[labelName] = this.rawLines.length;
                    text = labelMatch[2].trim();
                    if (!text) continue;
                }

                this.rawLines.push({
                    text,
                    originalLine: rawLine.trim(),
                    lineNum
                });
            }

            if (this.rawLines.length === 0) {
                throw new Error('No valid instructions found after stripping comments and empty lines.');
            }

            // Pass 2: Parse instructions
            const instructions = [];
            for (let idx = 0; idx < this.rawLines.length; idx++) {
                const { text, lineNum, originalLine } = this.rawLines[idx];
                
                const normalized = text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                const tokens = normalized.split(' ');
                const opcode = tokens[0].toUpperCase();
                const operands = tokens.slice(1);

                const currentISA = ISA || (typeof window !== 'undefined' ? window.ISA : null);
                if (!currentISA || !currentISA.INSTRUCTIONS[opcode]) {
                    throw new Error(`Line ${lineNum}: Unsupported or unrecognized instruction "${opcode}".`);
                }

                const meta = currentISA.INSTRUCTIONS[opcode];
                const ins = {
                    id: idx,
                    line: lineNum,
                    text: text,
                    originalLine,
                    op: opcode,
                    type: meta.type,
                    rd: null,
                    rs: null,
                    rt: null,
                    sources: [],
                    imm: 0,
                    offset: 0,
                    base: null,
                    storeReg: null,
                    label: null,
                    targetIndex: null,
                    usesImmediate: false,
                    controlSignals: currentISA.getControlSignals(opcode)
                };

                switch (opcode) {
                    case 'ADD':
                    case 'SUB':
                    case 'AND':
                    case 'OR':
                    case 'XOR':
                    case 'NOR':
                    case 'SLT':
                    case 'MUL': {
                        if (operands.length === 3) {
                            // 3 Operands: Rd, Rs, Rt (Standard RISC: Rd = Rs op Rt)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            ins.rs = AssemblyParser.parseRegister(operands[1], lineNum);
                            ins.rt = AssemblyParser.parseRegister(operands[2], lineNum);
                            ins.sources = [ins.rs, ins.rt];
                        } else if (operands.length === 2) {
                            // 2 Operands: Rd, Rs (Rd = Rd op Rs) or Rd, immediate (Rd = Rd op imm)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            if (AssemblyParser.isRegisterToken(operands[1])) {
                                ins.rs = ins.rd;
                                ins.rt = AssemblyParser.parseRegister(operands[1], lineNum);
                                ins.sources = [ins.rs, ins.rt];
                            } else {
                                // A literal is the second ALU input (e.g. AND R1, 5 means R1 = R1 & 5).
                                // ADD and SUB use their dedicated immediate opcodes.
                                ins.op = opcode === 'ADD' ? 'ADDI' : (opcode === 'SUB' ? 'SUBI' : opcode);
                                ins.type = 'I';
                                ins.imm = AssemblyParser.parseImmediate(operands[1], lineNum);
                                ins.usesImmediate = true;
                                ins.rs = ins.rd;
                                ins.sources = [ins.rs];
                                ins.controlSignals = opcode === 'ADD' || opcode === 'SUB'
                                    ? (currentISA.getControlSignals(ins.op) || currentISA.getControlSignals(opcode))
                                    : { ...currentISA.getControlSignals(opcode), ALUSrc: 1 };
                            }
                        } else if (operands.length === 1) {
                            // 1 Operand: Rd (Rd = Rd + 1 for ADD, Rd = Rd - 1 for SUB, or Rd op R0)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            if (opcode === 'ADD' || opcode === 'SUB') {
                                ins.op = opcode === 'ADD' ? 'ADDI' : 'SUBI';
                                ins.type = 'I';
                                ins.imm = 1;
                                ins.rs = ins.rd;
                                ins.sources = [ins.rs];
                                ins.controlSignals = currentISA.getControlSignals(ins.op) || currentISA.getControlSignals(opcode);
                            } else {
                                // Default unary/single register operation against R0
                                ins.rs = ins.rd;
                                ins.rt = 0;
                                ins.sources = [ins.rs, ins.rt];
                            }
                        } else {
                            throw new Error(`Line ${lineNum}: "${opcode}" accepts 1, 2, or 3 operands (e.g. ${opcode} R1 | ${opcode} R1, R2 | ${opcode} R1, R2, R3).`);
                        }
                        break;
                    }

                    case 'ADDI':
                    case 'SUBI':
                    case 'SLTI': {
                        if (operands.length === 3) {
                            // 3 Operands: Rd, Rs, imm (Rd = Rs op imm)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            ins.rs = AssemblyParser.parseRegister(operands[1], lineNum);
                            ins.imm = AssemblyParser.parseImmediate(operands[2], lineNum);
                            ins.sources = [ins.rs];
                        } else if (operands.length === 2) {
                            // 2 Operands: Rd, imm (Rd = Rd op imm)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            ins.rs = ins.rd;
                            ins.imm = AssemblyParser.parseImmediate(operands[1], lineNum);
                            ins.sources = [ins.rs];
                        } else if (operands.length === 1) {
                            // 1 Operand: Rd (increment / decrement by 1: Rd = Rd op 1)
                            ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                            ins.rs = ins.rd;
                            ins.imm = 1;
                            ins.sources = [ins.rs];
                        } else {
                            throw new Error(`Line ${lineNum}: "${opcode}" accepts 1, 2, or 3 operands (e.g. ${opcode} R1 | ${opcode} R1, 10 | ${opcode} R1, R2, 10).`);
                        }
                        break;
                    }

                    case 'LW': {
                        if (operands.length !== 2) {
                            throw new Error(`Line ${lineNum}: "LW" requires 2 operands: Rt, offset(Rs) (e.g. LW R1, 0(R2)).`);
                        }
                        ins.rd = AssemblyParser.parseRegister(operands[0], lineNum);
                        const mem = AssemblyParser.parseMemoryOperand(operands[1], lineNum);
                        ins.base = mem.base;
                        ins.offset = mem.offset;
                        ins.rs = mem.base;
                        ins.sources = [mem.base];
                        break;
                    }

                    case 'SW': {
                        if (operands.length !== 2) {
                            throw new Error(`Line ${lineNum}: "SW" requires 2 operands: Rt, offset(Rs) (e.g. SW R1, 0(R2)).`);
                        }
                        ins.storeReg = AssemblyParser.parseRegister(operands[0], lineNum);
                        const mem = AssemblyParser.parseMemoryOperand(operands[1], lineNum);
                        ins.base = mem.base;
                        ins.offset = mem.offset;
                        ins.rs = mem.base;
                        ins.sources = [ins.storeReg, mem.base];
                        break;
                    }

                    case 'BEQ':
                    case 'BNE': {
                        if (operands.length !== 3) {
                            throw new Error(`Line ${lineNum}: "${opcode}" requires 3 operands: Rs, Rt, LABEL (e.g. ${opcode} R1, R2, LOOP).`);
                        }
                        ins.rs = AssemblyParser.parseRegister(operands[0], lineNum);
                        ins.rt = AssemblyParser.parseRegister(operands[1], lineNum);
                        ins.sources = [ins.rs, ins.rt];
                        const targetLabel = operands[2].toUpperCase();
                        if (this.labels[targetLabel] === undefined) {
                            throw new Error(`Line ${lineNum}: Target label "${operands[2]}" does not exist.`);
                        }
                        ins.label = targetLabel;
                        ins.targetIndex = this.labels[targetLabel];
                        break;
                    }

                    case 'J': {
                        if (operands.length !== 1) {
                            throw new Error(`Line ${lineNum}: "J" requires 1 operand: LABEL (e.g. J LOOP).`);
                        }
                        const targetLabel = operands[0].toUpperCase();
                        if (this.labels[targetLabel] === undefined) {
                            throw new Error(`Line ${lineNum}: Target label "${operands[0]}" does not exist.`);
                        }
                        ins.label = targetLabel;
                        ins.targetIndex = this.labels[targetLabel];
                        break;
                    }

                    case 'JR': {
                        if (operands.length !== 1) {
                            throw new Error(`Line ${lineNum}: "JR" requires 1 operand: Rs (e.g. JR R31).`);
                        }
                        ins.rs = AssemblyParser.parseRegister(operands[0], lineNum);
                        ins.sources = [ins.rs];
                        break;
                    }

                    case 'NOP': {
                        break;
                    }

                    default:
                        throw new Error(`Line ${lineNum}: Unsupported opcode "${opcode}".`);
                }

                instructions.push(ins);
            }

            return {
                instructions,
                labels: this.labels,
                lineCount: this.rawLines.length
            };
        }
    }

    return AssemblyParser;
}));
