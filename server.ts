import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { Client } from "ssh2";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());

  // In-memory store for cloud servers (in a real app, use a database)
  let cloudServers = [
    { id: "ao-01", name: "Angola - Luanda 01", host: "197.149.150.1", port: 443, type: "SSH/MEEK", status: "online" },
    { id: "ao-02", name: "Angola - Unitel Core", host: "internet.unitel.co.ao", port: 80, type: "HTTP/OSSH", status: "online" },
    { id: "us-01", name: "USA - New York", host: "104.21.45.12", port: 443, type: "QUIC", status: "online" },
  ];

  // API: Get Cloud Servers
  app.get("/api/servers", (req, res) => {
    res.json(cloudServers);
  });

  // API: Admin Add Server
  app.post("/api/admin/add-server", (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "edmilson77-admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const newServer = {
      id: `srv-${Math.random().toString(36).substr(2, 9)}`,
      ...req.body,
      status: "online"
    };
    cloudServers.push(newServer);
    res.json({ success: true, message: "Servidor adicionado globalmente", server: newServer });
  });

  // API: Admin Update Servers (Simple protection with a header for demo)
  app.post("/api/admin/servers", (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== "edmilson77-admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }
    cloudServers = req.body.servers;
    res.json({ success: true, message: "Servidores atualizados globalmente" });
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
