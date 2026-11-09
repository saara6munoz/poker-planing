const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const crypto = require('crypto'); // Módulo nativo para encriptar y UUID

const app = express();
const server = http.createServer(app);
// Limita el tamaño de los mensajes entrantes (10 KB)
const io = new Server(server, { maxHttpBufferSize: 1e4 });

app.use(express.static(path.join(__dirname, 'public')));

// La contraseña del Scrum Master se define en la variable de entorno SCRUM_PASSWORD
const SCRUM_PASSWORD = process.env.SCRUM_PASSWORD;
if (!SCRUM_PASSWORD) {
    console.error('Falta la variable de entorno SCRUM_PASSWORD. Defínela antes de iniciar el servidor.');
    process.exit(1);
}
const SCRUM_PASSWORD_HASH = crypto.createHash('sha256').update(SCRUM_PASSWORD).digest();

const VALID_VOTES = ['1', '2', '3', '5', '8'];
const MAX_NAME_LENGTH = 40;
const MAX_ROOMS = 50;              // Salas activas simultáneas en el servidor
const ROOM_CREATE_COOLDOWN_MS = 5000; // Tiempo mínimo entre creaciones por conexión
const MAX_PASSWORD_ATTEMPTS = 5;   // Intentos fallidos por conexión

const rooms = {};

// Devuelve el texto limpio o null si no es válido
function cleanText(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || text.length > MAX_NAME_LENGTH) return null;
    return text;
}

function isValidPassword(password) {
    if (typeof password !== 'string' || password.length > 200) return false;
    const hash = crypto.createHash('sha256').update(password).digest();
    return crypto.timingSafeEqual(hash, SCRUM_PASSWORD_HASH);
}

io.on('connection', (socket) => {
    let lastRoomCreatedAt = 0;
    let failedAttempts = 0;

    // 1. El Scrum Master crea la sala con contraseña
    socket.on('create_room', (data) => {
        const { username, roomName, password } = data || {};

        if (failedAttempts >= MAX_PASSWORD_ATTEMPTS) {
            socket.emit('error_msg', 'Demasiados intentos fallidos. Recarga la página para reintentar.');
            return;
        }
        if (!isValidPassword(password)) {
            failedAttempts++;
            socket.emit('error_msg', 'Contraseña incorrecta. Acceso denegado.');
            return;
        }

        const cleanUsername = cleanText(username);
        const cleanRoomName = cleanText(roomName);
        if (!cleanUsername || !cleanRoomName) {
            socket.emit('error_msg', `Nombre y sala son obligatorios (máximo ${MAX_NAME_LENGTH} caracteres).`);
            return;
        }
        if (getRoomBySocket(socket.id)) {
            socket.emit('error_msg', 'Ya estás dentro de una sala.');
            return;
        }
        if (Date.now() - lastRoomCreatedAt < ROOM_CREATE_COOLDOWN_MS) {
            socket.emit('error_msg', 'Espera unos segundos antes de crear otra sala.');
            return;
        }
        if (Object.keys(rooms).length >= MAX_ROOMS) {
            socket.emit('error_msg', 'El servidor alcanzó el máximo de salas activas. Intenta más tarde.');
            return;
        }
        lastRoomCreatedAt = Date.now();

        const roomId = crypto.randomUUID(); // Genera URL segura
        rooms[roomId] = { name: cleanRoomName, users: {}, scrumMaster: socket.id, revealed: false };

        socket.join(roomId);
        rooms[roomId].users[socket.id] = { username: cleanUsername, vote: null, id: socket.id };

        socket.emit('joined', { roomId, roomName: cleanRoomName, isScrumMaster: true });
        io.to(roomId).emit('update_users', getRoomState(roomId));
    });

    // 2. Los invitados entran con el UUID de la URL
    socket.on('join', (data) => {
        const { username, roomId } = data || {};
        const cleanUsername = cleanText(username);
        if (!cleanUsername) {
            socket.emit('error_msg', `Ingresa un nombre válido (máximo ${MAX_NAME_LENGTH} caracteres).`);
            return;
        }
        if (getRoomBySocket(socket.id)) {
            socket.emit('error_msg', 'Ya estás dentro de una sala.');
            return;
        }
        if (typeof roomId !== 'string' || !Object.hasOwn(rooms, roomId)) {
            socket.emit('error_msg', 'La sala no existe o el enlace caducó.');
            return;
        }
        if (Object.keys(rooms[roomId].users).length >= 15) {
            socket.emit('error_msg', 'La sala está llena (máximo 15 usuarios).');
            return;
        }

        socket.join(roomId);
        rooms[roomId].users[socket.id] = { username: cleanUsername, vote: null, id: socket.id };

        socket.emit('joined', { roomId, roomName: rooms[roomId].name, isScrumMaster: false });
        io.to(roomId).emit('update_users', getRoomState(roomId));
    });

    socket.on('vote', (voteValue) => {
        if (!VALID_VOTES.includes(voteValue)) return;
        const roomId = getRoomBySocket(socket.id);
        if (roomId && rooms[roomId] && !rooms[roomId].revealed) {
            rooms[roomId].users[socket.id].vote = voteValue;
            io.to(roomId).emit('update_users', getRoomState(roomId));
        }
    });

    socket.on('reveal', () => {
        const roomId = getRoomBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].scrumMaster === socket.id) {
            rooms[roomId].revealed = true;
            io.to(roomId).emit('update_users', getRoomState(roomId));
        }
    });

    socket.on('reset', () => {
        const roomId = getRoomBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].scrumMaster === socket.id) {
            rooms[roomId].revealed = false;
            for (let id in rooms[roomId].users) rooms[roomId].users[id].vote = null;
            io.to(roomId).emit('update_users', getRoomState(roomId));
            io.to(roomId).emit('reset_vote_ui');
        }
    });

    socket.on('end_room', () => {
        const roomId = getRoomBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].scrumMaster === socket.id) {
            io.to(roomId).emit('room_ended');
            io.in(roomId).socketsLeave(roomId);
            delete rooms[roomId];
        }
    });

    socket.on('disconnect', () => {
        const roomId = getRoomBySocket(socket.id);
        if (roomId && rooms[roomId]) {
            delete rooms[roomId].users[socket.id];
            
            if (Object.keys(rooms[roomId].users).length === 0) {
                delete rooms[roomId]; // Se borra la sala si no queda nadie
            } else if (rooms[roomId].scrumMaster === socket.id) {
                rooms[roomId].scrumMaster = Object.keys(rooms[roomId].users)[0];
                io.to(rooms[roomId].scrumMaster).emit('make_scrum_master');
                io.to(roomId).emit('update_users', getRoomState(roomId));
            } else {
                io.to(roomId).emit('update_users', getRoomState(roomId));
            }
        }
    });
});

function getRoomBySocket(socketId) {
    for (const roomId in rooms) {
        if (rooms[roomId].users[socketId]) return roomId;
    }
    return null;
}

function getRoomState(roomId) {
    const state = { users: [], revealed: rooms[roomId].revealed };
    for (let id in rooms[roomId].users) {
        const u = rooms[roomId].users[id];
        state.users.push({
            id: u.id, username: u.username, hasVoted: u.vote !== null,
            vote: rooms[roomId].revealed ? u.vote : null 
        });
    }
    return state;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
