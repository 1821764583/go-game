"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyBoard = createEmptyBoard;
exports.cloneBoard = cloneBoard;
function createEmptyBoard(size) {
    return Array.from({ length: size }, () => new Array(size).fill(0));
}
function cloneBoard(board) {
    return board.map(row => [...row]);
}
//# sourceMappingURL=types.js.map