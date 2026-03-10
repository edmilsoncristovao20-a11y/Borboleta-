import { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, Shield, Activity, Settings as SettingsIcon, Wifi, Globe, Zap, Download, Upload, Sparkles, Loader2, Image as ImageIcon, Server, Lock, Cpu, Smartphone, Share2, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Butterfly } from "./Butterfly";
import { cn } from "../lib/utils";
import { generateButterflyImage, generateAppIcon } from "../services/gemini";
import { PsiphonEngine, ConnectionState, PsiphonConfig } from "../services/psiphonEngine";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export default function Dashboard() {
  const [engineState, setEngineState] = useState<ConnectionState>("DISCONNECTED");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "stats" | "logs" | "settings">("home");
  const [dataUsage, setDataUsage] = useState({ down: 0, up: 0 });
  const [connectionTime, setConnectionTime] = useState(0);
  const [isPremium, setIsPremium] = useState(true);
  const [butterflyImage, setButterflyImage] = useState<string | null>("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=800&h=800");
  const [appIcon, setAppIcon] = useState<string | null>("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=512&h=512");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [cloudServers, setCloudServers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [versionClicks, setVersionClicks] = useState(0);
  const [newServerForm, setNewServerForm] = useState({ name: "", host: "", port: "443", type: "SSH/MEEK" });
  const [isAddingServer, setIsAddingServer] = useState(false);

  useEffect(() => {
    fetchCloudServers();
  }, []);

  const fetchCloudServers = async () => {
    try {
      const response = await fetch("/api/servers");
      const data = await response.json();
      setCloudServers(data);
      addLog("Servidores em nuvem sincronizados.", "success");
    } catch (error) {
      addLog("Erro ao sincronizar servidores.", "error");
    }
  };

  // Psiphon Specific Config
  const [config, setConfig] = useState<PsiphonConfig>({
    region: "Best Performance",
    customHeaders: {
      "Host": "internet.unitel.co.ao",
      "X-Online-Host": "internet.unitel.co.ao"
    },
    protocols: ["QUIC", "SSH", "OSSH", "UNFRONTED-MEEK-HTTP", "FRONTED-MEEK-HTTP"],
    splitTunnel: false,
    tunnelWholeDevice: true,
    disableTimeout: true,
    useVpnService: true,
    upstreamProxy: ""
  });

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
      addLog("Iniciando instalação...", "info");
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        addLog("Instalação aceite pelo utilizador.", "success");
      } else {
        addLog("Instalação cancelada.", "warning");
      }
      setDeferredPrompt(null);
    } else {
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches) {
        alert("A Borboleta VPN já está instalada e a correr como aplicação!");
      } else {
        alert("Para instalar no ecrã principal:\n\nNo Android (Chrome): Clique nos 3 pontos e 'Instalar Aplicativo'.\n\nNo iPhone (Safari): Clique no ícone de 'Compartilhar' e selecione 'Adicionar ao Ecrã de Início'.");
      }
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage("Procurando atualizações...");
    
    try {
      const response = await fetch("/api/version");
      const data = await response.json();
      
      await new Promise(r => setTimeout(r, 2000)); // Simulate check
      
      if (data.version !== "4.2.0") { // Current version is 4.2.0
        setUpdateMessage(`Nova versão ${data.version} disponível!`);
        await new Promise(r => setTimeout(r, 2000));
        setUpdateMessage(`Instalando v${data.version}...`);
        await new Promise(r => setTimeout(r, 2000));
        setUpdateMessage("Atualizado com sucesso! Reiniciando...");
        await new Promise(r => setTimeout(r, 1500));
        window.location.reload();
      } else {
        setUpdateMessage("Você já está na versão mais recente.");
        setTimeout(() => setUpdateMessage(null), 3000);
      }
    } catch (error) {
      setUpdateMessage("Erro ao verificar atualizações.");
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
      (state) => setEngineState(state),
      (msg, type) => addLog(msg, type),
      (down, up) => setDataUsage({ down, up })
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
      const response = await fetch("/api/admin/add-server", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-key": "edmilson77-admin"
        },
        body: JSON.stringify({
          name: newServerForm.name,
          host: newServerForm.host,
          port: parseInt(newServerForm.port),
          type: newServerForm.type
        })
      });

      if (response.ok) {
        addLog("Servidor global adicionado com sucesso!", "success");
        setNewServerForm({ name: "", host: "", port: "443", type: "SSH/MEEK" });
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

  const handleToggle = async () => {
    if (engineState === "DISCONNECTED") {
      await engine.start();
    } else {
      await engine.stop();
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
      } else {
        addLog("Failed to generate image. Using default.", "error");
      }
    } catch (error) {
      console.error(error);
      addLog("Error during image generation.", "error");
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
      case "CONNECTED": return "bg-emerald-500 shadow-[0_0_10px_#10b981]";
      case "DISCONNECTED": return "bg-rose-500 shadow-[0_0_10px_#f43f5e]";
      default: return "bg-amber-500 shadow-[0_0_10px_#f59e0b]";
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
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Premium Tunneling</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <span className="text-[10px] uppercase tracking-widest text-white/60 font-medium">
              {engineState.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
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

                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-white/90 tracking-tight">
                      {engineState === "CONNECTED" ? "Túnel Estabelecido" : "Pronto para Conectar"}
                    </h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">
                      {engineState === "CONNECTED" ? "Proteção Ativa • Angola" : "Ofuscação MEEK/QUIC"}
                    </p>
                  </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Latência</span>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-sm font-mono font-bold text-white/80">{engineState === "CONNECTED" ? "42ms" : "--"}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Servidor</span>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-cyan-400" />
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
                        ? "bg-rose-500 text-white shadow-rose-500/20" 
                        : "bg-black text-white shadow-black/20"
                    )}
                  >
                    <span className="relative z-10 uppercase text-xs">
                      {engineState === "CONNECTED" ? "Parar Conexão" : "Iniciar Borboleta"}
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
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40 hover:text-cyan-400 transition-colors font-bold"
                    >
                      <Server className="w-3 h-3" />
                      Mudar Servidor
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
                    <span className="text-xs text-white/60">Region</span>
                    <span className="text-xs font-mono text-cyan-400">{config.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Active Protocol</span>
                    <span className="text-xs font-mono text-emerald-400">{engineState === "CONNECTED" ? "QUIC/TLS 1.3" : "None"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Tunnel Mode</span>
                    <span className="text-xs font-mono text-amber-400">{config.useVpnService ? "VPN Service" : "Local Proxy"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Connection Time</span>
                    <span className="text-xs font-mono text-white">{formatTime(connectionTime)}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500" 
                      animate={{ width: ["95%", "99%", "98%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity }}
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
                        <p className="text-[10px] text-white/40">Versão Atual: v4.2.0</p>
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
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Select Region</span>
                    <select 
                      value={config.region}
                      onChange={(e) => setConfig({...config, region: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none text-white"
                    >
                      <option value="Best Performance">Best Performance</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Japan">Japan</option>
                      <option value="Germany">Germany</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Tunnel Options</span>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs text-white/80">Tunnel Whole Device</span>
                        <input 
                          type="checkbox" 
                          checked={config.tunnelWholeDevice}
                          onChange={(e) => setConfig({...config, tunnelWholeDevice: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs text-white/80">Use VPN Service</span>
                        <input 
                          type="checkbox" 
                          checked={config.useVpnService}
                          onChange={(e) => setConfig({...config, useVpnService: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs text-white/80">Disable Timeouts</span>
                        <input 
                          type="checkbox" 
                          checked={config.disableTimeout}
                          onChange={(e) => setConfig({...config, disableTimeout: e.target.checked})}
                          className="w-4 h-4 accent-cyan-500" 
                        />
                      </label>
                    </div>
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

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Servidores em Nuvem</h3>
                  <div className="space-y-2">
                    {cloudServers.map((server) => (
                      <div 
                        key={server.id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between group hover:border-cyan-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                            <Server className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white/90">{server.name}</p>
                            <p className="text-[10px] text-white/40">{server.type} • {server.host}:{server.port}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-[10px] text-emerald-400 uppercase font-bold">Online</span>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      onClick={fetchCloudServers}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-white/60"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Sincronizar Servidores
                    </button>
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
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Instalação</h3>
                  <button
                    onClick={handleInstall}
                    className="w-full p-4 rounded-2xl bg-cyan-500 text-black flex items-center justify-center gap-3 font-bold hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Instalar no Celular</span>
                  </button>
                  <p className="text-[10px] text-white/30 text-center leading-relaxed">
                    Transforme esta página numa aplicação nativa no seu celular usando a tecnologia PWA.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-around">
          {[
            { id: "home", icon: Wifi, label: "Home" },
            { id: "stats", icon: Activity, label: "Stats" },
            { id: "logs", icon: Terminal, label: "Logs" },
            { id: "settings", icon: SettingsIcon, label: "Config" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                activeTab === item.id ? "text-cyan-400 scale-110" : "text-white/30 hover:text-white/60"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[8px] uppercase tracking-tighter font-bold">{item.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Footer Info */}
      <div className="mt-8 text-center space-y-1 opacity-40">
        <p className="text-[10px] uppercase tracking-[0.3em] font-light text-white">Powered by Borboleta Tunnel Core v4.2</p>
        <p className="text-[11px] font-bold tracking-widest text-cyan-400">CRIADO POR EDMILSON 77</p>
        <p className="text-[8px] uppercase tracking-[0.2em] text-white">© 2026 Borboleta VPN Labs • Angola</p>
      </div>
    </div>
  );
}
