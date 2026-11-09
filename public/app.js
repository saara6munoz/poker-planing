const socket = io();

// Capturar parámetros de la URL
const urlParams = new URLSearchParams(window.location.search);
const inviteRoomId = urlParams.get('room');

// Elementos del DOM
const loginSection = document.getElementById('login-section');
const loginBody = document.getElementById('login-body');
const pokerSection = document.getElementById('poker-section');
const endedSection = document.getElementById('ended-section');
const displayRoom = document.getElementById('display-room');
const smBadgeContainer = document.getElementById('sm-badge-container');
const smControls = document.getElementById('sm-controls');
const btnCopyLink = document.getElementById('btn-copy-link');
const cardsContainer = document.getElementById('cards-container');
const pokerTable = document.getElementById('poker-table');

let currentRoomId = null;

// Escapa texto antes de insertarlo con innerHTML (evita XSS con nombres de usuario)
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// RENDERIZAR LOGIN DEPENDIENDO SI HAY URL DE INVITACIÓN
if (inviteRoomId) {
    // Vista Invitado
    loginBody.innerHTML = `
        <h3 class="card-title text-center mb-4">Unirse a la sala</h3>
        <div class="mb-4">
            <label class="form-label">Tu Nombre</label>
            <input type="text" class="form-control" id="username" placeholder="Ej: DevNinja">
        </div>
        <button id="btn-join" class="btn btn-success w-100 btn-lg">Entrar a votar</button>
    `;
    
    document.getElementById('btn-join').addEventListener('click', () => {
        const username = document.getElementById('username').value.trim();
        if (username) {
            socket.emit('join', { username, roomId: inviteRoomId });
        } else {
            alert('Por favor ingresa tu nombre.');
        }
    });

} else {
    // Vista Creador (Scrum Master)
    loginBody.innerHTML = `
        <h3 class="card-title text-center mb-4">Crear nueva sala</h3>
        <div class="mb-3">
            <label class="form-label">Tu Nombre</label>
            <input type="text" class="form-control" id="username" placeholder="Ej: Scrum Master">
        </div>
        <div class="mb-3">
            <label class="form-label">Nombre de la Sala</label>
            <input type="text" class="form-control" id="room-name" placeholder="Ej: Sprint 42">
        </div>
        <div class="mb-4">
            <label class="form-label">Contrasena de administrador</label>
            <input type="password" class="form-control" id="room-pass" placeholder="Clave secreta">
        </div>
        <button id="btn-create" class="btn btn-primary w-100 btn-lg">Crear sala protegida</button>
    `;

    document.getElementById('btn-create').addEventListener('click', () => {
        const username = document.getElementById('username').value.trim();
        const roomName = document.getElementById('room-name').value.trim();
        const password = document.getElementById('room-pass').value;

        if (username && roomName && password) {
            socket.emit('create_room', { username, roomName, password });
        } else {
            alert('Todos los campos son obligatorios.');
        }
    });
}

// LÓGICA DE SALA
socket.on('error_msg', (msg) => alert(msg));

socket.on('joined', (data) => {
    loginSection.classList.add('d-none');
    pokerSection.classList.remove('d-none');
    displayRoom.textContent = data.roomName;
    currentRoomId = data.roomId;
    
    if (data.isScrumMaster) enableScrumMaster();
});

socket.on('make_scrum_master', () => enableScrumMaster());

function enableScrumMaster() {
    smBadgeContainer.classList.remove('d-none');
    smControls.classList.remove('d-none');
}

// Botón de Copiar Enlace
btnCopyLink.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}/?room=${currentRoomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        const originalText = btnCopyLink.innerHTML;
        btnCopyLink.innerHTML = "Enlace copiado";
        setTimeout(() => btnCopyLink.innerHTML = originalText, 2000);
    });
});

// Votación y Controles
cardsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.card-poker');
    if (!card) return;

    document.querySelectorAll('.card-poker').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    socket.emit('vote', card.getAttribute('data-value'));
});

document.getElementById('btn-reveal')?.addEventListener('click', () => socket.emit('reveal'));
document.getElementById('btn-reset')?.addEventListener('click', () => socket.emit('reset'));
document.getElementById('btn-end-game')?.addEventListener('click', () => {
    const shouldEnd = confirm('Esto cerrara la sala para todos. ¿Quieres terminar la partida?');
    if (shouldEnd) socket.emit('end_room');
});

socket.on('reset_vote_ui', () => {
    document.querySelectorAll('.card-poker').forEach(c => c.classList.remove('selected'));
});

socket.on('room_ended', () => {
    loginSection.classList.add('d-none');
    pokerSection.classList.add('d-none');
    endedSection.classList.remove('d-none');
    currentRoomId = null;
});

// Renderizar Mesa y Resumen
socket.on('update_users', (state) => {
    pokerTable.innerHTML = '';
    let totalSum = 0, validVotesCount = 0;
    const voteCounts = {};

    state.users.forEach(user => {
        const seat = document.createElement('div');
        seat.className = 'user-seat';
        let cardHtml = `<div class="table-card text-muted">...</div>`; 
        
        if (state.revealed) {
            if (user.vote !== null) {
                cardHtml = `<div class="table-card revealed">${escapeHtml(user.vote)}</div>`;
                const v = parseFloat(user.vote);
                totalSum += v; validVotesCount++;
                voteCounts[v] = (voteCounts[v] || 0) + 1;
            } else {
                cardHtml = `<div class="table-card bg-light text-danger">X</div>`; 
            }
        } else {
            if (user.hasVoted) cardHtml = `<div class="table-card hidden"></div>`; 
        }

        const safeName = escapeHtml(user.username);
        seat.innerHTML = `<span class="fw-bold text-truncate w-100" title="${safeName}">${safeName}</span>${cardHtml}`;
        pokerTable.appendChild(seat);
    });

    const voteSummary = document.getElementById('vote-summary');
    const summaryTotals = document.getElementById('summary-totals');
    const summaryCards = document.getElementById('summary-cards');
    if (state.revealed) {
        pokerTable.classList.add('d-none');
        summaryTotals.innerHTML = '';
        summaryCards.innerHTML = '';

        if (validVotesCount > 0) {
            document.getElementById('summary-average').textContent = (totalSum / validVotesCount).toFixed(1);

            Object.keys(voteCounts).sort((a,b) => a-b).forEach(val => {
                const count = voteCounts[val];
                summaryTotals.innerHTML += `
                    <div class="summary-card-group">
                        <span class="summary-card-count">${count} ${count === 1 ? 'voto' : 'votos'}</span>
                        <div class="table-card revealed mt-0">${escapeHtml(val)}</div>
                    </div>`;
            });
        } else {
            document.getElementById('summary-average').textContent = '-';
            summaryTotals.innerHTML = '<span class="text-muted fs-5">Nadie emitio su voto</span>';
        }

        state.users.forEach(user => {
            const voteHtml = user.vote !== null
                ? `<div class="table-card revealed mt-0">${escapeHtml(user.vote)}</div>`
                : '<div class="table-card bg-light text-danger mt-0">X</div>';
            const safeName = escapeHtml(user.username);

            summaryCards.innerHTML += `
                <div class="summary-vote-group">
                    <span class="summary-vote-name text-truncate" title="${safeName}">${safeName}</span>
                    ${voteHtml}
                </div>`;
        });
        voteSummary.classList.remove('d-none');
    } else {
        pokerTable.classList.remove('d-none');
        voteSummary.classList.add('d-none');
    }
});
