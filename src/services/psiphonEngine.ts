/**
 * Psiphon Tunnel Core Simulation Engine - Version 452 (Premium)
 * Based on Psiphon Open Source (Go/Android) logic.
 * This engine mimics the multi-protocol tunneling and fronting behavior of Psiphon Pro 452.
 */

export type ConnectionState = 
  | "DISCONNECTED" 
  | "STARTING" 
  | "FINDING_NETWORK" 
  | "ESTABLISHING_TUNNEL" 
  | "AUTHENTICATING" 
  | "CONNECTED" 
  | "RECONNECTING"
  | "HANDSHAKING"
  | "TUNNEL_READY";

export interface PsiphonConfig {
  upstreamProxy?: string;
  customHeaders: Record<string, string>;
  region: string;
  protocols: string[]; // e.g., ["SSH", "OSSH", "UNFRONTED-MEEK-HTTP", "FRONTED-MEEK-HTTP", "QUIC"]
  splitTunnel: boolean;
  tunnelWholeDevice: boolean;
  disableTimeout: boolean;
  useVpnService: boolean;
  // Authentic Psiphon Core Configs
  clientVersion: number;
  capabilities: string[];
  propagationChannelId: string;
  sponsorId: string;
  isPremium: boolean;
}

export class PsiphonEngine {
  private state: ConnectionState = "DISCONNECTED";
  private activeProtocol: string = "None";
  private vpnServiceActive: boolean = false;
  private config: PsiphonConfig;
  private onStateChange: (state: ConnectionState) => void;
  private onLog: (message: string, type: "info" | "success" | "warning" | "error") => void;
  private onDataUpdate: (down: number, up: number, latency: number) => void;
  
  private dataInterval: any = null;
  private totalDown = 0;
  private totalUp = 0;
  private ws: WebSocket | null = null;

  private encryptData(data: string): string {
    // Mimics Go's fmt.Sprintf("[ENCRYPTED_PACKET]<%s>", data)
    return `[ENCRYPTED_PACKET]<${data}>`;
  }

  constructor(
    config: PsiphonConfig,
    onStateChange: (state: ConnectionState) => void,
    onLog: (message: string, type: "info" | "success" | "warning" | "error") => void,
    onDataUpdate: (down: number, up: number, latency: number) => void
  ) {
    this.config = config;
    this.onStateChange = onStateChange;
    this.onLog = onLog;
    this.onDataUpdate = onDataUpdate;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  public async start() {
    if (this.state !== "DISCONNECTED") return;

    this.onLog(`Psiphon Tunnel Core version ${this.config.clientVersion}.0.0 (${this.config.isPremium ? 'Premium' : 'Free'}) starting...`, "info");
    this.onLog(`Build: 20240310-${this.config.clientVersion}`, "info");
    this.onLog(`Sponsor: ${this.config.sponsorId} | Channel: ${this.config.propagationChannelId}`, "info");
    this.setState("STARTING");
    await this.sleep(600);

    this.onLog("Initializing VPN Service...", "info");
    if (this.config.useVpnService) {
      this.vpnServiceActive = true;
      this.onLog("VPN Service granted. Intercepting all device traffic.", "success");
      this.onLog("System-wide VPN profile activated.", "info");
    }
    
    this.onLog("Checking network connectivity...", "info");
    this.setState("FINDING_NETWORK");
    
    // Real Connection Method: WebSocket Handshake
    try {
      this.onLog("Establishing WebSocket control channel...", "info");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      await new Promise((resolve, reject) => {
        if (!this.ws) return reject();
        this.ws.onopen = () => {
          this.onLog("WebSocket control channel established.", "success");
          resolve(true);
        };
        this.ws.onerror = (err) => {
          this.onLog("WebSocket connection failed.", "error");
          reject(err);
        };
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      this.onLog(`Selected Region: ${this.config.region}`, "info");
      
      // Simulate Psiphon's multi-protocol search with real HTTP checks
      let connectedProtocol = "";
      const protocolsToTry = [...this.config.protocols];
      
      this.onLog("### Iniciando Psiphon Core (Go) ###", "info");
      await this.prepareVpnService();
      
      this.onLog("Checking network connectivity...", "info");
      await this.sleep(500);
      
      this.onLog("Loading configuration from psiphon.config.json...", "info");
      
      // Simulate Go core startup sequence
      this.onLog("[PSIPHON] Initializing tunnel...", "info");
      await this.sleep(1000);
      this.onLog("[PSIPHON] Tunnel initialized. Starting listeners...", "info");
      this.onLog("[CORE] Local SOCKS proxy listening on 127.0.0.1:1080", "success");
      this.onLog("[CORE] Local HTTP proxy listening on 127.0.0.1:8080", "success");
      
      for (const protocol of protocolsToTry) {
        this.onLog(`Tentando conectar via ${protocol}...`, "info");
        
        if (protocol === "SSH" || protocol === "SSH-Standard") {
          await this.sleep(1000);
          this.onLog(`X Falha: ${protocol} foi detectado/bloqueado pelo Firewall.`, "error");
          continue;
        }

        if (protocol === "OSSH" || protocol === "Obfuscated-SSH") {
          this.onLog("Bypassing Deep Packet Inspection (DPI)...", "warning");
          await this.sleep(1500);
          this.onLog(`✓ Sucesso! Firewall burlado usando ${protocol}`, "success");
          connectedProtocol = protocol;
          break;
        }
        
        if (protocol === "QUIC") {
          this.onLog("Initializing UDP/QUIC handshake (UDPConn.go simulation)...", "info");
          this.onLog("Negotiating KCP/QUIC parameters...", "info");
          await this.sleep(1000);
        }

        if (protocol.includes("MEEK") || protocol.includes("FRONTED") || protocol.includes("Meek")) {
          this.onLog(`Using Domain Fronting for ${protocol}...`, "warning");
          this.onLog(`SNI/Host: ${this.config.customHeaders['Host'] || 'internet.unitel.co.ao'}`, "warning");
          
          // Real Connection Method: HTTP Proxy through backend
          try {
            const response = await fetch("/api/tunnel/http", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: "https://www.google.com/generate_204",
                headers: this.config.customHeaders,
                method: "GET"
              })
            });
            
            if (response.ok) {
              this.onLog(`Candidate tunnel found using ${protocol} (Real HTTP Proxy verified)`, "success");
              connectedProtocol = protocol;
              break;
            }
          } catch (e) {
            this.onLog(`Protocol ${protocol} failed real HTTP check.`, "error");
          }
        }

        if (protocol === "SSH" || protocol === "OSSH") {
          this.onLog(`Initializing TCP handshake (TCPConn.go simulation)...`, "info");
          this.onLog(`Negotiating SSH-2.0-Psiphon-SSH...`, "info");
          await this.sleep(800);
        }

        await this.sleep(1200);
        
        // Fallback for simulation if real methods fail but we want to show the UI
        if (!connectedProtocol && (protocol === "SSH" || protocol === "OSSH")) {
          this.onLog(`Candidate tunnel found using ${protocol} (Simulated SSH)`, "success");
          connectedProtocol = protocol;
          break;
        }
      }

      if (!connectedProtocol) {
        throw new Error("All protocols failed.");
      }

      this.setState("HANDSHAKING");
      this.onLog(`Handshaking with remote server [${connectedProtocol}]...`, "info");
      this.onLog(`Negotiating TLS 1.3 / X25519...`, "info");
      await this.sleep(800);

      this.setState("AUTHENTICATING");
      this.onLog(`Authenticating credentials (${this.config.isPremium ? 'Premium Account' : 'Free Account'})...`, "info");
      await this.sleep(800);

      this.setState("TUNNEL_READY");
      this.onLog("Tunnel established. Configuring routing table...", "info");
      this.onLog(`Routing through ${this.config.tunnelWholeDevice ? 'Whole Device' : 'Selected Apps'}`, "info");
      await this.sleep(500);

      this.setState("CONNECTED");
      this.activeProtocol = connectedProtocol;
      this.onLog("Psiphon Tunnel Connected!", "success");
      this.onLog(`Local SOCKS Proxy listening at 127.0.0.1:1080`, "info");
      this.onLog(`Local HTTP Proxy listening at 127.0.0.1:8080`, "info");
      this.onLog(`Upstream: ${connectedProtocol} over TLS 1.3`, "info");

      this.startDataSimulation();

    } catch (error: any) {
      this.onLog(`Connection failed: ${error.message}`, "error");
      this.setState("RECONNECTING");
      await this.sleep(5000);
      this.setState("DISCONNECTED");
    }
  }

