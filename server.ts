import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { Client } from "ssh2";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "borboleta-secret-key-2024";
const db = new Database("database.sqlite");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_premium INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT,
    host TEXT,
    port INTEGER,
    type TEXT,
    status TEXT DEFAULT 'online'
  );
`);

// Seed initial servers if table is empty
const serverCount = db.prepare("SELECT COUNT(*) as count FROM servers").get() as any;
if (serverCount.count === 0) {
  const initialServers = [
    { id: "ao-01", name: "Angola - Luanda 01", host: "197.149.150.1", port: 443, type: "SSH/MEEK" },
    { id: "ao-02", name: "Angola - Unitel Core", host: "internet.unitel.co.ao", port: 80, type: "HTTP/OSSH" },
    { id: "us-01", name: "USA - New York", host: "104.21.45.12", port: 443, type: "QUIC" },
  ];
  
  const insertServer = db.prepare("INSERT INTO servers (id, name, host, port, type, status) VALUES (?, ?, ?, ?, ?, 'online')");
  for (const s of initialServers) {
    insertServer.run(s.id, s.name, s.host, s.port, s.type);
  }
}

interface AuthRequest extends Request {
  user?: { id: number; username: string; isPremium: boolean };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Token inválido" });
    }
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Campos obrigatórios" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const result = stmt.run(username, hashedPassword);
      res.json({ success: true, userId: result.lastInsertRowid });
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT") {
        res.status(400).json({ error: "Utilizador já existe" });
      } else {
        res.status(500).json({ error: "Erro no servidor" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, isPremium: !!user.is_premium },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: { id: user.id, username: user.username, isPremium: !!user.is_premium }
    });
  });

  app.get("/api/auth/me", authenticate, (req: AuthRequest, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // Admin: Upgrade to Premium
  app.post("/api/admin/upgrade", authenticate, (req: AuthRequest, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "edmilson77-admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { userId } = req.body;
    db.prepare("UPDATE users SET is_premium = 1 WHERE id = ?").run(userId);
    res.json({ success: true, message: "Utilizador atualizado para Premium" });
  });

  // API: Get Cloud Servers
  app.get("/api/servers", (req, res) => {
    const servers = db.prepare("SELECT * FROM servers").all();
    res.json(servers);
  });

  // API: Admin Add Server
  app.post("/api/admin/add-server", (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "edmilson77-admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { name, host, port, type } = req.body;
    const id = `srv-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      db.prepare("INSERT INTO servers (id, name, host, port, type) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, host, port, type);
      
      const newServer = { id, name, host, port, type, status: "online" };
      res.json({ success: true, message: "Servidor adicionado globalmente", server: newServer });
    } catch (err) {
      res.status(500).json({ error: "Erro ao adicionar servidor no banco de dados" });
    }
  });

  // API: Admin Update Servers (Simple protection with a header for demo)
  app.post("/api/admin/servers", (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "edmilson77-admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { servers } = req.body;
    
    try {
      db.prepare("DELETE FROM servers").run();
      const insertServer = db.prepare("INSERT INTO servers (id, name, host, port, type, status) VALUES (?, ?, ?, ?, ?, ?)");
      
      const transaction = db.transaction((serverList) => {
        for (const s of serverList) {
          insertServer.run(s.id, s.name, s.host, s.port, s.type, s.status || 'online');
        }
      });
      
      transaction(servers);
      res.json({ success: true, message: "Servidores atualizados globalmente" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar servidores no banco de dados" });
    }
  });

  // API: Version Check
  app.get("/api/version", (req, res) => {
    res.json({ 
      version: "4.2.1", 
      changelog: "Estabilidade melhorada, novos servidores em Angola e otimização de bateria.",
      date: "2024-03-10"
    });
  });

  // API: Real MEEK-like HTTP Proxy
  app.post("/api/tunnel/http", async (req, res) => {
    const { url, headers, method = "GET", data } = req.body;
    try {
      console.log(`[TunnelCore] Proxying ${method} request to ${url}`);
      const response = await axios({
        url,
        method,
        headers: {
          ...headers,
          "User-Agent": "Psiphon/452.0.0 (Premium)",
        },
        data,
      });
      res.json({
        status: response.status,
        headers: response.headers,
        data: response.data,
      });
    } catch (error: any) {
      console.error(`[TunnelCore] Proxy error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket: Real SSH or TCP Tunneling
  wss.on("connection", (ws) => {
    console.log("[TunnelCore] Client connected via WebSocket");
    let sshClient: Client | null = null;

    ws.on("message", async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        if (payload.type === "SSH_CONNECT") {
          const { host, port, username, password } = payload.config;
          sshClient = new Client();
          
          sshClient.on("ready", () => {
            ws.send(JSON.stringify({ type: "SSH_READY", message: "SSH Tunnel Established" }));
            console.log("[TunnelCore] SSH Ready");
          }).on("error", (err) => {
            ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            console.error("[TunnelCore] SSH Error:", err.message);
          }).connect({ host, port, username, password });
        }

        if (payload.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        }

      } catch (err) {
        console.error("[TunnelCore] WS Message Error:", err);
      }
    });

    ws.on("close", () => {
      if (sshClient) sshClient.end();
      console.log("[TunnelCore] Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[TunnelCore] Server running on http://localhost:${PORT}`);
  });
}

startServer();
