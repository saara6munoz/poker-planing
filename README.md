# Poker Planning

Aplicacion web para realizar sesiones de **Planning Poker** en tiempo real. Permite que un Scrum Master cree una sala, comparta un enlace con el equipo y coordine una votacion privada para estimar historias, tareas o incidencias.

## Para que sirve

El Planning Poker ayuda a que el equipo estime el esfuerzo de una tarea sin influenciarse entre si antes de votar. Cada participante elige una carta, los votos permanecen ocultos y el Scrum Master decide cuando revelar el resultado.

Esta aplicacion permite:

- Crear salas protegidas para sesiones de estimacion.
- Compartir un enlace de invitacion con los participantes.
- Votar con cartas de estimacion: `1`, `2`, `3`, `5` y `8`.
- Ver en tiempo real quien ya voto, sin mostrar su voto hasta revelar.
- Mostrar el promedio de votos y el detalle por persona.
- Reiniciar la votacion para una nueva ronda.
- Terminar la sala para todos los participantes.

## Tecnologias usadas

- **Node.js**: entorno de ejecucion del servidor.
- **Express**: servidor web para publicar la aplicacion.
- **Socket.IO**: comunicacion en tiempo real entre usuarios.
- **HTML, CSS y JavaScript**: interfaz del cliente.
- **Bootstrap**: estilos base de la interfaz.

## Requisitos

Antes de ejecutar el proyecto necesitas tener instalado:

- Node.js
- npm

Puedes comprobarlo con:

```bash
node -v
npm -v
```

## Instalacion

Desde la carpeta del proyecto, instala las dependencias:

```bash
npm install
```

## Ejecucion

El servidor necesita la variable de entorno `SCRUM_PASSWORD` con la contrasena de administrador. Si no esta definida, el servidor no inicia.

En PowerShell:

```powershell
$env:SCRUM_PASSWORD = "tu-clave-secreta"
npm start
```

En Bash:

```bash
SCRUM_PASSWORD="tu-clave-secreta" npm start
```

Luego abre la aplicacion en el navegador:

```text
http://localhost:3000
```

Si necesitas usar otro puerto, puedes definir la variable `PORT` antes de iniciar el servidor.

## Como se usa

### 1. Crear una sala

Al entrar a `http://localhost:3000`, el Scrum Master vera un formulario para crear una sala.

Debe ingresar:

- Su nombre.
- El nombre de la sala.
- La contrasena de administrador.

La contrasena es la definida en la variable de entorno `SCRUM_PASSWORD` del servidor. Pidesela a quien administra el despliegue.

Si la contrasena es correcta, se crea una sala nueva con un identificador unico.

### 2. Compartir el enlace

Cuando la sala ya fue creada, el Scrum Master puede usar el boton **Copiar enlace**.

Ese enlace incluye el identificador de la sala, por ejemplo:

```text
http://localhost:3000/?room=ID_DE_LA_SALA
```

Los participantes deben abrir ese enlace para unirse.

### 3. Unirse como participante

Al entrar desde un enlace de invitacion, cada usuario solo debe escribir su nombre y presionar **Entrar a votar**.

La sala permite un maximo de 15 usuarios.

### 4. Votar

Cada participante elige una carta de su mano:

```text
1, 2, 3, 5, 8
```

Mientras la votacion no este revelada:

- El sistema muestra que una persona ya voto.
- El valor exacto del voto permanece oculto.
- Los usuarios pueden cambiar su voto seleccionando otra carta.

### 5. Revelar resultados

Solo el Scrum Master puede presionar **Ver resumen**.

Al revelar, la aplicacion muestra:

- El promedio de los votos.
- El resumen agrupado por valor de carta.
- El voto emitido por cada persona.
- Una `X` para quienes no votaron.

### 6. Volver a jugar

El Scrum Master puede presionar **Volver a Jugar** para iniciar otra ronda.

Esto limpia todos los votos y permite estimar una nueva tarea dentro de la misma sala.

### 7. Terminar partida

El Scrum Master puede presionar **Terminar partida**.

Cuando esto ocurre:

- La sala se cierra para todos.
- Los usuarios ven una pantalla de cierre.
- La sala se elimina de la memoria del servidor.

## Funcionamiento interno

El servidor mantiene las salas en memoria usando un objeto llamado `rooms`.

Cada sala guarda:

- Nombre de la sala.
- Lista de usuarios conectados.
- Identificador del Scrum Master.
- Estado de la votacion: revelada o no revelada.

Socket.IO se encarga de enviar eventos en tiempo real:

- `create_room`: crea una sala nueva.
- `join`: une un usuario a una sala existente.
- `vote`: registra el voto de un usuario.
- `reveal`: revela los votos.
- `reset`: limpia los votos para una nueva ronda.
- `end_room`: cierra la sala.
- `disconnect`: elimina usuarios desconectados y reasigna Scrum Master si corresponde.

## Consideraciones importantes

- Las salas viven solo en memoria. Si el servidor se reinicia, las salas se pierden.
- La contrasena del Scrum Master se lee de la variable de entorno `SCRUM_PASSWORD`. Nunca la subas al repositorio.
- Cada conexion tiene un maximo de 5 intentos fallidos de contrasena.
- El servidor admite hasta 50 salas activas a la vez.
- Los nombres de usuario y de sala tienen un maximo de 40 caracteres, y solo se aceptan votos `1`, `2`, `3`, `5` y `8`.

## Despliegue en Azure App Service

1. Crea un App Service con runtime **Node 20 LTS** (o superior) en Linux.
2. En **Configuracion > Configuracion general**, activa **Web sockets** (`On`). Sin esto el tiempo real no funciona bien.
3. En la misma pantalla, deja **ARR affinity** activado y usa **una sola instancia**: las salas viven en memoria y no se comparten entre instancias.
4. En **Variables de entorno** (App settings), agrega `SCRUM_PASSWORD` con la clave del Scrum Master. No definas `PORT`: Azure lo asigna solo.
5. Despliega el codigo (desde VS Code con la extension de Azure App Service, `az webapp up` o GitHub Actions). Azure ejecuta `npm install` y `npm start`.
6. Usa la URL `https://<nombre-app>.azurewebsites.net`. El boton **Copiar enlace** necesita HTTPS para funcionar.
- No hay base de datos ni persistencia historica de resultados.
- Si el Scrum Master se desconecta, el sistema asigna automaticamente ese rol a otro usuario conectado.

## Estructura del proyecto

```text
poker-planing/
|-- public/
|   |-- app.js        # Logica del cliente y comunicacion con Socket.IO
|   `-- index.html    # Interfaz principal de la aplicacion
|-- server.js         # Servidor Express y logica de salas
|-- package.json      # Dependencias del proyecto
`-- README.md         # Documentacion del proyecto
```

## Comandos utiles

Instalar dependencias:

```bash
npm install
```

Ejecutar la aplicacion (con `SCRUM_PASSWORD` definida):

```bash
npm start
```

Abrir en navegador:

```text
http://localhost:3000
```