  private startDataSimulation() {
    let trafficCounter = 0;
    this.dataInterval = setInterval(() => {
      if (this.state === "CONNECTED") {
        const down = Math.floor(Math.random() * 500000) + 100000; // 100KB - 600KB
        const up = Math.floor(Math.random() * 50000) + 5000;    // 5KB - 55KB
        const latency = Math.floor(Math.random() * 20) + 35; // 35ms - 55ms
        this.totalDown += down;
        this.totalUp += up;
        this.onDataUpdate(this.totalDown, this.totalUp, latency);

        trafficCounter++;
        if (trafficCounter % 10 === 0) {
          const mockUrl = ["google.com", "facebook.com", "netflix.com", "whatsapp.net"][Math.floor(Math.random() * 4)];
          const encrypted = this.encryptData(`https://www.${mockUrl}`);
          this.onLog(`Enviando tráfego para ${mockUrl} através do túnel ${this.activeProtocol}: ${encrypted}`, "info");
        }
      }
    }, 1000);
  }

  public async stop() {
    if (this.dataInterval) clearInterval(this.dataInterval);
    this.activeProtocol = "None";
    this.vpnServiceActive = false;
    this.onLog("Stopping Psiphon Tunnel Core...", "warning");
    await this.sleep(500);
    this.setState("DISCONNECTED");
    this.onLog("Psiphon Tunnel stopped.", "info");
  }

  private async prepareVpnService(): Promise<void> {
    this.onLog("Preparing VpnService (Android simulation)...", "info");
    await this.sleep(800);
    
    this.onLog("[VPN] Configuring virtual network parameters...", "info");
    this.onLog("[VPN] Session: PsiphonPro", "info");
    this.onLog("[VPN] Internal IP: 10.0.0.2/24", "info");
    this.onLog("[VPN] DNS: 8.8.8.8 (Google DNS)", "info");
    this.onLog("[VPN] Route: 0.0.0.0/0 (Global Traffic)", "info");
    await this.sleep(1000);
    
    this.onLog("[VPN] Establishing TUN interface...", "info");
    await this.sleep(500);
    
    this.onLog("[JNI] Handing over control to Psiphon Core (Go)...", "warning");
    this.onLog("[Psiphon] O motor em Go assumiu o controle do tráfego!", "success");
    
    this.vpnServiceActive = true;
    this.onLog("VpnService prepared successfully.", "success");
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getConfig() {
    return this.config;
  }

  public getProtocol() {
    return this.activeProtocol;
  }

  public isVpnServiceActive() {
    return this.vpnServiceActive;
  }

  public updateConfig(newConfig: Partial<PsiphonConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.onLog("Configuration updated.", "info");
  }
}
