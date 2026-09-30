/**
 * Pipeline Lab - Simulator Entry Point & Compatibility Layer
 * Exports simulator classes and methods for automated tests and standalone usage.
 */

if (typeof module !== 'undefined' && module.exports) {
    const ISA = require('./js/isa.js');
    const AssemblyParser = require('./js/parser.js');
    const PipelineSimulator = require('./js/pipeline.js');
    const AmdahlCalculator = require('./js/amdahl.js');

    module.exports = {
        ISA,
        AssemblyParser,
        PipelineSimulator,
        AmdahlCalculator
    };
}
