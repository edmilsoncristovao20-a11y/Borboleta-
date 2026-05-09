import { useState, useEffect, useRef } from "react";
import { Terminal, Send, FolderOpen, RefreshCw, ChevronRight, Loader2, Server, Download, Trash2, Copy, FileCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface SSHTerminalProps {
  onAddLog: (msg: string, type: "info" | "success" | "warning" | "error") => void;
}

export function SSHTerminal({ onAddLog }: SSHTerminalProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [sftpFiles, setSftpFiles] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState(".");
  const [showSftp, setShowSftp] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output]);

  const [profiles, setProfiles] = useState<{name: string, host: string, port: string, username: string}[]>(() => {
    const saved = localStorage.getItem("ssh_profiles");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("ssh_profiles", JSON.stringify(profiles));
  }, [profiles]);

  const saveProfile = () => {
    if (!host || !username) return;
    const name = prompt("Nome para este perfil:", host);
    if (!name) return;
    setProfiles(prev => [...prev, { name, host, port, username }]);
    onAddLog(`Perfil "${name}" guardado.`, "success");
  };

  const loadProfile = (p: any) => {
    setHost(p.host);
    setPort(p.port);
    setUsername(p.username);
    onAddLog(`Perfil "${p.name}" carregado.`, "info");
  };

  const connect = () => {
    if (!host || !username) {
      onAddLog("Preencha host e utilizador", "error");
      return;
    }

    setIsConnecting(true);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "SSH_CONNECT",
        config: { host, port: parseInt(port), username, password, privateKey }
      }));
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "SSH_READY") {
        setIsConnected(true);
        setIsConnecting(false);
        ws.send(JSON.stringify({ type: "SSH_SHELL" }));
        onAddLog("SSH Conectado com êxito!", "success");
      } else if (payload.type === "SSH_DATA") {
        setOutput(prev => [...prev, payload.data]);
      } else if (payload.type === "SFTP_LIST_RESULT") {
        setSftpFiles(payload.list);
      } else if (payload.type === "SFTP_DOWNLOAD_RESULT") {
        const { filename, data } = payload;
        try {
          const byteCharacters = atob(data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray]);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          onAddLog(`Transferência concluída: ${filename}`, "success");
        } catch (e) {
          onAddLog("Erro ao processar download do arquivo.", "error");
        }
      } else if (payload.type === "ERROR") {
        onAddLog(payload.message, "error");
        setIsConnecting(false);
        setIsConnected(false);
      } else if (payload.type === "SSH_CLOSE") {
        setIsConnected(false);
        onAddLog("Conexão SSH encerrada.", "warning");
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
    };
  };

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "SSH_INPUT", data: command + "\n" }));
    setCommand("");
  };

  const fetchSftpList = (path: string = ".") => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "SFTP_LIST", path }));
    setCurrentPath(path);
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  const copyOutput = () => {
    const text = output.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      onAddLog("Saída do terminal copiada!", "success");
    });
  };

  const handleKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPrivateKey(content);
      onAddLog("Chave privada carregada com sucesso.", "info");
    };
    reader.readAsText(file);
  };

  const handleSftpItemClick = (file: any) => {
    const isDir = (file.attrs.mode & 0x4000) === 0x4000;
    const fullPath = currentPath === "." ? file.filename : `${currentPath}/${file.filename}`;
    
    if (isDir) {
      fetchSftpList(fullPath);
    } else {
      onAddLog(`A iniciar download de ${file.filename}...`, "info");
      wsRef.current?.send(JSON.stringify({
        type: "SFTP_DOWNLOAD",
        path: fullPath,
        filename: file.filename
      }));
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {!isConnected ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white uppercase tracking-widest text-sm">Conexão SSH Direta</h3>
            </div>
            {profiles.length > 0 && (
              <select 
                onChange={(e) => {
                  const p = profiles.find(pr => pr.name === e.target.value);
                  if (p) loadProfile(p);
                }}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-cyan-400 outline-none cursor-pointer"
              >
                <option value="">Perfis Guardados</option>
                {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] uppercase font-bold text-white/70">Host / IP</label>
              <input 
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="1.1.1.1"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-white/70">Porta</label>
              <input 
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-white/70">Utilizador</label>
            <input 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-white/70">Senha</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!!privateKey}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-white/70">Chave Privada (Opcional)</label>
              <label className="cursor-pointer text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                Carregar Arquivo
                <input type="file" className="hidden" onChange={handleKeyUpload} />
              </label>
            </div>
            <textarea 
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-cyan-400 font-mono focus:border-cyan-500/50 outline-none h-24 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={connect}
              disabled={isConnecting}
              className="flex-1 py-4 rounded-2xl bg-cyan-500 text-black font-bold uppercase tracking-[0.2em] text-xs hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all flex items-center justify-center gap-2"
            >
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              {isConnecting ? "A estabelecer Túnel..." : "Entrar no Servidor"}
            </button>
            <button
              onClick={saveProfile}
              className="px-6 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              title="Guardar Perfil"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-white/60">{host}:{port} ({username})</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={copyOutput}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all"
                title="Copiar Saída"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={clearTerminal}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-rose-400 transition-all"
                title="Limpar Terminal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  setShowSftp(!showSftp);
                  if(!showSftp) fetchSftpList();
                }}
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  showSftp ? "bg-cyan-500 text-black border-cyan-500" : "bg-white/5 border-white/10 text-white/40"
                )}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { wsRef.current?.close(); setIsConnected(false); }}
                className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Terminal Area */}
            <div className={cn(
              "flex-1 flex flex-col bg-black rounded-3xl border border-white/10 overflow-hidden",
              showSftp ? "hidden md:flex" : "flex"
            )}>
              <div className="flex-1 p-4 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap">
                {output.map((line, i) => (
                  <div key={i} className="text-emerald-400/90 leading-normal">{line}</div>
                ))}
                <div ref={terminalEndRef} />
              </div>
              
              <form onSubmit={handleSendCommand} className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
                <span className="text-cyan-400 font-mono text-xs">$</span>
                <input 
                  autoFocus
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs"
                />
                <button type="submit">
                  <Send className="w-4 h-4 text-white/20 hover:text-cyan-400 transition-colors" />
                </button>
              </form>
            </div>

            {/* SFTP View */}
            <AnimatePresence>
              {showSftp && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="w-full md:w-64 bg-white/5 rounded-3xl border border-white/10 flex flex-col overflow-hidden"
                >
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Explorador SFTP</span>
                    <button onClick={() => fetchSftpList(currentPath)}>
                      <RefreshCw className="w-3 h-3 text-white/40 hover:text-white" />
                    </button>
                  </div>
                          <div className="flex-1 overflow-y-auto p-2">
                            <div className="space-y-1">
                              {sftpFiles.map((file, i) => {
                                const isDir = (file.attrs.mode & 0x4000) === 0x4000;
                                return (
                                  <div 
                                    key={i} 
                                    onClick={() => handleSftpItemClick(file)}
                                    className="p-2 rounded-xl hover:bg-white/5 flex items-center justify-between group cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {isDir ? <FolderOpen className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
                                      <span className="text-[10px] text-white/80 truncate">{file.filename}</span>
                                    </div>
                                    {!isDir && (
                                       <Download className="w-3 h-3 text-white/0 group-hover:text-cyan-400 transition-all" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function LogOut({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
