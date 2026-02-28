
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const ROWS = 20;
const COLS = 10;
const SIZE = 30;

let board = Array.from({length:ROWS},()=>Array(COLS).fill(0));
let score = 0;

const pieces = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[1,1,0],[0,1,1]],
  [[0,1,1],[1,1,0]]
];

let current = {
  shape: pieces[Math.floor(Math.random()*pieces.length)],
  x:3,
  y:0
};

function drawCell(x,y,color){
  ctx.fillStyle=color;
  ctx.fillRect(x*SIZE,y*SIZE,SIZE,SIZE);
  ctx.strokeStyle="#222";
  ctx.strokeRect(x*SIZE,y*SIZE,SIZE,SIZE);
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  board.forEach((row,y)=>row.forEach((v,x)=>{
    if(v) drawCell(x,y,"#ff6a00");
  }));
  current.shape.forEach((row,y)=>row.forEach((v,x)=>{
    if(v) drawCell(current.x+x,current.y+y,"#3ddc84");
  }));
}

function collide(){
  return current.shape.some((row,y)=>
    row.some((v,x)=>{
      if(!v) return false;
      let newX=current.x+x;
      let newY=current.y+y;
      return newX<0||newX>=COLS||newY>=ROWS||board[newY]?.[newX];
    })
  );
}

function merge(){
  current.shape.forEach((row,y)=>row.forEach((v,x)=>{
    if(v) board[current.y+y][current.x+x]=1;
  }));
}

function rotate(){
  const rotated = current.shape[0].map((_,i)=>
    current.shape.map(row=>row[i]).reverse()
  );
  const old = current.shape;
  current.shape=rotated;
  if(collide()) current.shape=old;
  draw();
}

function move(dir){
  current.x+=dir;
  if(collide()) current.x-=dir;
  draw();
}

function drop(){
  current.y++;
  if(collide()){
    current.y--;
    merge();
    clearLines();
    newPiece();
  }
  draw();
}

function clearLines(){
  board = board.filter(row=>row.some(cell=>!cell));
  while(board.length<ROWS) board.unshift(Array(COLS).fill(0));
  score+=10;
  scoreEl.textContent="Score: "+score;
}

function newPiece(){
  current={ shape:pieces[Math.floor(Math.random()*pieces.length)], x:3,y:0 };
  if(collide()){
    alert("Game Over");
    board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
    score=0;
  }
}

setInterval(drop,800);
draw();
