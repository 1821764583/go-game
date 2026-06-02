// 快速调试领地计算
import { calculateTerritory } from './src/scoring-engine';
import { createEmptyBoard } from './src/types';

const board = createEmptyBoard(9);
// 黑棋左4列，白棋右4列，x=4 这列空着
for (let y=0;y<9;y++) {
  for (let x=0;x<4;x++) board[y][x]=1;
  for (let x=5;x<9;x++) board[y][x]=2;
}
// x=4 是空列，它上下都是空，左边碰到黑棋(x=3)，右边碰到白棋(x=5)
// → 两种颜色都接触 → 争议地 owner=0
const result = calculateTerritory(board);
console.log('blackTerritory:', result.blackTerritory);
console.log('whiteTerritory:', result.whiteTerritory);
// 输出 territory map 第4列
for (let y=0;y<9;y++) {
  console.log(`x=4,y=${y}: owner=${result.territory[y][4]}, board=${board[y][4]}`);
}
