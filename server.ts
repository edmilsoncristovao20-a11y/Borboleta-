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
    sni TEXT,
    is_global INTEGER DEFAULT 0,
    status TEXT DEFAULT 'online'
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id TEXT PRIMARY KEY,
    version TEXT,
    changelog TEXT,
    announcement TEXT,
    update_available INTEGER DEFAULT 0
  );

  -- Add is_global if missing
  BEGIN;
  SELECT CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pragma_table_info('servers') WHERE name = 'is_global') 
    THEN 'ALTER TABLE servers ADD COLUMN is_global INTEGER DEFAULT 0' 
    ELSE 'SELECT 1' 
  END AS cmd;
  COMMIT;
`);

// Seed initial config
const configCount = db.prepare("SELECT COUNT(*) as count FROM app_config").get() as any;
if (configCount.count === 0) {
  db.prepare("INSERT INTO app_config (id, version, changelog, announcement) VALUES (?, ?, ?, ?)")
    .run("main", "4.3.0", "Túnel WireGuard nativo (Project VPN), bypass SSH+SSL SNI estabilizado e interface v4.3.0 premium.", "Sistema Borboleta v4.3 ONLINE | Servidores de Angola Otimizados.");
}

// Seed initial servers if table is empty
const globalServerCount = db.prepare("SELECT COUNT(*) as count FROM servers WHERE is_global = 1").get() as any;
  if (globalServerCount.count === 0) {
    const initialServers = [
      { id: "ao-01", name: "Angola - Luanda 01", host: "197.149.150.1", port: 443, type: "SSH/MEEK", sni: "m.google.com" },
      { id: "ao-02", name: "Unitel - Core Proxy", host: "internet.unitel.co.ao", port: 80, type: "HTTP/OSSH", sni: "unitel.ao" },
      { id: "ao-03", name: "Africell - Fiber Bypass", host: "api.africell.ao", port: 443, type: "TLS", sni: "africell.ao" },
    ];
  
  const insertServer = db.prepare("INSERT INTO servers (id, name, host, port, type, sni, is_global, status) VALUES (?, ?, ?, ?, ?, ?, 1, 'online')");
  for (const s of initialServers) {
    insertServer.run(s.id, s.name, s.host, s.port, s.type, s.sni || null);
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
    if (adminKey !== "borboleta-admin-core") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { userId } = req.body;
    db.prepare("UPDATE users SET is_premium = 1 WHERE id = ?").run(userId);
    res.json({ success: true, message: "Utilizador atualizado para Premium" });
  });

  // API: Update Global App Config
  app.post("/api/admin/config", authenticate, (req: AuthRequest, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "borboleta-admin-core") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { version, changelog, announcement, update_available } = req.body;
    try {
      db.prepare("UPDATE app_config SET version = ?, changelog = ?, announcement = ?, update_available = ? WHERE id = 'main'")
        .run(version, changelog, announcement, update_available ? 1 : 0);
      res.json({ success: true, message: "Configuração global atualizada" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
  });

  // API: Get Global App Config
  app.get("/api/config", (req, res) => {
    try {
      const config = db.prepare("SELECT * FROM app_config WHERE id = 'main'").get();
      if (!config) {
        return res.json({
          version: "4.3.0",
          changelog: "Sistema Borboleta estável.",
          announcement: "Sistema Borboleta v4.3 ONLINE",
          update_available: 0
        });
      }
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar configuração" });
    }
  });

  // API: Get Posts (for Android synchronization)
  app.get("/api/posts", (req, res) => {
    const posts = [
      { id: 1, titulo: "Bem-vindo à Borboleta VPN", conteudo: "Obrigado por escolher a Borboleta VPN. Fique seguro online!" },
      { id: 2, titulo: "Nova Atualização v4.3", conteudo: "Implementamos melhorias no túnel WireGuard e suporte SSH Key-auth." },
      { id: 3, titulo: "Dica de Segurança", conteudo: "Use sempre servidores oficiais da Unitel para melhor latência em Angola." }
    ];
    res.json(posts);
  });

  // API: Admin Add Global Server
  app.post("/api/admin/add-server", authenticate, (req: AuthRequest, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "borboleta-admin-core") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { name, host, port, type, sni } = req.body;
    const id = `global-srv-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      db.prepare("INSERT INTO servers (id, name, host, port, type, sni, is_global) VALUES (?, ?, ?, ?, ?, ?, 1)")
        .run(id, name, host, port, type, sni || null);
      
      const newServer = { id, name, host, port, type, sni, is_global: 1, status: "online" };
      res.json({ success: true, message: "Servidor global adicionado", server: newServer });
    } catch (err) {
      res.status(500).json({ error: "Erro ao adicionar servidor no banco de dados" });
    }
  });

  // API: Get Servers (sorted by global first)
  app.get("/api/servers", (req, res) => {
    const servers = db.prepare("SELECT * FROM servers ORDER BY is_global DESC").all();
    res.json(servers);
  });

  // API: User Add Server
  app.post("/api/servers", (req, res) => {
    const { name, host, port, type, sni } = req.body;
    if (!name || !port || !type) {
      return res.status(400).json({ error: "Nome, Porta e Tipo são obrigatórios" });
    }
    
    const id = `user-srv-${Math.random().toString(36).substr(2, 9)}`;
    const finalHost = host || sni || "127.0.0.1";
    
    try {
      db.prepare("INSERT INTO servers (id, name, host, port, type, sni, is_global) VALUES (?, ?, ?, ?, ?, ?, 0)")
        .run(id, name, finalHost, port, type, sni || null);
      
      const newServer = { id, name, host: finalHost, port, type, sni, is_global: 0, status: "online" };
      res.json({ success: true, message: "Servidor adicionado com sucesso", server: newServer });
    } catch (err) {
      res.status(500).json({ error: "Erro ao adicionar servidor" });
    }
  });

  // API: User Delete Server
  app.delete("/api/servers/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM servers WHERE id = ?").run(id);
      res.json({ success: true, message: "Servidor removido" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao remover servidor" });
    }
  });

  // API: Admin Update Servers (Simple protection with a header for demo)
  app.post("/api/admin/servers", (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "borboleta-admin-core") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { servers } = req.body;
    
    try {
      db.prepare("DELETE FROM servers").run();
      const insertServer = db.prepare("INSERT INTO servers (id, name, host, port, type, sni, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
      
      const transaction = db.transaction((serverList) => {
        for (const s of serverList) {
          insertServer.run(s.id, s.name, s.host, s.port, s.type, s.sni || null, s.status || 'online');
        }
      });
      
      transaction(servers);
      res.json({ success: true, message: "Servidores atualizados globalmente" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar servidores no banco de dados" });
    }
  });

  // API: Version Check (Legacy - kept for compatibility)
  app.get("/api/version", (req, res) => {
    const config = db.prepare("SELECT * FROM app_config WHERE id = 'main'").get() as any;
    res.json({ 
      version: config.version, 
      changelog: config.changelog,
      date: new Date().toISOString()
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
    let shellStream: any = null;

    ws.on("message", async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        if (payload.type === "SSH_CONNECT") {
          const { host, port, username, password, privateKey } = payload.config;
          sshClient = new Client();
          
          const connectionConfig: any = { host, port, username };
          if (privateKey && privateKey.trim()) {
            connectionConfig.privateKey = privateKey;
          } else if (password) {
            connectionConfig.password = password;
          }

          sshClient.on("ready", () => {
            ws.send(JSON.stringify({ type: "SSH_READY", message: "SSH Tunnel Established" }));
            console.log("[TunnelCore] SSH Ready");
          }).on("error", (err) => {
            ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            console.error("[TunnelCore] SSH Error:", err.message);
          }).connect(connectionConfig);
        }

        if (payload.type === "SSH_SHELL" && sshClient) {
          sshClient.shell((err, stream) => {
            if (err) return ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            shellStream = stream;
            
            stream.on("data", (data: any) => {
              ws.send(JSON.stringify({ type: "SSH_DATA", data: data.toString() }));
            }).on("close", () => {
              ws.send(JSON.stringify({ type: "SSH_CLOSE" }));
              shellStream = null;
            });
          });
        }

        if (payload.type === "SSH_INPUT" && shellStream) {
          shellStream.write(payload.data);
        }

        if (payload.type === "SSH_EXEC" && sshClient) {
          sshClient.exec(payload.command, (err, stream) => {
            if (err) return ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            stream.on("data", (data: any) => {
              ws.send(JSON.stringify({ type: "SSH_DATA", data: data.toString() }));
            }).on("close", () => {
              ws.send(JSON.stringify({ type: "SSH_EXEC_DONE" }));
            });
          });
        }

        if (payload.type === "SFTP_LIST" && sshClient) {
          sshClient.sftp((err, sftp) => {
            if (err) return ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            sftp.readdir(payload.path || ".", (err, list) => {
              if (err) return ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
              ws.send(JSON.stringify({ type: "SFTP_LIST_RESULT", list }));
            });
          });
        }

        if (payload.type === "SFTP_DOWNLOAD" && sshClient) {
          const filePath = payload.path;
          const fileName = payload.filename;
          
          sshClient.sftp((err, sftp) => {
            if (err) return ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            
            sftp.readFile(filePath, (err, data) => {
              if (err) return ws.send(JSON.stringify({ type: "ERROR", message: `Erro ao ler arquivo: ${err.message}` }));
              
              ws.send(JSON.stringify({ 
                type: "SFTP_DOWNLOAD_RESULT", 
                filename: fileName,
                data: data.toString('base64')
              }));
            });
          });
        }

        if (payload.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        }

      } catch (err) {
        console.error("[TunnelCore] WS Message Error:", err);
      }
    });

    ws.on("close", () => {
      if (shellStream) shellStream.end();
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
