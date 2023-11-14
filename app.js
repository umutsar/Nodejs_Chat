const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
   session({ secret: "mySecretKey", resave: true, saveUninitialized: true })
);

app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(
   "/socket.io",
   express.static(__dirname + "/node_modules/socket.io/client-dist")
);
app.use(express.static(__dirname + "/public"));

const jwt_secretKey = "gizliAnahtar1067";

const server = http.createServer(app);
const io = socketIo(server);

const db = new sqlite3.Database("mesajlar.db");

let users;
db.all("SELECT kullaniciadi, sifre FROM kullanicilar", [], (err, rows) => {
   if (err) {
      reject(err);
   }

   users = rows.map((row) => ({
      username: row.kullaniciadi,
      password: row.sifre,
   }));
});

function authenticateUser(req, res, next) {
   if (req.session && req.session.user) {
      return next();
   } else {
      res.redirect("/index.html");
   }
}


// Giriş sayfası
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Giriş kontrolü
app.post("/login", (req, res) => {
   const { username, password } = req.body;
   const kullaniciBilgisi = { userId: username, passwd: password };
   console.log(username, password);
   const user = users.find(
      (u) => u.username === username && u.password === password
   );

   if (user) {
      req.session.user = user;
      res.redirect("/chat");
   } else {
      res.send("Invalid username or password. Please try again.");
   }
});

// Ana sayfa
let geciciToken;
app.get("/chat", authenticateUser, (req, res) => {
   if (req.session.user) {
      console.log("\nYönlendirildi.");
      console.log(req.session.user);
      geciciToken = jwt.sign(req.session.user, jwt_secretKey, {
         expiresIn: "1h",
      });
      console.log("\nToken oluşturuldu, çerez oluşturmaya gidiliyor...");
      console.log("Oluşturulan Token: ", geciciToken);

      res.cookie("kullanici_cerezi", geciciToken);
      console.log("\nCookie(çerez) oluşturuldu.");
      res.sendFile(path.join(__dirname, "public", "index.html"));
   } else {
      res.redirect("/");
   }
});

app.get("/chat.html", authenticateUser, (req, res) => {
   if (req.session.user) {
      console.log("\nYönlendirildi.");
      console.log(req.session.user);
      geciciToken = jwt.sign(req.session.user, jwt_secretKey, {
         expiresIn: "1h",
      });
      console.log("\nToken oluşturuldu, çerez oluşturmaya gidiliyor...");
      console.log("Oluşturulan Token: ", geciciToken);

      res.cookie("kullanici_cerezi", geciciToken);
      console.log("\nCookie(çerez) oluşturuldu.");
      res.sendFile(path.join(__dirname, "public", "index.html"));
   } else {
      res.redirect("/");
   }
});

app.get("/cerez", (req, res) => {
   if (req.session.user) {
      let olusturulan_cerez = req.cookies.kullanici_cerezi;

      if (olusturulan_cerez) {
         jwt.verify(olusturulan_cerez, jwt_secretKey, (err, decoded) => {
            if (err) {
               res.send("Oturum süreniz doldu. Tekrardan giriş yapınız. ");
            } else {
               // Kullanıcı bilgilerini göster
               console.log(
                  "Oluşturulan şifreli çerez içeriği: ",
                  olusturulan_cerez
               );
               console.log("Çözülen çerez: ", decoded);
            }
         });
      }
   } else {
      res.redirect("/");
   }
});

io.on("connection", (socket) => {
   console.log("bağlandı.");
   socket.on("sendMessage", (data) => {
      const message = data.trim();
      console.log(message);
      if (message == "/deleteall") {
         db.run("DELETE FROM messages;");
         io.emit("deleteAllMessages");
      } else if (message.slice(0, 5) === "clear" && message.length == 6) {
         db.run(
            `DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id DESC LIMIT ${message[5]});`
         );
         io.emit("sondanSil", message[5]);
         console.log("oldu.");
      } else if (message.slice(0, 5) === "clear" && message.length == 7) {
         let sum = message[5] + message[6];
         db.run(
            `DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id DESC LIMIT ${sum});`
         );
         io.emit("sondanSil", sum);
         console.log("oldu2");
      } else {
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

const port = 3000;
app.listen(port, () => {
   console.log(`Server is running at http://localhost:${port}/index.html`);
});
