import { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, Shield, Activity, Settings as SettingsIcon, Wifi, Globe, Zap, Download, Upload, Sparkles, Loader2, Image as ImageIcon, Server, Lock, Cpu, Smartphone, Share2, RefreshCw, CheckCircle2, User as UserIcon, LogOut, LineChart as LineChartIcon, Layers, FolderOpen, Send, ChevronRight, Bug, ShieldAlert, Radio, X, MapPin, Trash2, Copy, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Butterfly } from "./Butterfly";
import { cn } from "../lib/utils";
import { generateButterflyImage, generateAppIcon } from "../services/gemini";
import { PsiphonEngine, ConnectionState, PsiphonConfig } from "../services/psiphonEngine";
import { useAuth } from "../context/AuthContext";
import { LoginModal } from "./LoginModal";
import { SSHTerminal } from "./SSHTerminal";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export default function Dashboard() {
  const [engineState, setEngineState] = useState<ConnectionState>("DISCONNECTED");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "stats" | "logs" | "settings" | "charts" | "ssh">("home");
  const [dataUsage, setDataUsage] = useState({ down: 0, up: 0 });
  const [connectionTime, setConnectionTime] = useState(0);
  const [butterflyImage, setButterflyImage] = useState<string | null>("https://lh3.googleusercontent.com/aida-public/AB6AXuDbMtm0FbqD6Cg9cyYmtR23-KYSKKJqb0HTWc1UROWt-YVlVfDnJkt0m07k5swpkbjs-stqBipRZdN6WUObKqrM59F3jzRZp3Mx3chX6P-QnvNYcyFPaBFSUxXvqnnv8FHmx18b7fl2AH1jAWCXdz9tCv_EaEG3NQ4jQFk1gmcE4eJa75wixukiDXVhnC3H65fXqeez2tEB9-QyIsbt-090H-P8Y2tUUZ-kPow2UFTtGPz-ZOdCL-x9R4NY2upxe3ZOGB7KlM16nA");
  const [appIcon, setAppIcon] = useState<string | null>("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=512&h=512");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [cloudServers, setCloudServers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [appConfig, setAppConfig] = useState<any>({ version: "4.3.0", announcement: "", changelog: "" });
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUpdateForm, setAdminUpdateForm] = useState({ version: "", changelog: "", announcement: "" });
  const [versionClicks, setVersionClicks] = useState(0);
  const [newServerForm, setNewServerForm] = useState({ name: "", host: "", port: "443", type: "SSH/MEEK", sni: "" });
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [isCreateServerModalOpen, setIsCreateServerModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isWireguardMode, setIsWireguardMode] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const intentionalStopRef = useRef(false);
  const [isLightTheme, setIsLightTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "light";
    }
    return false;
  });

  const toggleTheme = () => {
    setIsLightTheme(prev => {
      const newValue = !prev;
      localStorage.setItem("theme", newValue ? "light" : "dark");
      document.body.classList.toggle("light-theme", newValue);
      return newValue;
    });
  };

  useEffect(() => {
    if (isLightTheme) {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, []);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(() => {
    return localStorage.getItem("borboleta_vpn_selected_server_id");
  });

  useEffect(() => {
    if (selectedServerId) {
      localStorage.setItem("borboleta_vpn_selected_server_id", selectedServerId);
    } else {
      localStorage.removeItem("borboleta_vpn_selected_server_id");
    }
  }, [selectedServerId]);
  const [history, setHistory] = useState<{ time: string; down: number; up: number; latency: number }[]>([]);
  const [currentLatency, setCurrentLatency] = useState(0);
  const lastDataRef = useRef({ down: 0, up: 0 });

  const { user, logout } = useAuth();
  const isPremium = user?.isPremium || false;

  useEffect(() => {
    fetchCloudServers();
    fetchAppConfig();
    
    // Auto-refresh config every 5 minutes to check for updates
    const interval = setInterval(fetchAppConfig, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchAppConfig = async () => {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (!data) {
        console.warn("Nenhuma configuração recebida do servidor.");
        return;
      }

      setAppConfig(data);
      setAdminUpdateForm({
        version: data.version || "4.3.0",
        changelog: data.changelog || "",
        announcement: data.announcement || ""
      });
      
      if (data.update_available && data.version !== "4.3.0") {
        addLog(`Nova Atualização Central: v${data.version}`, "warning");
      }
    } catch (error) {
      console.error("Erro ao sincronizar com servidor central:", error);
      // Don't flood the UI with logs for background sync, but keep the console informed
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("Histórico de logs limpo.", "info");
  };

  const copyLogs = () => {
    if (logs.length === 0) {
      addLog("Não há logs para copiar.", "warning");
      return;
    }
    const logText = logs.map(l => `[${l.timestamp}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(logText).then(() => {
      addLog("Logs copiados para a área de transferência!", "success");
    }).catch(() => {
      addLog("Erro ao copiar logs.", "error");
    });
  };

  const handleAdminLogin = () => {
    if (adminKey === "borboleta-admin-core") {
      setIsAdminAuthenticated(true);
      addLog("AUTORIZAÇÃO MESTRE CONCEDIDA", "success");
    } else {
      addLog("CHAVE DE ACESSO NEGADA", "error");
    }
  };

  const syncAppConfig = async () => {
    if (!isAdminAuthenticated) {
      addLog("Sessão Administrativa Não Autenticada", "error");
      return;
    }

    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-key": adminKey
        },
        body: JSON.stringify({
          ...adminUpdateForm,
          update_available: true
        })
      });

      if (response.ok) {
        addLog("Configuração Global Atualizada com Sucesso!", "success");
        fetchAppConfig();
        setIsAdminPanelOpen(false);
      } else {
        addLog("Erro ao publicar atualização central.", "error");
      }
    } catch (error) {
      addLog("Erro de rede com servidor central.", "error");
    }
  };

  const fetchCloudServers = async () => {
    setIsUpdating(true);
    addLog("Sincronizando com Unitel Cloud Proxy...", "info");
    try {
      // Simulate remote fetch delay
      await new Promise(r => setTimeout(r, 1500));
      const response = await fetch("/api/servers");
      const data = await response.json();
      setCloudServers(data);
      addLog(`${data.length} servidores globais sincronizados e otimizados.`, "success");
    } catch (error) {
      addLog("Falha na sincronização da rede.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectServer = (server: any) => {
    if (engineState !== "DISCONNECTED") {
      addLog("Desconecte primeiro para mudar de servidor.", "warning");
      return;
    }
    setSelectedServerId(server?.id || null);
    setConfig(prev => ({
      ...prev,
      region: server?.name || "Best Performance",
      sni: server?.sni || prev.sni
    }));
    addLog(server ? `Servidor selecionado: ${server.name}${server.sni ? ` (SNI: ${server.sni})` : ''}` : "Modo Desempenho Automático ativado.", "info");
  };

  // Psiphon Specific Config
  const [config, setConfig] = useState<PsiphonConfig>(() => {
    const saved = localStorage.getItem("borboleta_vpn_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return {
      region: "Best Performance",
      customHeaders: {
        "Host": "internet.unitel.co.ao",
        "X-Online-Host": "internet.unitel.co.ao"
      },
      protocols: ["QUIC", "SSH-Standard", "Obfuscated-SSH", "Meek-HTTP-Fronting"],
      splitTunnel: false,
      tunnelWholeDevice: true,
      disableTimeout: true,
      useVpnService: true,
      useWireguard: false,
      ipForwarding: true,
      upstreamProxy: "",
      // Authentic Psiphon Core Configs
      clientVersion: 430,
      capabilities: ["COMPRESSED_RESOURCES", "LATEST_RESOURCES", "TRUSTED_RESOURCES", "QUIC", "KCP", "WIREGUARD_GO"],
      propagationChannelId: "Borboleta-VPN-Official",
      sponsorId: "Official-Core",
      isPremium: true,
      sni: "unitel.ao",
      payload: "GET / HTTP/1.1[crlf]Host: unitel.ao[crlf]Upgrade: websocket[crlf][crlf]",
      usePythonBridge: true
    };
  });

  useEffect(() => {
    localStorage.setItem("borboleta_vpn_config", JSON.stringify(config));
  }, [config]);

  const handleUpgradeToPremium = async () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    
    try {
      addLog("Requisitando upgrade para Premium...", "info");
      const response = await fetch("/api/admin/upgrade-user", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-key": "borboleta-admin-core" // Using admin key for demo purpose
        },
        body: JSON.stringify({ username: user.username }),
      });
      
      if (response.ok) {
        addLog("Conta atualizada para Premium Pro!", "success");
        // We'd ideally refresh the user context here, but for simulation 
        // we'll just wait for the next login or refresh.
        window.location.reload();
      } else {
        addLog("Erro ao processar upgrade.", "error");
      }
    } catch (error) {
      addLog("Erro de conexão.", "error");
    }
  };

  const handleShareConfig = () => {
    const configString = btoa(JSON.stringify(config));
    const shareLink = `borboleta://${configString}`;
    navigator.clipboard.writeText(shareLink);
    addLog("Configuração borboleta:// copiada para a área de transferência!", "success");
  };

  useEffect(() => {
    const autoGenerate = async () => {
      try {
        if (await (window as any).aistudio.hasSelectedApiKey()) {
          // Only auto-generate if we haven't already generated one this session
          // to avoid repeated 403 popups if the key is invalid
          const hasGenerated = sessionStorage.getItem("borboleta_auto_generated");
          if (!hasGenerated) {
            await handleGenerateImage();
            sessionStorage.setItem("borboleta_auto_generated", "true");
          }
        }
      } catch (e) {
        console.error("Auto-generation failed", e);
      }
    };
    autoGenerate();
  }, []);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      addLog("Sistema de instalação pronto. Pode baixar a app nas configurações.", "info");
    };
    
    const installedHandler = () => {
      addLog("Aplicação instalada com êxito no ecrã principal!", "success");
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        addLog("A abrir assistente de instalação...", "info");
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          addLog("Obrigado por instalar a Borboleta VPN!", "success");
        } else {
          addLog("Instalação ignorada.", "warning");
        }
        setDeferredPrompt(null);
      } catch (err) {
        addLog("Erro ao chamar instalador.", "error");
      }
    } else {
      // Logic for devices that don't support beforeinstallprompt (iOS, custom browsers)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

      if (isStandalone) {
        alert("🎉 A Borboleta VPN já está instalada e a correr como App Nativa!");
        addLog("Aplicação já instalada no sistema.", "info");
      } else if (isIOS) {
        alert("📲 Instalação no iPhone/iOS:\n\n1. Clique no botão 'Partilhar' (ícone de seta no fundo do Safari).\n2. Selecione 'Ecrã de Início'.\n3. Clique em 'Adicionar'.");
        addLog("Instruções iOS enviadas ao utilizador.", "info");
      } else {
        alert("⚙️ Instalação Manual:\n\nChrome/Edge: Clique nos 3 pontos no canto superior e selecione 'Instalar Aplicativo'.\n\nFirefox: Clique nos 3 pontos e 'Adicionar ao Ecrã Inicial'.");
        addLog("Instruções manuais enviadas.", "info");
      }
    }
  };

  useEffect(() => {
    if (engineState === "CONNECTED" && isWireguardMode) {
      const notify = document.createElement("div");
      notify.className = "fixed top-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-[#4CAF50] text-white rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-widest animate-bounce";
      notify.innerText = "Túnel de rede estabelecido!";
      document.body.appendChild(notify);
      setTimeout(() => notify.remove(), 3000);
    }
  }, [engineState, isWireguardMode]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage("Procurando atualizações centrais...");
    
    try {
      await fetchAppConfig();
      await new Promise(r => setTimeout(r, 2000));
      
      const latestVersion = appConfig.version;
      const currentVersion = "4.3.0";
      
      if (latestVersion !== currentVersion) {
        setUpdateMessage(`Nova versão v${latestVersion} detectada!`);
        await new Promise(r => setTimeout(r, 1500));
        setUpdateMessage(`Changelog: ${appConfig.changelog}`);
        await new Promise(r => setTimeout(r, 2500));
        setUpdateMessage(`Descarregando patches críticos para v${latestVersion}...`);
        await new Promise(r => setTimeout(r, 2000));
        setUpdateMessage("Atualização Aplicada. Reiniciando Sistema Borboleta...");
        await new Promise(r => setTimeout(r, 1500));
        window.location.reload();
      } else {
        setUpdateMessage("O sistema central confirma: Versão mais recente.");
        setTimeout(() => setUpdateMessage(null), 3000);
      }
    } catch (error) {
      setUpdateMessage("Falha na sincronização com o comando central.");
      setTimeout(() => setUpdateMessage(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [...prev, newLog].slice(-50));
  };

  // Initialize Psiphon Engine
  const engine = useMemo(() => {
    return new PsiphonEngine(
      config,
      (state) => {
        setEngineState(state);
        if (state === "CONNECTED") {
          setRetryCount(0);
          if (isWireguardMode) {
            addLog("### EXECUTANDO: wg-quick up ./project_vpn.conf ###", "warning");
            addLog("Túnel de rede estabelecido com sucesso!", "success");
            setTimeout(() => addLog("Project VPN: Proteção WireGuard 256-bit ativa.", "success"), 500);
          }
        }
        
        // Auto Reconnect Logic
        if (state === "DISCONNECTED" && !intentionalStopRef.current && autoReconnect) {
          if (retryCount < 5) {
            const nextRetry = retryCount + 1;
            setRetryCount(nextRetry);
            addLog(`Conexão perdida. Tentando reconectar (Tentativa ${nextRetry}/5)...`, "warning");
            setTimeout(() => {
              if (!intentionalStopRef.current) {
                engine.start();
              }
            }, 5000);
          } else {
            addLog("Limite de tentativas de reconexão atingido.", "error");
          }
        }
      },
      (msg, type) => addLog(msg, type),
      (down, up, latency) => {
        const downRate = Math.max(0, down - lastDataRef.current.down);
        const upRate = Math.max(0, up - lastDataRef.current.up);
        lastDataRef.current = { down, up };
        setDataUsage({ down, up });
        setCurrentLatency(latency);
        setHistory(prev => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            down: Math.floor(downRate / 1024), // KB/s
            up: Math.floor(upRate / 1024), // KB/s
            latency
          };
          return [...prev, newPoint].slice(-20);
        });
      }
    );
  }, []);

  useEffect(() => {
    engine.updateConfig(config);
  }, [config, engine]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    let interval: any;
    if (engineState === "CONNECTED") {
      interval = setInterval(() => {
        setConnectionTime(prev => prev + 1);
      }, 1000);
    } else if (engineState === "DISCONNECTED") {
      setConnectionTime(0);
    }
    return () => clearInterval(interval);
  }, [engineState]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddServer = async () => {
    if (!newServerForm.name || !newServerForm.host) {
      addLog("Preencha o nome e o host do servidor.", "warning");
      return;
    }

    setIsAddingServer(true);
    try {
      const isAuthAdmin = isAdmin && isAdminAuthenticated && adminKey === "borboleta-admin-core";
      const endpoint = isAuthAdmin ? "/api/admin/add-server" : "/api/servers";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthAdmin) headers["x-admin-key"] = adminKey;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newServerForm.name,
          host: newServerForm.host || newServerForm.sni || "127.0.0.1",
          port: parseInt(newServerForm.port),
          type: newServerForm.type,
          sni: newServerForm.sni
        })
      });

      if (response.ok) {
        addLog("Servidor adicionado ao seu sistema com sucesso!", "success");
        setNewServerForm({ name: "", host: "", port: "443", type: "SSH/MEEK", sni: "" });
        setIsCreateServerModalOpen(false);
        setActiveTab("home"); // Return to main panel
        fetchCloudServers();
      } else {
        addLog("Erro ao adicionar servidor.", "error");
      }
    } catch (error) {
      addLog("Erro de conexão com o servidor.", "error");
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleDeleteServer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Deseja realmente remover este servidor?")) return;
    
    const server = cloudServers.find(s => s.id === id);
    const isGlobal = server?.is_global === 1;

    try {
      const isAuthAdmin = isAdmin && isAdminAuthenticated && adminKey === "borboleta-admin-core";
      const endpoint = (isGlobal && isAuthAdmin) ? `/api/admin/servers/${id}` : `/api/servers/${id}`;
      const headers: Record<string, string> = {};
      if (isGlobal && isAuthAdmin) headers["x-admin-key"] = adminKey;

      const response = await fetch(endpoint, { 
        method: "DELETE",
        headers
      });
      
      if (response.ok) {
        addLog(isGlobal ? "Servidor Global removido." : "Servidor removido.", "success");
        if (selectedServerId === id) setSelectedServerId(null);
        fetchCloudServers();
      } else {
        const error = await response.json();
        addLog(error.error || "Erro ao remover servidor.", "error");
      }
    } catch (error) {
      addLog("Erro ao ligar ao backend.", "error");
    }
  };

  const handleToggle = async () => {
    if (engineState === "DISCONNECTED") {
      intentionalStopRef.current = false;
      setRetryCount(0);
      await engine.start();
    } else {
      intentionalStopRef.current = true;
      await engine.stop();
    }
  };

  const handleImportConfig = async () => {
    if (!importText.startsWith("borboleta://")) {
      addLog("Formato de configuração inválido. Use borboleta://", "error");
      return;
    }

    try {
      addLog("Descodificando configuração Borboleta...", "info");
      
      const base64 = importText.replace("borboleta://", "");
      const decoded = JSON.parse(atob(base64));
      
      // Determine server properties from decoded config
      const srvName = decoded.region || decoded.name || "Imported Server";
      const srvHost = decoded.remoteHost || decoded.host || "127.0.0.1";
      const srvPort = decoded.remotePort || decoded.port || 443;
      const srvType = (decoded.protocols && decoded.protocols[0]) || decoded.type || "SSH/MEEK";
      const srvSni = decoded.sni || "";

      addLog(`Auto-Sincronizando: ${srvName} ao banco de dados...`, "info");

      // Save to database
      const isAuthAdmin = isAdmin && isAdminAuthenticated && adminKey === "borboleta-admin-core";
      const endpoint = isAuthAdmin ? "/api/admin/add-server" : "/api/servers";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthAdmin) headers["x-admin-key"] = adminKey;

      await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: srvName,
          host: srvHost,
          port: parseInt(srvPort.toString()),
          type: srvType,
          sni: srvSni
        })
      });

      const newConfig: PsiphonConfig = {
        ...config,
        ...decoded,
        region: srvName,
        isPremium: true 
      };

      setConfig(newConfig);
      addLog("Configuração importada e salva no sistema!", "success");
      setShowImportModal(false);
      setImportText("");
      fetchCloudServers(); // Refresh list
    } catch (error) {
      addLog("Erro ao processar configuração base64.", "error");
    }
  };

  const handleGenerateImage = async () => {
    try {
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }
      setIsGenerating(true);
      addLog("Generating custom premium butterfly image...", "info");
      const url = await generateButterflyImage();
      if (url) {
        setButterflyImage(url);
        addLog("Custom butterfly image generated successfully!", "success");
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.message || "";
      if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        addLog("Acesso negado. Certifique-se de usar uma chave de API de um projeto com faturamento ativo.", "error");
        // Prompt to select a different key
        await (window as any).aistudio.openSelectKey();
      } else {
        addLog("Erro ao gerar imagem. Tente novamente mais tarde.", "error");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateIcon = async () => {
    try {
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }
      setIsGeneratingIcon(true);
      addLog("Generating high-resolution app icon...", "info");
      const url = await generateAppIcon();
      if (url) {
        setAppIcon(url);
        addLog("App icon generated successfully!", "success");
      } else {
        addLog("Failed to generate app icon.", "error");
      }
    } catch (error) {
      console.error(error);
      addLog("Error during icon generation.", "error");
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  const getStatusColor = () => {
    switch (engineState) {
      case "CONNECTED": return "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]";
      case "DISCONNECTED": return "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]";
      case "RECONNECTING": return "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]";
      default: return "bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]";
    }
  };

  const getStatusText = () => {
    switch (engineState) {
      case "CONNECTED": return "Protegido";
      case "DISCONNECTED": return "Desconectado";
      case "STARTING": return "A iniciar...";
      case "FINDING_NETWORK": return "A procurar rede...";
      case "ESTABLISHING_TUNNEL": return "A criar túnel...";
      case "AUTHENTICATING": return "A autenticar...";
      case "HANDSHAKING": return "A negociar ligação (Handshake)...";
      case "TUNNEL_READY": return "Túnel pronto";
      case "RECONNECTING": return "A reconectar...";
      default: return engineState;
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <div className="atmosphere" />

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass rounded-[32px] overflow-hidden flex flex-col h-[85vh] shadow-2xl border-white/5"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-bottom border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Borboleta VPN</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
                {user ? `Olá, ${user.username}` : "Premium Tunneling"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!user ? (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white transition-colors"
              >
                <UserIcon className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  getStatusColor()
                )} />
                {isPremium && (
                  <div className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[7px] font-bold text-amber-400 uppercase tracking-tighter">Pro</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 relative">
          {/* Central Admin Announcement */}
          {appConfig.announcement && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 w-full bg-cyan-500/10 border border-cyan-500/20 rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest leading-relaxed">{appConfig.announcement}</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex flex-col items-center justify-center gap-8"
              >
                <div className="w-full flex flex-col items-center gap-6">
                  <div className="relative w-full aspect-square max-w-[280px] flex items-center justify-center">
                    {/* Technical Grid Overlay */}
                    <div className="absolute inset-0 border border-cyan-500/10 rounded-full pointer-events-none">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,112,243,0.02)_100%)]" />
                      {[0, 45, 90, 135].map(deg => (
                        <div key={deg} className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${deg}deg)` }}>
                          <div className="w-full h-[1px] bg-cyan-500/5" />
                        </div>
                      ))}
                    </div>
                    
                    <Butterfly 
                      isConnecting={engineState !== "DISCONNECTED" && engineState !== "CONNECTED"} 
                      isConnected={engineState === "CONNECTED"} 
                      isEstablishing={engineState === "ESTABLISHING_TUNNEL"}
                      imageUrl={butterflyImage}
                    />
                  </div>

                  <div className="w-full space-y-6">
                    {/* Project VPN / WireGuard Card */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => {
                        setIsWireguardMode(!isWireguardMode);
                        addLog(isWireguardMode ? "Modo Psiphon Tunnel reativado." : "Project VPN: Modo WireGuard ativado.", "info");
                      }}
                      className={cn(
                        "w-full p-5 rounded-[32px] border transition-all duration-500 cursor-pointer group relative overflow-hidden",
                        isWireguardMode 
                          ? "bg-[#1a1a1a] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                          isWireguardMode ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-white/10"
                        )}>
                          <Cpu className={cn("w-6 h-6", isWireguardMode ? "text-white" : "text-white/40")} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 mb-1">Painel de Controlo</p>
                            <button 
                              onClick={toggleTheme}
                              className="p-1 px-2 rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-white transition-all flex items-center gap-2"
                            >
                              {isLightTheme ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                              <span className="text-[8px] font-bold uppercase tracking-widest">{isLightTheme ? "Modo Escuro" : "Modo Claro"}</span>
                            </button>
                          </div>
                          <h3 className="text-sm font-black text-white uppercase tracking-tight">Project VPN</h3>
                          <p className="text-[10px] font-medium text-emerald-400">
                            {isWireguardMode ? "Núcleo de Túnel WireGuard Ativo" : "Clique para ativar Modo WireGuard"}
                          </p>
                        </div>
                        <div className={cn(
                          "w-3 h-3 rounded-full transition-all duration-500",
                          isWireguardMode ? "bg-emerald-500 animate-pulse" : "bg-white/10"
                        )} />
                      </div>
                      
                      {isWireguardMode && (
                        <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                          <Shield className="w-20 h-20 text-white rotate-12" />
                        </div>
                      )}
                    </motion.div>

                    <div className="text-center space-y-3">
                      <h2 className={cn(
                        "text-3xl font-black tracking-tighter transition-all duration-500 uppercase italic",
                        engineState === "CONNECTED" 
                          ? (isWireguardMode ? "text-[#00FF00]" : "text-emerald-400") + " drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]" : 
                        engineState === "DISCONNECTED" 
                          ? (isWireguardMode ? "text-rose-600" : "text-white/20") : 
                        "text-amber-400 animate-pulse"
                      )}>
                        {isWireguardMode && engineState === "CONNECTED" && "VPN STATUS: CONECTADO"}
                        {isWireguardMode && engineState === "DISCONNECTED" && "VPN STATUS: DESCONECTADO"}
                        {!isWireguardMode && (engineState === "CONNECTED" ? "PROTEGIDO" : engineState === "DISCONNECTED" ? "OFFLINE" : "LIGANDO...")}
                        {engineState !== "CONNECTED" && engineState !== "DISCONNECTED" && "LIGANDO..."}
                      </h2>
                    <div className="h-1.5 w-16 rounded-full overflow-hidden bg-white/5 mx-auto">
                      <motion.div 
                        className={cn(
                          "h-full w-full shadow-[0_0_10px_currentColor]",
                          engineState === "CONNECTED" ? "text-emerald-500 bg-emerald-500" :
                          engineState === "DISCONNECTED" ? "text-white/5 bg-white/10" :
                          "text-amber-500 bg-amber-500"
                        )}
                        animate={engineState !== "DISCONNECTED" && engineState !== "CONNECTED" ? { x: ["-100%", "100%"] } : { x: 0 }}
                        transition={engineState !== "DISCONNECTED" && engineState !== "CONNECTED" ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
                      />
                    </div>
                  </div>
                    
                    {/* Visual Status Indicator Badge */}
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-500",
                        engineState === "CONNECTED" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]" 
                          : engineState === "DISCONNECTED"
                          ? "bg-white/5 border-white/5 text-white/40"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mr-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <motion.div 
                            key={i} 
                            animate={engineState === "CONNECTED" ? {
                              height: [i*2, i*3, i*2],
                              opacity: [0.5, 1, 0.5]
                            } : { height: i*2, opacity: 0.2 }}
                            transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                            className={cn(
                              "w-1 rounded-full bg-current"
                            )} 
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{getStatusText()}</span>
                    </motion.div>

                    {/* Quick Advanced Actions */}
                    <div className="w-full grid grid-cols-2 gap-2 px-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (engineState !== "DISCONNECTED") return;
                          setConfig({...config, usePythonBridge: true, protocols: ["PYTHON_PROXY"]});
                          handleToggle();
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                          config.usePythonBridge ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Bug className="w-4 h-4 shrink-0" />
                        <span className="text-[7px] font-bold uppercase tracking-widest leading-tight">Injetor Python</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (engineState !== "DISCONNECTED") return;
                          setIsWireguardMode(true);
                          setConfig({...config, useWireguard: true, protocols: ["QUIC", "WIREGUARD_GO"]});
                          handleToggle();
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                          isWireguardMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Shield className="w-4 h-4 shrink-0" />
                        <span className="text-[7px] font-bold uppercase tracking-widest leading-tight">Modo WireGuard</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (engineState !== "DISCONNECTED") return;
                          setConfig({...config, protocols: ["SSL/TLS", "TLS"], sni: config.sni || "m.google.com"});
                          handleToggle();
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                          (config.protocols.includes("SSL/TLS") || config.protocols.includes("TLS")) ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Lock className="w-4 h-4 shrink-0" />
                        <span className="text-[7px] font-bold uppercase tracking-widest leading-tight">SSL/TLS Tunnel</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (engineState !== "DISCONNECTED") return;
                          setConfig({...config, protocols: ["SSH-Standard", "Obfuscated-SSH"]});
                          setActiveTab("ssh");
                          addLog("Iniciando depuração SSH direta...", "warning");
                        }}
                        className="flex items-center gap-3 p-3 rounded-2xl border bg-white/5 border-white/5 text-white/40 hover:bg-white/10 transition-all"
                      >
                        <Terminal className="w-4 h-4 shrink-0" />
                        <span className="text-[7px] font-bold uppercase tracking-widest leading-tight">SSH Debug</span>
                      </motion.button>
                    </div>

                    <div className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-rose-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Kill Switch</p>
                          <p className="text-[8px] text-white/40">Bloquear internet se a VPN cair</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setConfig({...config, ipForwarding: !config.ipForwarding})} 
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative",
                          config.ipForwarding ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-white/10'
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                          config.ipForwarding ? 'left-6' : 'left-1'
                        )} />
                      </button>
                    </div>

                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 font-bold">
                      {engineState === "CONNECTED" ? `Conectado via: ${engine.getProtocol()}` : "Ofuscação MEEK/QUIC"}
                    </p>

                    {engineState === "DISCONNECTED" && (
                      <p className="text-[9px] text-white/20 max-w-[200px] mx-auto leading-relaxed mt-2">
                        Ao conectar, a Borboleta VPN irá gerir todo o tráfego do seu telemóvel através de um túnel seguro.
                      </p>
                    )}

                    {engineState === "CONNECTED" && engine.isVpnServiceActive() && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[8px] text-cyan-400 font-bold uppercase tracking-widest mx-auto w-fit mt-1"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        Serviço .MeuVpnService Ativo
                      </motion.div>
                    )}

                    {engineState === "CONNECTED" && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] text-emerald-400 font-bold uppercase tracking-widest mx-auto w-fit mt-1"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        Criptografia AES-256 GCM Ativa
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Latência</span>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]" />
                      <span className="text-sm font-mono font-bold text-white/80">{engineState === "CONNECTED" ? `${currentLatency}ms` : "--"}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Servidor</span>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]" />
                      <span className="text-sm font-mono font-bold text-white/80 truncate">{config.region}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full items-center">
                  <button
                    onClick={handleToggle}
                    disabled={engineState !== "DISCONNECTED" && engineState !== "CONNECTED"}
                    className={cn(
                      "relative group w-full py-5 rounded-3xl font-bold tracking-widest transition-all duration-500 overflow-hidden shadow-xl",
                      engineState === "CONNECTED" 
                        ? (isWireguardMode ? "bg-[#f44336] text-white" : "bg-rose-500 text-white shadow-rose-500/20")
                        : (isWireguardMode ? "bg-[#4CAF50] text-white" : "bg-black text-white shadow-black/20")
                    )}
                  >
                    <span className="relative z-10 uppercase text-xs">
                      {isWireguardMode ? (engineState === "CONNECTED" ? "DESLIGAR" : "LIGAR VPN") : (engineState === "CONNECTED" ? "PARAR" : "CONECTAR")}
                    </span>
                    {engineState !== "DISCONNECTED" && engineState !== "CONNECTED" && (
                      <motion.div 
                        className="absolute inset-0 bg-cyan-500/20"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </button>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40 hover:text-cyan-400 transition-colors font-bold"
                    >
                      <Download className="w-3 h-3" />
                      Importar Config
                    </button>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <button
                      onClick={handleShareConfig}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40 hover:text-cyan-400 transition-colors font-bold"
                    >
                      <Share2 className="w-3 h-3" />
                      Partilhar Config
                    </button>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGenerating}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40 hover:text-cyan-400 transition-colors font-bold"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isGenerating ? "Criando..." : "Mudar Design das Asas"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Download className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Download</span>
                    </div>
                    <p className="text-2xl font-mono text-white">{(dataUsage.down / (1024 * 1024)).toFixed(2)} <span className="text-xs text-white/40">MB</span></p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Upload</span>
                    </div>
                    <p className="text-2xl font-mono text-white">{(dataUsage.up / (1024 * 1024)).toFixed(2)} <span className="text-xs text-white/40">MB</span></p>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Região</span>
                    <span className="text-xs font-mono text-cyan-400">{config.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Protocolo Ativo</span>
                    <span className="text-xs font-mono text-emerald-400">{engineState === "CONNECTED" ? engine.getProtocol() : "Nenhum"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Modo de Túnel</span>
                    <span className="text-xs font-mono text-amber-400">{config.useVpnService ? "Serviço VPN" : "Proxy Local"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Versão do Núcleo</span>
                    <span className="text-xs font-mono text-white">v{config.clientVersion}.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Estabilidade da Ligação</span>
                    <span className="text-xs font-mono text-emerald-400">{currentLatency < 50 ? "Excelente" : currentLatency < 100 ? "Boa" : "Razoável"}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className={cn(
                        "h-full",
                        currentLatency < 50 ? "bg-emerald-500" : currentLatency < 100 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.max(0, 100 - (currentLatency / 2))}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "logs" && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Log de Sistema</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                    <button
                      onClick={clearLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-2xl p-4 font-mono text-[11px] overflow-y-auto border border-white/5 space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className={cn(
                      "flex gap-2",
                      log.type === "success" ? "text-emerald-400" :
                      log.type === "warning" ? "text-amber-400" :
                      log.type === "error" ? "text-rose-400" : "text-white/60"
                    )}>
                      <span className="opacity-30">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 pb-12"
              >
                {/* Prominent Update Section */}
                <div className="p-5 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <RefreshCw className={cn("w-5 h-5 text-white", isUpdating && "animate-spin")} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/90">Atualização de Software</p>
                        <p 
                          onClick={() => {
                            setVersionClicks(prev => prev + 1);
                            if (versionClicks + 1 >= 7) {
                              setIsAdmin(true);
                              setIsAdminPanelOpen(true);
                              addLog("CONEXÃO CENTRAL ADMINISTRATIVA ESTABELECIDA", "warning");
                              setVersionClicks(0);
                            }
                          }}
                          className="text-[10px] text-white/40 cursor-pointer hover:text-cyan-400 transition-colors"
                        >
                          Versão Atual: v{appConfig.version} (MASTER)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdate}
                      disabled={isUpdating}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                        isUpdating 
                          ? "bg-white/10 text-white/40 cursor-not-allowed" 
                          : "bg-white text-black hover:bg-white/80 shadow-lg shadow-white/10"
                      )}
                    >
                      {isUpdating ? "Verificando..." : "Procurar"}
                    </button>
                  </div>

                  {updateMessage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="pt-3 border-t border-cyan-500/10"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-cyan-100">{updateMessage}</p>
                          <p className="text-[9px] text-cyan-200/60 leading-relaxed">
                            A nova versão inclui melhorias de segurança e novos protocolos de ofuscação para a rede Unitel.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Selecionar Região</span>
                    <select 
                      value={config.region}
                      onChange={(e) => {
                        const newRegion = e.target.value;
                        if (engineState !== "DISCONNECTED") {
                          addLog("Desconecte primeiro para mudar de servidor.", "warning");
                          return;
                        }
                        setConfig({...config, region: newRegion});
                        const matchingServer = cloudServers.find(s => s.name === newRegion);
                        setSelectedServerId(matchingServer?.id || null);
                        addLog(`Região alterada para: ${newRegion}`, "info");
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none text-white"
                    >
                      <option value="Best Performance">Melhor Desempenho</option>
                      {cloudServers.map(server => (
                        <option key={server.id} value={server.name}>{server.name}</option>
                      ))}
                      <option value="United States">Estados Unidos</option>
                      <option value="United Kingdom">Reino Unido</option>
                      <option value="Japan">Japão</option>
                      <option value="Germany">Alemanha</option>
                    </select>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Servidores em Nuvem</h3>
                    <div className="space-y-2">
                      {/* Best Performance Option */}
                      <div 
                        onClick={() => handleSelectServer(null)}
                        className={cn(
                          "p-4 rounded-2xl bg-white/5 border transition-all cursor-pointer group",
                          !selectedServerId 
                            ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                            : "border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              !selectedServerId ? "bg-cyan-500/20" : "bg-white/5"
                            )}>
                              <Zap className={cn(
                                "w-5 h-5 transition-all duration-300",
                                !selectedServerId ? "text-cyan-400 drop-shadow-[0_0_8px_#06b6d4]" : "text-white/40"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "text-xs font-bold transition-colors",
                                !selectedServerId ? "text-white" : "text-white/90"
                              )}>Melhor Desempenho</p>
                              <p className="text-[10px] text-white/40">Seleção automática inteligente</p>
                            </div>
                          </div>
                          {!selectedServerId && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"
                            >
                              <CheckCircle2 className="w-3 h-3 text-black" />
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {cloudServers.map((server) => (
                        <div 
                          key={server.id}
                          onClick={() => handleSelectServer(server)}
                          className={cn(
                            "p-4 rounded-2xl bg-white/5 border transition-all cursor-pointer group",
                            selectedServerId === server.id 
                              ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                              : "border-white/10 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                selectedServerId === server.id ? "bg-cyan-500/20" : "bg-white/5"
                              )}>
                                <Server className={cn(
                                  "w-5 h-5",
                                  selectedServerId === server.id ? "text-cyan-400" : "text-white/40"
                                )} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={cn(
                                    "text-xs font-bold transition-colors",
                                    selectedServerId === server.id ? "text-white" : "text-white/90"
                                  )}>{server.name}</p>
                                  {server.is_global === 1 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[6px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                                      <Globe className="w-2 h-2 drop-shadow-[0_0_3px_#06b6d4]" />
                                      Global
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/40">{server.type} • {server.host}:{server.port}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedServerId === server.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-black" />
                                </motion.div>
                              )}
                              {(server.id.startsWith("user-srv-") || (isAdmin && isAdminAuthenticated && adminKey === "borboleta-admin-core")) && (
                                <button
                                  onClick={(e) => handleDeleteServer(server.id, e)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors ml-2"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={fetchCloudServers}
                          disabled={isUpdating}
                          className={cn(
                            "flex-1 p-3 rounded-xl border text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2",
                            isUpdating 
                              ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 cursor-wait" 
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          <RefreshCw className={cn("w-3 h-3", isUpdating && "animate-spin")} />
                          {isUpdating ? "Sincronizando..." : "Sincronizar"}
                        </button>
                        <button
                          onClick={() => setIsCreateServerModalOpen(true)}
                          className="flex-1 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[10px] uppercase tracking-widest font-bold text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Server className="w-3 h-3" />
                          Novo Servidor
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Personalização</span>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs text-white/80">Tema do Sistema</span>
                        <span className="text-[9px] text-white/30">{isLightTheme ? "Modo Claro Ativado" : "Modo Escuro Ativado"}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          toggleTheme();
                        }}
                        className={cn(
                          "relative w-12 h-6 rounded-full transition-all duration-300",
                          isLightTheme ? "bg-amber-100 shadow-[0_0_10px_rgba(254,243,199,0.5)]" : "bg-indigo-900/40 shadow-[0_0_10px_rgba(49,46,129,0.3)]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300",
                          isLightTheme ? "left-7 bg-amber-500" : "left-1 bg-indigo-500"
                        )}>
                          {isLightTheme ? <Sun className="w-2.5 h-2.5 text-white" /> : <Moon className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </button>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Opções de Túnel</span>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-xs text-white">Tunelar Todo o Dispositivo</span>
                          <span className="text-[9px] text-white/50">Redirecionar todo o tráfego</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={config.tunnelWholeDevice}
                          onChange={(e) => setConfig({...config, tunnelWholeDevice: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-xs text-white">Usar Proxy Wireguard</span>
                          <span className="text-[9px] text-cyan-400/60 flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" />
                            wg-quick up wg0
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={(config as any).useWireguard}
                          onChange={(e) => setConfig({...config, useWireguard: e.target.checked} as any)}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-xs text-white">Encaminhamento de IP</span>
                          <span className="text-[9px] text-amber-400/60 flex items-center gap-1">
                            <Terminal className="w-2.5 h-2.5" />
                            sysctl.conf (IPv4 Forward)
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={config.ipForwarding}
                          onChange={(e) => setConfig({...config, ipForwarding: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-xs text-white">Modo VpnService Android</span>
                          <span className="text-[9px] text-white/50 truncate">Ligado a .MeuVpnService (Nativo)</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={config.useVpnService}
                          onChange={(e) => setConfig({...config, useVpnService: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs text-white">Desativar Timeouts</span>
                        <input 
                          type="checkbox" 
                          checked={config.disableTimeout}
                          onChange={(e) => setConfig({...config, disableTimeout: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500" 
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <div className="flex flex-col">
                          <span className="text-xs text-white/80">Reconexão Automática</span>
                          <span className="text-[9px] text-cyan-400/60 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5" />
                            Tentar reconectar em caso de queda
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={autoReconnect}
                          onChange={(e) => setAutoReconnect(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500" 
                        />
                      </label>
                    </div>
                  </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Bug className="w-4 h-4 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Python Proxy Bridge (RKT-V4)</p>
                            <p className="text-[8px] text-white/40">Usa proxy.py para bypass avançado de Firewall</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setConfig({...config, usePythonBridge: !config.usePythonBridge})}
                          className={`w-10 h-5 rounded-full transition-all relative ${config.usePythonBridge ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.usePythonBridge ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>

                      <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Configurações Avançadas de Túnel</h3>
                    
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Server Name Indication (SNI)</span>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="ex: host-gratis.com"
                          value={config.sni || ""}
                          onChange={(e) => setConfig({...config, sni: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-cyan-500/50 transition-colors text-white/80"
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                      </div>
                      <p className="text-[8px] text-white/20 px-1 italic">Usa SSL/TLS Tunneling para ocultar tráfego (SSH+SSL mode).</p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">HTTP Payload (Injection)</span>
                      <textarea 
                        rows={3}
                        placeholder="GET / HTTP/1.1[crlf]Host: [host][crlf]..."
                        value={config.payload || ""}
                        onChange={(e) => setConfig({...config, payload: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-colors resize-none text-white/80"
                      />
                      <p className="text-[8px] text-white/20 px-1 italic">Configura o "Header" que engana a operadora (HTTP Injector style).</p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Custom HTTP Headers</span>
                      <textarea 
                        rows={3}
                        value={Object.entries(config.customHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}
                        onChange={(e) => {
                          const headers: Record<string, string> = {};
                          e.target.value.split("\n").forEach(line => {
                            const [k, v] = line.split(": ");
                            if (k && v) headers[k] = v;
                          });
                          setConfig({...config, customHeaders: headers});
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-colors resize-none text-white/80"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-start gap-3">
                  <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-cyan-200/60 leading-relaxed">
                    Psiphon Tunnel Core v452.0.0 (Premium). Este motor utiliza protocolos SSH, OSSH, QUIC e MEEK para contornar firewalls de rede com ofuscação avançada.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Brand Assets</h3>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                        {appIcon ? (
                          <img src={appIcon} alt="App Icon" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-white/20" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white/90">App Icon</p>
                        <p className="text-[10px] text-white/40">High-Res Morpho Design</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGenerateIcon}
                      disabled={isGeneratingIcon}
                      className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingIcon ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Conta</h3>
                  {user ? (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white/90">{user.username}</p>
                          <p className="text-[10px] text-white/40">{isPremium ? "Subscrição Premium" : "Conta Gratuita"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isPremium && (
                          <button
                            onClick={handleUpgradeToPremium}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase tracking-tighter hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all"
                          >
                            UPGRADE
                          </button>
                        )}
                        <button
                          onClick={logout}
                          className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsLoginModalOpen(true)}
                      className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-white/60 hover:bg-white/10 transition-all"
                    >
                      Entrar na Conta
                    </button>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Informações</h3>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => {
                        const newClicks = versionClicks + 1;
                        setVersionClicks(newClicks);
                        if (newClicks >= 7) {
                          setIsAdmin(true);
                          addLog("Modo Administrador Ativado!", "success");
                        }
                      }}
                    >
                      <p className="text-xs font-medium text-white/90">Build ID {isAdmin && "(ADMIN)"}</p>
                      <p className="text-[10px] font-mono text-white/40">20240310-RELEASE</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/90">Licença</p>
                      <p className="text-[10px] text-amber-400 font-bold uppercase">Premium Pro</p>
                    </div>
                  </div>
                </div>


                {isAdmin && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-4 border-t border-cyan-500/30"
                  >
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-cyan-400">Painel do Administrador</h3>
                    <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-4">
                      <p className="text-[10px] text-cyan-200/60 leading-relaxed">
                        Como administrador, você pode adicionar novos servidores que serão propagados para todos os usuários da app.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text"
                            placeholder="Nome (ex: Angola 03)"
                            value={newServerForm.name}
                            onChange={(e) => setNewServerForm({...newServerForm, name: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:border-cyan-500/50 outline-none"
                          />
                          <input 
                            type="text"
                            placeholder="Host/IP"
                            value={newServerForm.host}
                            onChange={(e) => setNewServerForm({...newServerForm, host: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:border-cyan-500/50 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="number"
                            placeholder="Porta"
                            value={newServerForm.port}
                            onChange={(e) => setNewServerForm({...newServerForm, port: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:border-cyan-500/50 outline-none"
                          />
                          <select 
                            value={newServerForm.type}
                            onChange={(e) => setNewServerForm({...newServerForm, type: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:border-cyan-500/50 outline-none appearance-none"
                          >
                            <option value="SSH/MEEK">SSH/MEEK</option>
                            <option value="QUIC">QUIC</option>
                            <option value="HTTP/OSSH">HTTP/OSSH</option>
                            <option value="TLS">TLS</option>
                          </select>
                        </div>
                        
                        <button
                          onClick={handleAddServer}
                          disabled={isAddingServer}
                          className="w-full p-3 rounded-xl bg-cyan-500 text-black text-[10px] uppercase tracking-widest font-bold hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all disabled:opacity-50"
                        >
                          {isAddingServer ? "Adicionando..." : "Adicionar Servidor Global"}
                        </button>
                      </div>

                      <div className="pt-2 space-y-2">
                        <p className="text-[10px] text-cyan-200/40 uppercase tracking-widest font-bold">Gerir Utilizadores</p>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Username para Promoção"
                            id="promote-user-input"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:border-cyan-500/50 outline-none"
                          />
                          <button
                            onClick={async () => {
                              const input = document.getElementById('promote-user-input') as HTMLInputElement;
                              if (!input.value) return;
                              addLog(`Promovendo ${input.value} para Premium...`, "info");
                              const response = await fetch("/api/admin/upgrade-user", {
                                method: "POST",
                                headers: { 
                                  "Content-Type": "application/json",
                                  "x-admin-key": "borboleta-admin-core"
                                },
                                body: JSON.stringify({ username: input.value }),
                              });
                              if (response.ok) {
                                addLog(`Utilizador ${input.value} agora é Premium Pro!`, "success");
                                input.value = "";
                              } else {
                                addLog("Erro ao promover utilizador.", "error");
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold uppercase"
                          >
                            PROMOVER
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Gestão de Dados</h3>
                  <button
                    onClick={() => {
                      if (confirm("Tem certeza que deseja resetar todas as configurações para os padrões de fábrica?")) {
                        localStorage.removeItem("borboleta_vpn_config");
                        localStorage.removeItem("borboleta_vpn_selected_server_id");
                        window.location.reload();
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] uppercase tracking-widest font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resetar Configurações
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Instalação</h3>
                  <button
                    onClick={handleInstall}
                    className={cn(
                      "w-full p-4 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-lg",
                      deferredPrompt 
                        ? "bg-cyan-500 text-black hover:shadow-[0_0_20px_rgba(0,242,255,0.4)]" 
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                    )}
                  >
                    <Smartphone className={cn("w-5 h-5", deferredPrompt && "animate-bounce")} />
                    <span>{deferredPrompt ? "Instalar Agora" : "Como Instalar"}</span>
                  </button>
                  <p className="text-[10px] text-white/30 text-center leading-relaxed">
                    Transforme esta página numa aplicação nativa no seu celular usando a tecnologia PWA.
                  </p>
                </div>
              </motion.div>
            )}
            {activeTab === "charts" && (
              <motion.div
                key="charts"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full space-y-4"
              >
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 h-[45%]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Throughput de Dados (KB/s)</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        <span className="text-[8px] text-white/40">DOWN</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[8px] text-white/40">UP</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[calc(100%-2rem)] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip 
                          contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                          itemStyle={{ padding: '0px' }}
                        />
                        <Area type="monotone" dataKey="down" stroke="#06b6d4" fillOpacity={1} fill="url(#colorDown)" strokeWidth={2} isAnimationActive={false} />
                        <Area type="monotone" dataKey="up" stroke="#10b981" fillOpacity={1} fill="url(#colorUp)" strokeWidth={2} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 h-[45%]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/70">Latência de Ping (ms)</span>
                    <span className="text-[10px] font-mono text-amber-400">{currentLatency}ms</span>
                  </div>
                  <div className="h-[calc(100%-2rem)] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 200]} />
                        <Tooltip 
                          contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                        />
                        <Line type="stepAfter" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === "ssh" && (
              <motion.div
                key="ssh"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex flex-col"
              >
                <SSHTerminal onAddLog={addLog} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Floating Action Button */}
        <AnimatePresence>
          {activeTab === "home" && (
            <motion.button
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleToggle}
              disabled={engineState !== "DISCONNECTED" && engineState !== "CONNECTED"}
              className={cn(
                "absolute bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-[100] transition-all duration-500 border border-white/20",
                engineState === "CONNECTED" 
                  ? "bg-rose-500 shadow-rose-500/40" 
                  : (engineState === "DISCONNECTED" ? "bg-cyan-500 shadow-cyan-500/40" : "bg-amber-500 shadow-amber-500/40")
              )}
            >
              <Zap className={cn("w-6 h-6 text-white", engineState !== "DISCONNECTED" && engineState !== "CONNECTED" && "animate-pulse")} />
              {engineState !== "DISCONNECTED" && engineState !== "CONNECTED" && (
                <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <footer className="app-footer">
          <nav className="footer-nav">
            {[
              { id: "home", icon: Wifi, label: "INÍCIO", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDbMtm0FbqD6Cg9cyYmtR23-KYSKKJqb0HTWc1UROWt-YVlVfDnJkt0m07k5swpkbjs-stqBipRZdN6WUObKqrM59F3jzRZp3Mx3chX6P-QnvNYcyFPaBFSUxXvqnnv8FHmx18b7fl2AH1jAWCXdz9tCv_EaEG3NQ4jQFk1gmcE4eJa75wixukiDXVhnC3H65fXqeez2tEB9-QyIsbt-090H-P8Y2tUUZ-kPow2UFTtGPz-ZOdCL-x9R4NY2upxe3ZOGB7KlM16nA" },
              { id: "ssh", icon: Terminal, label: "SSH" },
              { id: "stats", icon: Activity, label: "STATUS" },
              { id: "charts", icon: LineChartIcon, label: "GRÁFICOS" },
              { id: "logs", icon: Layers, label: "LOGS" },
              { id: "settings", icon: SettingsIcon, label: "CONFIG" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "home") {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  console.log("Navegando para: " + item.label);
                  setActiveTab(item.id as any);
                }}
                className={cn(
                  "nav-item",
                  activeTab === item.id && "active"
                )}
              >
                <div className="icon-container">
                  {item.id === "home" && item.img ? (
                    <img 
                      src={item.img} 
                      alt={item.label}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <item.icon className="w-5 h-5 transition-colors duration-300" />
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </footer>
      </motion.div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass rounded-[32px] p-6 border-white/10 space-y-6"
            >
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-bold text-white">Importar Configuração</h3>
            <p className="text-xs text-white/40">Cole o link borboleta:// para configurar o túnel automaticamente.</p>
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="borboleta://..."
            className="w-full h-32 bg-[#0a0a0f] border border-white/10 rounded-2xl p-4 text-[10px] font-mono text-white/80 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
          />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportConfig}
                  className="flex-1 py-3 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all"
                >
                  Importar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Server Modal */}
      <AnimatePresence>
        {isCreateServerModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateServerModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass rounded-[32px] overflow-hidden border border-white/10"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Server className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Criar Novo Servidor</h2>
                    <p className="text-[10px] text-white/40">Adicione um nó personalizado à sua rede</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Nome do Servidor</label>
                    <input
                      type="text"
                      placeholder="Ex: Meu Tunnel Angola"
                      value={newServerForm.name}
                      onChange={(e) => setNewServerForm({...newServerForm, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">SNI (Server Name Indication)</label>
                    <input
                      type="text"
                      placeholder="Ex: m.google.com ou unitel.ao"
                      value={newServerForm.sni}
                      onChange={(e) => setNewServerForm({...newServerForm, sni: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Porta</label>
                      <input
                        type="number"
                        placeholder="443"
                        value={newServerForm.port}
                        onChange={(e) => setNewServerForm({...newServerForm, port: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Tipo</label>
                      <select
                        value={newServerForm.type}
                        onChange={(e) => setNewServerForm({...newServerForm, type: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors appearance-none"
                      >
                        <option value="SSH/MEEK">SSH/MEEK</option>
                        <option value="QUIC">QUIC</option>
                        <option value="HTTP/OSSH">HTTP/OSSH</option>
                        <option value="TLS">TLS Direct</option>
                        <option value="SSL/TLS">SSL/TLS</option>
                        <option value="SSH+SSL">SSH + SSL (Stunnel)</option>
                        <option value="WIREGUARD">WireGuard</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsCreateServerModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddServer}
                    disabled={isAddingServer}
                    className="flex-1 py-3 rounded-2xl bg-cyan-500 text-black text-[10px] font-bold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
                  >
                    {isAddingServer ? "Criando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

      {/* Admin Master Control Modal */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminPanelOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-md glass rounded-[40px] overflow-hidden border border-white/10 shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                      <ShieldAlert className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white uppercase tracking-tighter">Painel Mestre</h2>
                      <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest animate-pulse">Controle Central Borboleta</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAdminPanelOpen(false)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {!isAdminAuthenticated ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center space-y-1">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Acesso Restrito</p>
                        <p className="text-[9px] text-white/40">Introduza a chave mestre para desbloquear funções de administrador global.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Chave Mestra Administrativa</label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="Introduzir Chave de Acesso"
                            value={adminKey}
                            onChange={(e) => setAdminKey(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-cyan-400 focus:border-cyan-500/50 outline-none transition-all font-mono tracking-widest"
                          />
                          <Lock className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        </div>
                      </div>
                      <button
                        onClick={handleAdminLogin}
                        className="w-full py-4 rounded-2xl bg-cyan-500 text-black text-[12px] font-black uppercase tracking-tighter hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Autenticar e Entrar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                          <p className="text-[8px] uppercase tracking-widest text-white/70 mb-1">Utilizadores</p>
                          <p className="text-sm font-mono text-cyan-400">1.2k+</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                          <p className="text-[8px] uppercase tracking-widest text-white/70 mb-1">Nós (Nodes)</p>
                          <p className="text-sm font-mono text-emerald-400">{cloudServers.length}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
                          <p className="text-[8px] uppercase tracking-widest text-white/40 mb-1">Status</p>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[8px] font-bold text-emerald-500 uppercase">Online</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-1 bg-white/5 rounded-[28px] border border-white/5 grid grid-cols-2 gap-px overflow-hidden">
                        <div className="p-4 space-y-4 bg-white/5">
                          <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest text-center flex items-center justify-center gap-1.5 flex-col">
                            <Upload className="w-4 h-4 text-cyan-400" />
                            Sincronizar Update
                          </h3>
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="v4.3.1"
                              value={adminUpdateForm.version}
                              onChange={(e) => setAdminUpdateForm({...adminUpdateForm, version: e.target.value})}
                              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-white/20 font-mono"
                            />
                            <textarea
                              placeholder="Notas da versão..."
                              value={adminUpdateForm.changelog}
                              onChange={(e) => setAdminUpdateForm({...adminUpdateForm, changelog: e.target.value})}
                              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white outline-none h-20 resize-none focus:border-white/20"
                            />
                          </div>
                        </div>
                        <div className="p-4 space-y-4 bg-white/10">
                          <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest text-center flex items-center justify-center gap-1.5 flex-col">
                            <Radio className="w-4 h-4 text-indigo-400" />
                            Avisos Globais
                          </h3>
                          <textarea
                            placeholder="Mensagem global..."
                            value={adminUpdateForm.announcement}
                            onChange={(e) => setAdminUpdateForm({...adminUpdateForm, announcement: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none h-32 resize-none focus:border-white/20"
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          onClick={syncAppConfig}
                          className="flex-1 py-4 rounded-2xl bg-cyan-500 text-black text-[12px] font-black uppercase tracking-tighter hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Actualizar Todos os Dispositivos
                        </button>
                      </div>

                      <button
                        onClick={() => setIsAdminAuthenticated(false)}
                        className="w-full py-2 text-[9px] text-white/20 hover:text-rose-500 uppercase tracking-[0.2em] transition-colors"
                      >
                        Sair do Modo Operacional
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[8px] text-center text-white/20 uppercase tracking-[0.2em]">O Borboleta VPN Central sync enviará estes dados para cada utilizador activo.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <div className="mt-8 text-center space-y-1">
        <p className="text-[10px] uppercase tracking-[0.3em] font-light text-white/70">Desenvolvido com Borboleta Tunnel Core v4.3 PRO</p>
        <p className="text-[12px] font-black tracking-[0.25em] text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.5)]">CRIADO POR EDMILSON 77</p>
        <p className="text-[8px] uppercase tracking-[0.2em] text-white/60">© 2026 Borboleta VPN Labs • Angola</p>
      </div>
    </div>
  );
}
