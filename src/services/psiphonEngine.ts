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
}

export class PsiphonEngine {
  private state: ConnectionState = "DISCONNECTED";
  private config: PsiphonConfig;
  private onStateChange: (state: ConnectionState) => void;
  private onLog: (message: string, type: "info" | "success" | "warning" | "error") => void;
  private onDataUpdate: (down: number, up: number) => void;
  
  private dataInterval: any = null;
  private totalDown = 0;
  private totalUp = 0;
  private ws: WebSocket | null = null;

  constructor(
    config: PsiphonConfig,
    onStateChange: (state: ConnectionState) => void,
    onLog: (message: string, type: "info" | "success" | "warning" | "error") => void,
    onDataUpdate: (down: number, up: number) => void
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

    this.onLog(`Psiphon Tunnel Core version 452.0.0 (Premium) starting...`, "info");
    this.onLog(`Build: 20240310-452`, "info");
    this.setState("STARTING");
    await this.sleep(600);

    this.onLog("Initializing VPN Service...", "info");
    if (this.config.useVpnService) {
      this.onLog("VPN Service granted. Intercepting all traffic.", "success");
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
      for (const protocol of this.config.protocols) {
        this.onLog(`Attempting connection via ${protocol}...`, "info");
        
        if (protocol.includes("MEEK") || protocol.includes("FRONTED")) {
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

        if (protocol === "QUIC") {
          this.onLog("Initializing UDP/QUIC handshake...", "info");
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
      await this.sleep(800);

      this.setState("AUTHENTICATING");
      this.onLog("Authenticating credentials (Premium Account)...", "info");
      await this.sleep(800);

      this.setState("TUNNEL_READY");
      this.onLog("Tunnel established. Configuring routing table...", "info");
      await this.sleep(500);

      this.setState("CONNECTED");
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
    this.dataInterval = setInterval(() => {
      if (this.state === "CONNECTED") {
        const down = Math.floor(Math.random() * 500000) + 100000; // 100KB - 600KB
        const up = Math.floor(Math.random() * 50000) + 5000;    // 5KB - 55KB
        this.totalDown += down;
        this.totalUp += up;
        this.onDataUpdate(this.totalDown, this.totalUp);
      }
    }, 1000);
  }

  public async stop() {
    if (this.dataInterval) clearInterval(this.dataInterval);
    this.onLog("Stopping Psiphon Tunnel Core...", "warning");
    await this.sleep(500);
    this.setState("DISCONNECTED");
    this.onLog("Psiphon Tunnel stopped.", "info");
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getConfig() {
    return this.config;
  }

  public updateConfig(newConfig: Partial<PsiphonConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.onLog("Configuration updated.", "info");
  }
}
