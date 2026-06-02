"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDeadStones = applyDeadStones;
exports.calculateTerritory = calculateTerritory;
exports.calculateScore = calculateScore;
exports.determineWinner = determineWinner;
exports.resignResult = resignResult;
const types_1 = require("./types");
const go_engine_1 = require("./go-engine");
function applyDeadStones(board, deadStones) {
    const newBoard = (0, types_1.cloneBoard)(board);
    let addCapturedByBlack = 0;
    let addCapturedByWhite = 0;
    for (const [x, y] of deadStones) {
        const color = newBoard[y][x];
        if (color === 1)
            addCapturedByWhite++;
        if (color === 2)
            addCapturedByBlack++;
        newBoard[y][x] = 0;
    }
    return { newBoard, addCapturedByBlack, addCapturedByWhite };
}
function calculateTerritory(board) {
    const size = board.length;
    const visited = Array.from({ length: size }, () => new Array(size).fill(false));
    const territory = Array.from({ length: size }, () => new Array(size).fill(0));
    let blackTerritory = 0;
    let whiteTerritory = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (board[y][x] !== 0 || visited[y][x])
                continue;
            const emptyGroup = [];
            const borderingColors = new Set();
            const queue = [[x, y]];
            visited[y][x] = true;
            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                emptyGroup.push([cx, cy]);
                for (const [nx, ny] of (0, go_engine_1.getNeighbors)(cx, cy, size)) {
                    if (board[ny][nx] !== 0) {
                        borderingColors.add(board[ny][nx]);
                    }
                    else if (!visited[ny][nx]) {
                        visited[ny][nx] = true;
                        queue.push([nx, ny]);
                    }
                }
            }
            let owner = 0;
            if (borderingColors.size === 1) {
                owner = borderingColors.has(1) ? 1 : 2;
            }
            for (const [ex, ey] of emptyGroup) {
                territory[ey][ex] = owner;
            }
            if (owner === 1)
                blackTerritory += emptyGroup.length;
            if (owner === 2)
                whiteTerritory += emptyGroup.length;
        }
    }
    return { territory, blackTerritory, whiteTerritory };
}
function calculateScore(board, deadStones, komi = 3.75) {
    const { newBoard } = applyDeadStones(board, deadStones);
    let blackStones = 0;
    let whiteStones = 0;
    for (let y = 0; y < newBoard.length; y++) {
        for (let x = 0; x < newBoard[y].length; x++) {
            if (newBoard[y][x] === 1)
                blackStones++;
            if (newBoard[y][x] === 2)
                whiteStones++;
        }
    }
    const { blackTerritory, whiteTerritory } = calculateTerritory(newBoard);
    const blackScore = blackStones + blackTerritory;
    const whiteScore = whiteStones + whiteTerritory + komi;
    return {
        blackScore,
        whiteScore,
        blackStones,
        whiteStones,
        blackTerritory,
        whiteTerritory,
        komi,
    };
}
function determineWinner(score) {
    const winner = score.blackScore > score.whiteScore ? 1 : 2;
    const margin = parseFloat(Math.abs(score.blackScore - score.whiteScore).toFixed(1));
    return {
        winner,
        margin,
        reason: 'score',
        score,
    };
}
function resignResult(loser) {
    return {
        winner: loser === 1 ? 2 : 1,
        margin: 0,
        reason: 'resign',
    };
}
//# sourceMappingURL=scoring-engine.js.map