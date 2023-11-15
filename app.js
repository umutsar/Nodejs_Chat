const express = require("express");
const session = require("express-session");
const socketIo = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const bodyParser = require("body-parser");

const app = express();
app.use(
   session({
      secret: "mySecretKey",
      resave: false,
      saveUninitialized: true,
   })
);
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = socketIo(server);

const db = new sqlite3.Database("mesajlar.db");

const users = [
   { username: "admin", password: "pass" },
   { username: "user2", password: "pass2" },
];

function authenticateUser(req, res, next) {
   if (req.session && req.session.user) {
      return next();
   } else {
      res.redirect("/login.html");
   }
}

let username, password;

app.post("/login", (req, res) => {
   username = req.body.username;
   password = req.body.password;

   // Kullanıcı bilgilerini kontrol et
   const user = users.find(
      (u) => u.username === username && u.password === password
   );

   if (user) {
      // Oturum açma başarılı ise kullanıcı bilgilerini oturum içinde sakla
      req.session.user = { username };
      res.redirect("/chat");
   } else {
      res.send("Geçersiz kullanıcı adı veya şifre. Tekrar deneyin.");
   }
});

app.get("/", (req, res) => {
   res.redirect("/login.html")
})

app.get("/chat", authenticateUser, (req, res) => {
   console.log(username, password);
   res.send(
      `Hoş geldiniz, ${req.session.user.username}! <a href="/logout">Çıkış Yap</a>`
   );
});

app.get("/logout", (req, res) => {
   res.send(`Görüşmek üzere ${req.session.user.username}...`);
   req.session.destroy();
});

io.on("connection", (socket) => {


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
         io.emit("message", { username: "admin", message: message }); // Kullanıcı adı ile birlikte mesajı gönder
         db.run(
            "INSERT INTO messages (message, username) VALUES (?, ?)",
            [message, "admin"],
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
const PORT = 3000;

server.listen(PORT, HOST, () => {
   console.log(`http://localhost:${PORT}/`);
});
