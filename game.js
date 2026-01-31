import { generateFloor, drawMap, map, CELL_SIZE } from './floor.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const playerPistol = new Image();
const playerEmpty = new Image();
const Enemy = new Image();
const pistolCrate = new Image();

pistolCrate.src = 'assets/pistolCrate.png';
Enemy.src = 'assets/enemy.png';
playerPistol.src = 'assets/playerGun.png';
playerEmpty.src = 'assets/playerEmpty.png';

const mouse = { x: 0, y: 0 };
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key] = true; });
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

const player = {
    x: 500,
    y: 300,
    size: 20,
    hp: 100,
    maxHp: 100,
    speed: 5,
    bullets: [],
    gun_mods: [],
    inventory: [],
    ammo: {
        pistol: 50,
        shotgun: 0,
    },
    currentGun: 'None',
};

let enemies = [];
let currentFloor = 1;
let gamePaused = false;
let floorTransition = false;
let floorExit = null;
const EXIT_SIZE = 30;
let crates = []; 


const enemyTypes = {
    slime: { hp: 15, speed: 1, damage: 5 },
    fast: { hp: 5, speed: 2.5, damage: 3 },
    tank: { hp: 30, speed: 0.5, damage: 10 }
};


const guns = {
    pistol: { dmg: 1, fireRate: 300, bulletSpeed: 10, lastShot: 0 },
    shotgun: { fireRate: 800, bulletSpeed: 8, bulletsPerShot: 5, spread: 0.3, lastShot: 0 },
};


canvas.addEventListener('click', () => {
    const gun = guns[player.currentGun];
    if (!gun) return;

    if (player.ammo[player.currentGun] <= 0) return;

    const now = Date.now();
    if (now - gun.lastShot < gun.fireRate) return; 
    gun.lastShot = now;

    if (player.currentGun === 'pistol') {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        player.bullets.push({ x: player.x, y: player.y, angle, speed: gun.bulletSpeed });
        player.ammo.pistol--;
    }

    if (player.currentGun === 'shotgun') {
        const baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        for (let i = 0; i < gun.bulletsPerShot; i++) {
            const spreadAngle = baseAngle + (Math.random() - 0.5) * gun.spread;
            player.bullets.push({ x: player.x, y: player.y, angle: spreadAngle, speed: gun.bulletSpeed });
        }
        player.ammo.shotgun--;
    }
});

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key.toLowerCase() === 'e') {
        crates.forEach((crate, i) => {
            const dx = player.x - crate.x;
            const dy = player.y - crate.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 30 && crate.type === 'pistolCrate') {
                player.ammo['pistol'] = 50;
                crates.splice(i, 1);
            }
        });

        if (floorExit) {
            const dx = player.x - floorExit.x;
            const dy = player.y - floorExit.y;
            const dist = Math.hypot(dx, dy);

            if (dist < floorExit.size) {
                floorExit = null;
                newFloor();
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});


