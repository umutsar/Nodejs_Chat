const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const sqlite3 = require("sqlite3").verbose();           
const app = express();
const server = http.createServer(app);
const io = socketIo(server);                            
const db = new sqlite3.Database("mesajlar.db");

currentUsername = "guest";
currentname = "guest";

io.on("connection", (socket) => {
   console.log(`${currentname} kullanıcısı bağlandı.`);

   socket.on("login", (data) => {
      const { username, password } = data;
      // Kullanıcıyı veritabanında kontrol et
      db.get(                                                    "SELECT * FROM kullanicilar WHERE kullaniciadi = ? AND sifre = ?",
         [username, password],
         (err, row) => {
            if (err) {
               console.error(err.message);
               socket.emit("loginResponse", { success: false });
            } else {
               if (row) {
                  currentUsername = username;
                  socket.emit("loginResponse", { success: true });
               } else {
                  socket.emit("loginResponse", { success: false });
               }
            }
         }
      );
   });

   socket.on("sendMessage", (data) => {
      const message = data.trim();
      console.log(message);
      if (message == "/deleteall") {
         db.run("DELETE FROM messages;");
         io.emit("deleteAllMessages");
      }
      else if(message.slice(0, 5) === 'clear' && message.length == 6){
        db.run(`DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id DESC LIMIT ${message[5]});`);
        io.emit("sondanSil", message[5])
        console.log("oldu.")
      }
      else if(message.slice(0, 5) === 'clear' && message.length == 7) {
        let sum = message[5] + message[6]
        db.run(`DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id DESC LIMIT ${sum});`);
        io.emit("sondanSil", sum)
        console.log("oldu2")
      }
      else {
         io.emit("message", { username: currentUsername, message: message }); // Kullanıcı adı ile birlikte mesajı gönder
         db.run(
            "INSERT INTO messages (message, username) VALUES (?, ?)",
            [message, currentUsername],
            function (err) {
               if (err) {
                  return console.log(err.message);
               }
               console.log(`A row has been inserted with rowid ${this.lastID}`);
            }
         );
      }
   });

   socket.on("getInitialMessages", () => {
      db.all("SELECT * FROM messages", (err, rows) => {
         if (err) {
            console.error(err.message);
         } else {
            socket.emit("initialMessages", rows);
         }
      });
   });

   socket.on("message", (data) => {
      console.log("Yeni bir mesaj alındı: ", data);
   });
});

app.use(express.static(__dirname + "/public"));

const HOST = "0.0.0.0";
const PORT = process.env.PORT || 3000;

server.listen(PORT, HOST, () => {
   console.log(
      `Sunucu ${PORT} numaralı portta ve ${HOST} IP adresinde başlatıldı.`
   );
});
