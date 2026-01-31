export const CELL_SIZE = 50;
export const COLS = Math.floor(1000 / CELL_SIZE); 
export const ROWS = Math.floor(600 / CELL_SIZE); 

export let map = [];

function initMap() {
    map = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => 1)
    );
}

function carveRoom(x, y, w, h) {
    for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
            if (rx > 0 && ry > 0 && rx < COLS-1 && ry < ROWS-1) {
                map[ry][rx] = 0;
            }
        }
    }
}

function carveCorridor(x1, y1, x2, y2) {
    let x = x1, y = y1;

    while (x !== x2 || y !== y2) {
        if (Math.random() < 0.5) x += Math.sign(x2 - x);
        else y += Math.sign(y2 - y);

        map[y][x] = 0;
    }
}

export function generateFloor() {
    initMap();

    const roomSize = 4;

    // corner rooms
    const rooms = [
        { x: 1, y: 1 },
        { x: COLS - roomSize - 1, y: 1 },
        { x: 1, y: ROWS - roomSize - 1 },
        { x: COLS - roomSize - 1, y: ROWS - roomSize - 1 }
    ];

    rooms.forEach(r => carveRoom(r.x, r.y, roomSize, roomSize));

    rooms.forEach(r => {
        const side = Math.floor(Math.random() * 4);
        let dx = r.x, dy = r.y;

        if (side === 0) { dx += Math.floor(Math.random() * roomSize); dy -= 1; } 
        if (side === 1) { dx += Math.floor(Math.random() * roomSize); dy += roomSize; } 
        if (side === 2) { dx -= 1; dy += Math.floor(Math.random() * roomSize); } 
        if (side === 3) { dx += roomSize; dy += Math.floor(Math.random() * roomSize); } 

        if (dx >= 0 && dy >= 0 && dx < COLS && dy < ROWS) {
            map[dy][dx] = 0;
        }
    });

    carveCorridor(rooms[0].x+2, rooms[0].y+2, rooms[3].x+2, rooms[3].y+2);
    carveCorridor(rooms[1].x+2, rooms[1].y+2, rooms[2].x+2, rooms[2].y+2);
}

export function drawMap(ctx) {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (map[y][x] === 1) {
                ctx.fillStyle = "black";
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
}