// update and draw function
function update() {
    if (gamePaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (keys['w']) movePlayer(0, -player.speed);
    if (keys['s']) movePlayer(0, player.speed);
    if (keys['a']) movePlayer(-player.speed, 0);
    if (keys['d']) movePlayer(player.speed, 0);
    if (keys['1']) player.currentGun = 'pistol';

    if (player.hp <= 0) {
        gameOver();
        return;
    }

    if (!floorTransition && enemies.length === 0 && !floorExit) {
    // place the exit on a random floor tile
        let ex, ey;
        do {
            const gx = Math.floor(Math.random() * map[0].length);
            const gy = Math.floor(Math.random() * map.length);
            ex = gx * CELL_SIZE + CELL_SIZE / 2;
            ey = gy * CELL_SIZE + CELL_SIZE / 2;
        } while (isWall(ex, ey));

        floorExit = { x: ex, y: ey, size: EXIT_SIZE };
    }

    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.save();
    ctx.translate(player.x, player.y);

    if (mouse.x < player.x) {
        ctx.scale(1, -1);
        ctx.rotate(-angle);
    } else {
        ctx.scale(1, 1);
        ctx.rotate(angle);
    }

    let imgToDraw;
    if (player.currentGun === 'None') imgToDraw = playerEmpty;
    else if (player.currentGun === 'pistol') imgToDraw = playerPistol;

    ctx.drawImage(imgToDraw, -16, -16);
    ctx.restore();


    const playerBarWidth = 50;
    const playerBarHeight = 6;
    const playerHealthRatio = player.hp / player.maxHp;
    ctx.fillStyle = 'black';
    ctx.fillRect(player.x - playerBarWidth/2, player.y - 40, playerBarWidth, playerBarHeight);
    ctx.fillStyle = 'green';
    ctx.fillRect(player.x - playerBarWidth/2, player.y - 40, playerBarWidth * playerHealthRatio, playerBarHeight);

    if (floorExit) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(floorExit.x - floorExit.size/2, floorExit.y - floorExit.size/2, floorExit.size, floorExit.size);
    }


    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const b = player.bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = b.x - enemy.x;
            const dy = b.y - enemy.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 12) {
                enemy.hp -= guns[player.currentGun].dmg;
                player.bullets.splice(i, 1);

                if (enemy.hp <= 0) {
                    if (enemy.type === 'tank') {
                        crates.push({
                            x: enemy.x,
                            y: enemy.y,
                            type: 'pistolCrate',
                            width: 32,
                            height: 32,
                            img: pistolCrate
                        });
                    }

                    enemies.splice(j, 1);
                }
                break;
            }
        }

        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || isWall(b.x, b.y)) {
            player.bullets.splice(i, 1);
        }
    }


    enemies.forEach(enemy => {
        if (!enemy.path || enemy.path.length === 0 || Date.now() - (enemy.lastPathCalc || 0) > 500) {
            enemy.path = findPath(enemy.x, enemy.y, player.x, player.y);
            enemy.lastPathCalc = Date.now();
        }

        if (enemy.path && enemy.path.length > 0) {
            const target = enemy.path[0];
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.hypot(dx, dy);

            if (dist < enemy.speed) enemy.path.shift();
            else {
                enemy.x += (dx / dist) * enemy.speed;
                enemy.y += (dy / dist) * enemy.speed;
            }
        }
    });

    const now = Date.now();
    enemies.forEach(enemy => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 12 + player.size/2) {
            if (!enemy.lastHit || now - enemy.lastHit > 500) { // 500ms cooldown
                player.hp -= enemy.damage;
                enemy.lastHit = now;
            }
        }
    });

    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.type === "tank" ? "purple" : enemy.type === "fast" ? "yellow" : "red";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
        ctx.fill();

        const barWidth = 24;
        const barHeight = 4;
        const healthRatio = enemy.hp / enemyTypes[enemy.type].hp;

        ctx.fillStyle = 'black';
        ctx.fillRect(enemy.x - barWidth/2, enemy.y - 20, barWidth, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(enemy.x - barWidth/2, enemy.y - 20, barWidth * healthRatio, barHeight);
    });

    crates.forEach(crate => {
        ctx.drawImage(crate.img, crate.x - crate.width/2, crate.y - crate.height/2, crate.width, crate.height);
    });


    drawMap(ctx);

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Ammo: ${player.ammo[player.currentGun] ?? 0}`, 20, 30);

    requestAnimationFrame(update);
}


function findPath(startX, startY, targetX, targetY) {
    const start = { x: Math.floor(startX / CELL_SIZE), y: Math.floor(startY / CELL_SIZE) };
    const target = { x: Math.floor(targetX / CELL_SIZE), y: Math.floor(targetY / CELL_SIZE) };

    const queue = [start];
    const visited = new Set([start.x + "," + start.y]);
    const cameFrom = {};

    const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.x === target.x && current.y === target.y) break;

        for (let [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (
                nx < 0 || ny < 0 || ny >= map.length || nx >= map[0].length ||
                map[ny][nx] === 1 ||
                visited.has(nx + "," + ny)
            ) continue;

            visited.add(nx + "," + ny);
            queue.push({ x: nx, y: ny });
            cameFrom[nx + "," + ny] = current;
        }
    }

    // reconstruct path
    const path = [];
    let currentKey = target.x + "," + target.y;
    while (cameFrom[currentKey]) {
        const [x, y] = currentKey.split(",").map(Number);
        path.unshift({ x: x * CELL_SIZE + CELL_SIZE / 2, y: y * CELL_SIZE + CELL_SIZE / 2 });
        currentKey = cameFrom[currentKey].x + "," + cameFrom[currentKey].y;
    }
    return path;
}

function isWall(x, y) {
    const gx = Math.floor(x / CELL_SIZE);
    const gy = Math.floor(y / CELL_SIZE);
    if (gx < 0 || gy < 0 || gx >= map[0].length || gy >= map.length) return true;
    return map[gy][gx] === 1;
}

function movePlayer(dx, dy) {
    let newX = player.x + dx;
    let newY = player.y + dy;

    if (!isWall(newX, player.y)) player.x = newX;

    if (!isWall(player.x, newY)) player.y = newY;
}

function fixSpawn() {
    let gx = Math.floor(player.x / CELL_SIZE);
    let gy = Math.floor(player.y / CELL_SIZE);

    if (map[gy][gx] === 0) return;

    const queue = [{ x: gx, y: gy }];
    const visited = new Set();
    visited.add(gx + "," + gy);

    const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];

    while (queue.length > 0) {
        const { x, y } = queue.shift();

        for (let [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || ny >= map.length || nx >= map[0].length) continue;
            if (visited.has(nx + "," + ny)) continue;
            visited.add(nx + "," + ny);

            if (map[ny][nx] === 0) {
                player.x = nx * CELL_SIZE + CELL_SIZE / 2;
                player.y = ny * CELL_SIZE + CELL_SIZE / 2;
                return;
            }

            queue.push({ x: nx, y: ny });
        }
    }
}

function spawnEnemies() {
    enemies = [];
    const enemyCount = currentFloor;

    for (let i = 0; i < enemyCount; i++) {
        let x, y;
        do {
            const gx = Math.floor(Math.random() * map[0].length);
            const gy = Math.floor(Math.random() * map.length);
            x = gx * CELL_SIZE + CELL_SIZE / 2;
            y = gy * CELL_SIZE + CELL_SIZE / 2;
        } while (map[Math.floor(y / CELL_SIZE)][Math.floor(x / CELL_SIZE)] === 1);

        // Random enemy type
        const types = Object.keys(enemyTypes);
        const type = types[Math.floor(Math.random() * types.length)];
        const data = enemyTypes[type];

        enemies.push({
            x,
            y,
            type,
            hp: data.hp,
            speed: data.speed,
            damage: data.damage
        });
    }
}

function gameOver() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'red';
    ctx.font = '64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Reached floor ${currentFloor}`, canvas.width / 2, canvas.height / 2 + 80);
}

function newFloor() {
    gamePaused = true;
    floorTransition = true;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Floor ${currentFloor + 1}`, canvas.width / 2, canvas.height / 2);

    player.bullets = [];
    enemies = [];

    setTimeout(() => {
        currentFloor++;
        generateFloor();
        fixSpawn();
        spawnEnemies();

        floorTransition = false;
        gamePaused = false;

        update(); 
    }, 5000);
}

generateFloor();
fixSpawn();
spawnEnemies();
update();
