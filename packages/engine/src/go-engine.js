"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNeighbors = getNeighbors;
exports.getGroup = getGroup;
exports.countLiberties = countLiberties;
exports.placeStone = placeStone;
exports.isLegalMove = isLegalMove;
const types_1 = require("./types");
function getNeighbors(x, y, size) {
    const neighbors = [];
    if (x > 0)
        neighbors.push([x - 1, y]);
    if (x < size - 1)
        neighbors.push([x + 1, y]);
    if (y > 0)
        neighbors.push([x, y - 1]);
    if (y < size - 1)
        neighbors.push([x, y + 1]);
    return neighbors;
}
function getGroup(board, x, y) {
    const size = board.length;
    const color = board[y][x];
    if (color === 0)
        return [];
    const visited = new Set();
    const group = [];
    const queue = [[x, y]];
    visited.add(`${x},${y}`);
    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        group.push([cx, cy]);
        for (const [nx, ny] of getNeighbors(cx, cy, size)) {
            const key = `${nx},${ny}`;
            if (!visited.has(key) && board[ny][nx] === color) {
                visited.add(key);
                queue.push([nx, ny]);
            }
        }
    }
    return group;
}
function countLiberties(board, group) {
    const size = board.length;
    const libertySet = new Set();
    for (const [x, y] of group) {
        for (const [nx, ny] of getNeighbors(x, y, size)) {
            if (board[ny][nx] === 0) {
                libertySet.add(`${nx},${ny}`);
            }
        }
    }
    return libertySet.size;
}
function findCaptures(board, x, y, player) {
    const size = board.length;
    const opponent = player === 1 ? 2 : 1;
    const captured = [];
    const checkedGroups = new Set();
    for (const [nx, ny] of getNeighbors(x, y, size)) {
        if (board[ny][nx] !== opponent)
            continue;
        const key = `${nx},${ny}`;
        if (checkedGroups.has(key))
            continue;
        const group = getGroup(board, nx, ny);
        group.forEach(([gx, gy]) => checkedGroups.add(`${gx},${gy}`));
        if (countLiberties(board, group) === 0) {
            captured.push(...group);
        }
    }
    return captured;
}
function isSuicide(board, x, y, player) {
    const testBoard = (0, types_1.cloneBoard)(board);
    testBoard[y][x] = player;
    const captured = findCaptures(testBoard, x, y, player);
    if (captured.length > 0)
        return false;
    const myGroup = getGroup(testBoard, x, y);
    return countLiberties(testBoard, myGroup) === 0;
}
function isKo(newBoard, koPoint, x, y) {
    if (!koPoint)
        return false;
    return koPoint[0] === x && koPoint[1] === y;
}
function computeNewKoPoint(board, x, y, player, captured) {
    if (captured.length !== 1)
        return null;
    const myGroup = getGroup(board, x, y);
    if (myGroup.length !== 1)
        return null;
    if (countLiberties(board, myGroup) !== 1)
        return null;
    return captured[0];
}
function placeStone(board, x, y, player, koPoint) {
    const size = board.length;
    if (x < 0 || x >= size || y < 0 || y >= size) {
        return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '落子超出棋盘范围' };
    }
    if (board[y][x] !== 0) {
        return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '该位置已有棋子' };
    }
    if (isKo(board, koPoint, x, y)) {
        return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '劫争禁止立即回提' };
    }
    if (isSuicide(board, x, y, player)) {
        return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '禁止自杀' };
    }
    const newBoard = (0, types_1.cloneBoard)(board);
    newBoard[y][x] = player;
    const captured = findCaptures(newBoard, x, y, player);
    for (const [cx, cy] of captured) {
        newBoard[cy][cx] = 0;
    }
    const newKoPoint = computeNewKoPoint(newBoard, x, y, player, captured);
    return { success: true, newBoard, captured, newKoPoint };
}
function isLegalMove(board, x, y, player, koPoint) {
    const result = placeStone(board, x, y, player, koPoint);
    return result.success
        ? { legal: true }
        : { legal: false, reason: result.error };
}
//# sourceMappingURL=go-engine.js.map