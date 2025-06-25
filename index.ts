import { Server } from "socket.io";
import http from "http";

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface Player {
  id: string;
  nome: string;
  foto: string;
}

interface GameData {
  players: Player[];
  turno: "bianco" | "nero";
  modalita: string;
}

const rooms: Record<string, GameData> = {};

io.on("connection", (socket) => {
  console.log(`Nuovo client connesso: ${socket.id}`);

  socket.on("create_room", (data: { roomId: string; nome: string; foto: string; modalita: string }) => {
    const { roomId, nome, foto, modalita } = data;

    if (rooms[roomId]) {
      socket.emit("error", "Stanza già esistente");
      return;
    }

    rooms[roomId] = { players: [{ id: socket.id, nome, foto }], turno: "bianco", modalita };
    socket.join(roomId);
    socket.emit("room_created", { roomId, nome, foto, modalita });
    console.log(`✅ Stanza ${roomId} creata da ${socket.id} con nome ${nome} e modalità ${modalita}`);
  });

  socket.on("join_room", (data: { roomId: string; nome: string; foto: string; modalita: string }) => {
    const { roomId, nome, foto, modalita } = data;
    const room = rooms[roomId];

    if (!room) {
      socket.emit("error", "Stanza non trovata");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error", "Stanza piena");
      return;
    }

    room.players.push({ id: socket.id, nome, foto });
    socket.join(roomId);
    console.log("entra nella stanza", roomId, nome);

    if (room.players.length === 2) {
      const [p1, p2] = room.players;
    
      const partita = {
        roomId,
        players: [
          { id: p1.id, nome: p1.nome, foto: p1.foto, team: "bianco" },
          { id: p2.id, nome: p2.nome, foto: p2.foto, team: "nero" }
        ],
        modalita: room.modalita // usa la modalità salvata in stanza
      };
    
      io.to(p1.id).emit("opponent_joined", {
        nome: p2.nome,
        foto: p2.foto,
        creatore: false,
        id: roomId,
        partita: partita,
      });
      io.to(p2.id).emit("opponent_join", {
        id: roomId,
        nome: p1.nome,
        foto: p1.foto,
      });
    }
  });


  socket.on("start_game", (data) => {
    const room = rooms[data.roomId];
    if (!room) return;
  
    const [p1, p2] = room.players;
    const partita = {
      roomId: data.roomId,
      bianco: { id: p1.id, nome: p1.nome, foto: p1.foto, team: "bianco" },
      nero: { id: p2.id, nome: p2.nome, foto: p2.foto, team: "nero" },
      modalita: "normale",
      online: true
    };
    
    console.log("🟢 Partita iniziata nella stanza:", data.roomId);
    io.to(data.roomId).emit("start_game", partita);
  });
  

    socket.on("partita_vinta", (data) => {
      console.log(`🏁 Partita vinta in ${data.roomId} da ${data.vincitore.nome}`);
      io.to(data.roomId).emit("partita_vinta", data);
      delete rooms[data.roomId];
    });

  socket.on("move", (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    room.turno = room.turno === "bianco" ? "nero" : "bianco";
    io.to(data.roomId).emit("opponent_move", {
      ...data.move,
      nextTurn: room.turno
    });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnesso: ${socket.id}`);
  
    for (const [roomId, room] of Object.entries(rooms)) {
      const index = room.players.findIndex(p => p.id === socket.id);
  
      if (index !== -1) {
        const giocatoreDisconnesso = room.players[index];
        const giocatoreRimasto = room.players.find(p => p.id !== socket.id);
  
        room.players.splice(index, 1);
  
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Stanza ${roomId} eliminata perché vuota`);
        } else {
          console.log(`Giocatore disconnesso dalla stanza ${roomId}:`, giocatoreDisconnesso.nome);
  
          // Invia evento di vittoria automatica al giocatore rimasto
          if (giocatoreRimasto) {
            io.to(giocatoreRimasto.id).emit("partita_vinta", {
              roomId,
              vincitore: {
                nome: giocatoreRimasto.nome,
                foto: giocatoreRimasto.foto
              },
              abbandono: true
            });
          }
  
          // Opzionale: notificare all’altro giocatore che l’avversario ha abbandonato
          io.to(roomId).emit("player_left");
        }
  
        break;
      }
    }
  });
  
});

server.listen(3000, () => console.log("Server Socket.IO in ascolto sulla porta 3000"));
