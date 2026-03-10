/**
 * Psiphon Tunnel Core Simulation Engine
 * Based on Psiphon Open Source (Go/Android) logic.
 * This engine mimics the multi-protocol tunneling and fronting behavior of Psiphon Pro.
 */

export type ConnectionState = "DISCONNECTED" | "STARTING" | "FINDING_NETWORK" | "ESTABLISHING_TUNNEL" | "AUTHENTICATING" | "CONNECTED" | "RECONNECTING";

export interface PsiphonConfig {
  upstreamProxy?: string;
  customHeaders: Record<string, string>;
  region: string;
  protocols: string[]; // e.g., ["SSH", "OSSH", "UNFRONTED-MEEK-HTTP", "FRONTED-MEEK-HTTP"]
  splitTunnel: boolean;
}

export class PsiphonEngine {
  private state: ConnectionState = "DISCONNECTED";
  private config: PsiphonConfig;
  private onStateChange: (state: ConnectionState) => void;
  private onLog: (message: string, type: "info" | "success" | "warning" | "error") => void;

  constructor(
    config: PsiphonConfig,
    onStateChange: (state: ConnectionState) => void,
    onLog: (message: string, type: "info" | "success" | "warning" | "error") => void
  ) {
    this.config = config;
    this.onStateChange = onStateChange;
    this.onLog = onLog;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  public async start() {
    if (this.state !== "DISCONNECTED") return;

    this.onLog("Psiphon Tunnel Core version 3.0.0 starting...", "info");
    this.setState("STARTING");
    await this.sleep(800);

    this.onLog("Checking network connectivity...", "info");
    this.setState("FINDING_NETWORK");
    await this.sleep(1200);

    // Simulate Psiphon's multi-protocol search
    for (const protocol of this.config.protocols) {
      this.onLog(`Attempting connection via ${protocol}...`, "info");
      
      if (protocol.includes("MEEK")) {
        this.onLog(`Using Domain Fronting for ${protocol}...`, "warning");
        this.onLog(`SNI: ${this.config.customHeaders['Host'] || 'internet.unitel.co.ao'}`, "warning");
      }

      await this.sleep(1500);
      
      // Simulate a successful find
      if (protocol === "FRONTED-MEEK-HTTP" || protocol === "SSH") {
        this.onLog(`Candidate tunnel found using ${protocol}`, "success");
        break;
      } else {
        this.onLog(`Protocol ${protocol} timed out or blocked by firewall.`, "error");
      }
    }

    this.setState("ESTABLISHING_TUNNEL");
    this.onLog("Handshaking with remote server...", "info");
    await this.sleep(1000);

    this.setState("AUTHENTICATING");
    this.onLog("Authenticating credentials...", "info");
    await this.sleep(1000);

    this.setState("CONNECTED");
    this.onLog("Psiphon Tunnel Connected!", "success");
    this.onLog(`Local Proxy listening at 127.0.0.1:8080`, "info");
  }

  public async stop() {
    this.onLog("Stopping Psiphon Tunnel...", "warning");
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
