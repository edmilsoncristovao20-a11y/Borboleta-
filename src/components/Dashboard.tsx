import { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, Shield, Activity, Settings as SettingsIcon, Wifi, Globe, Zap, Download, Upload, Sparkles, Loader2, Image as ImageIcon, Server, Lock, Cpu, Smartphone, Share2 } from "lucide-react";
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
  const [butterflyImage, setButterflyImage] = useState<string | null>("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=800&h=800");
  const [appIcon, setAppIcon] = useState<string | null>("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=512&h=512");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Psiphon Specific Config
  const [config, setConfig] = useState<PsiphonConfig>({
    region: "Best Performance",
    customHeaders: {
      "Host": "internet.unitel.co.ao",
      "X-Online-Host": "internet.unitel.co.ao"
    },
    protocols: ["SSH", "OSSH", "UNFRONTED-MEEK-HTTP", "FRONTED-MEEK-HTTP"],
    splitTunnel: false,
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
      (msg, type) => addLog(msg, type)
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
        setDataUsage((prev) => ({
          down: prev.down + Math.random() * 500,
          up: prev.up + Math.random() * 100,
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [engineState]);

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
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight neon-glow">Borboleta VPN</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Premium Tunneling</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              getStatusColor()
            )} />
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
                <Butterfly 
                  isConnecting={engineState !== "DISCONNECTED" && engineState !== "CONNECTED"} 
                  isConnected={engineState === "CONNECTED"} 
                  isEstablishing={engineState === "ESTABLISHING_TUNNEL"}
                  imageUrl={butterflyImage}
                />

                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-serif italic text-white/90">
                    {engineState === "CONNECTED" ? "A Borboleta está a voar" : "Borboleta em repouso"}
                  </h2>
                  <p className="text-sm text-white/40 max-w-[200px] mx-auto">
                    {engineState === "CONNECTED" ? "Navegação segura e ilimitada ativa via Psiphon Core." : "Clique na borboleta para iniciar o túnel Psiphon Pro."}
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full items-center">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    className="text-[9px] uppercase tracking-[0.4em] text-white/60 mb-4 text-center px-8 italic"
                  >
                    "Quando menos esperamos Deus está lá"
                  </motion.p>
                  {engineState === "DISCONNECTED" && (
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold mb-1"
                    >
                      Conectar à Butterfly
                    </motion.p>
                  )}
                  <button
                    onClick={handleToggle}
                    disabled={engineState !== "DISCONNECTED" && engineState !== "CONNECTED"}
                    className={cn(
                      "relative group w-full max-w-[240px] py-4 rounded-full font-semibold tracking-wide transition-all duration-500 overflow-hidden",
                      engineState === "CONNECTED" 
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20" 
                        : "bg-cyan-500 text-black shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:shadow-[0_0_30px_rgba(0,242,255,0.5)]"
                    )}
                  >
                    <span className="relative z-10 uppercase text-xs tracking-widest">
                      {engineState === "CONNECTED" ? "Desconectar" : "Conectar à Butterfly"}
                    </span>
                    {engineState !== "DISCONNECTED" && engineState !== "CONNECTED" && (
                      <motion.div 
                        className="absolute inset-0 bg-white/20"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </button>

                  <button
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30 hover:text-cyan-400 transition-colors"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {isGenerating ? "Gerando..." : "Gerar Borboleta Premium"}
                  </button>
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
                    <p className="text-2xl font-mono">{(dataUsage.down / 1024).toFixed(2)} <span className="text-xs text-white/40">MB</span></p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Upload</span>
                    </div>
                    <p className="text-2xl font-mono">{(dataUsage.up / 1024).toFixed(2)} <span className="text-xs text-white/40">MB</span></p>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Region</span>
                    <span className="text-xs font-mono text-cyan-400">{config.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Active Protocol</span>
                    <span className="text-xs font-mono text-emerald-400">FRONTED-MEEK</span>
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
                <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[11px] overflow-y-auto border border-white/5 space-y-1">
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Select Region</span>
                    <select 
                      value={config.region}
                      onChange={(e) => setConfig({...config, region: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
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
                        <span className="text-xs">Tunnel Whole Device</span>
                        <input 
                          type="checkbox" 
                          checked={!config.splitTunnel}
                          onChange={(e) => setConfig({...config, splitTunnel: !e.target.checked})}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs">Disable Timeouts</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4 accent-cyan-500" />
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-3">
                  <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-cyan-200/60 leading-relaxed">
                    Psiphon Tunnel Core v3.0.0. Este motor utiliza protocolos SSH e MEEK para contornar firewalls de rede.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Brand Assets</h3>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                        {appIcon ? (
                          <img src={appIcon} alt="App Icon" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-white/20" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium">App Icon</p>
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
        <div className="p-4 bg-black/20 border-t border-white/5 flex items-center justify-around">
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
      <div className="mt-8 text-center space-y-1 opacity-20">
        <p className="text-[10px] uppercase tracking-[0.3em] font-light">Powered by Borboleta Tunnel Core v4.2</p>
        <p className="text-[8px] uppercase tracking-[0.2em]">© 2026 Borboleta VPN Labs • Angola</p>
      </div>
    </div>
  );
}
