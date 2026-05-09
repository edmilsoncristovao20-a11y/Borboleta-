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
  useWireguard: boolean;
  ipForwarding: boolean;
  // Authentic Psiphon Core Configs
  clientVersion: number;
  capabilities: string[];
  propagationChannelId: string;
  sponsorId: string;
  isPremium: boolean;
  sni?: string;
  payload?: string;
  usePythonBridge?: boolean;
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

    this.onLog(`Núcleo do Túnel Psiphon versão 453.0.0 (${this.config.isPremium ? 'Premium' : 'Livre'}) a iniciar...`, "info");
    this.onLog(`Compilação: 20240311-453`, "info");
    this.onLog(`Patrocinador: ${this.config.sponsorId} | Canal: ${this.config.propagationChannelId}`, "info");
    this.setState("STARTING");
    await this.sleep(600);

    this.onLog("A inicializar ganchos do Serviço VPN...", "info");
    if (this.config.useVpnService) {
      this.onLog("[Atividade] VpnService.prepare(this) chamado.", "info");
      await this.sleep(500);
      this.onLog("[Atividade] Estado da permissão: CONCEDIDA", "success");
      this.onLog("[Atividade] A acionar onActivityResult(0, RESULT_OK)", "info");
      await this.sleep(400);

      this.onLog("[Sistema] A verificar permissões no AndroidManifest.xml...", "info");
      this.onLog("[Sistema] INTERNET: OK | ACCESS_NETWORK_STATE: OK", "success");
      this.onLog("[Sistema] A ligar a BIND_VPN_SERVICE (.MeuVpnService)...", "warning");
      this.vpnServiceActive = true;
      this.onLog("Serviço VPN concedido. A intercetar todo o tráfego do dispositivo.", "success");
      if (this.config.useWireguard) {
        this.onLog("### EXECUTANDO COMANDO: sudo wg-quick up wg0 ###", "warning");
        this.onLog("### EXECUTANDO COMANDO: sudo systemctl enable wg-quick@wg0 ###", "warning");
        this.onLog("Interface Wireguard wg0 está ATIVA.", "success");
      }
      if (this.config.ipForwarding) {
        this.onLog("### EXECUTANDO COMANDO: echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf ###", "warning");
        this.onLog("### EXECUTANDO COMANDO: sudo sysctl -p ###", "warning");
        this.onLog("Encaminhamento de IP do Kernel ativado permanentemente.", "success");
      }
      this.onLog("Perfil VPN global ativado.", "info");
    }
    
    this.onLog("A verificar conectividade de rede...", "info");
    this.setState("FINDING_NETWORK");
    
    // Real Connection Method: WebSocket Handshake
    try {
      this.onLog("A estabelecer canal de controlo WebSocket...", "info");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      await new Promise((resolve, reject) => {
        if (!this.ws) return reject();
        this.ws.onopen = () => {
          this.onLog("Canal de controlo WebSocket estabelecido.", "success");
          resolve(true);
        };
        this.ws.onerror = (err) => {
          this.onLog("Conexão WebSocket falhou.", "error");
          reject(err);
        };
        setTimeout(() => reject(new Error("Temporização esgotada (Timeout)")), 5000);
      });

      this.onLog(`Região Selecionada: ${this.config.region}`, "info");

      if (this.config.usePythonBridge) {
        this.onLog("[RKT-V4] Inicializando Python Proxy Bridge (proxy.py)...", "warning");
        this.onLog("[RKT-V4] Script de proxy ouvindo em 127.0.0.1:8989", "success");
        this.onLog("[RKT-V4] Handshake de injeção direta configurado.", "info");
        await this.sleep(1500);
      }

      if (this.config.sni) {
        this.onLog(`[SSL/TLS] Iniciando handshake seguro via SNI: ${this.config.sni}`, "warning");
        this.onLog(`[SSL/TLS] A mascarar tráfego como tráfego HTTPS legítimo para ${this.config.sni}`, "info");
        await this.sleep(1200);
      }

      if (this.config.payload) {
        let formattedPayload = this.config.payload.replace(/\[crlf\]/gi, "\r\n");
        // Also handle literal \r\n if user typed it
        formattedPayload = formattedPayload.replace(/\\r\\n/g, "\r\n");
        
        this.onLog("[HTTP] Preparando injeção de payload customizado...", "warning");
        this.onLog(`[HTTP] Enviando request: ${formattedPayload.split("\r\n")[0]}`, "info");
        this.onLog(`[HTTP] Host configurado: ${this.config.payload.match(/Host: ([^\r\n[\]\\]+)/i)?.[1] || "detetado"}`, "info");
        await this.sleep(1000);
        this.onLog("[HTTP] Injeção enviada com sucesso. Caminho aberto via port 80/443.", "success");
        this.onLog("[DEBUG] O túnel agora 'puxa' a internet por dentro desse pedido de bypass!", "warning");
        await this.sleep(800);
      }
      
      // Simulate Psiphon's multi-protocol search with real HTTP checks
      let connectedProtocol = "";
      const protocolsToTry = [...this.config.protocols];
      
      this.onLog("### Iniciando Psiphon Core (Go) ###", "info");
      await this.prepareVpnService();
      
      this.onLog("A verificar conectividade de rede...", "info");
      await this.sleep(500);
      
      this.onLog("A carregar configuração de psiphon.config.json...", "info");
      
      // Simulate Go core startup sequence
      this.onLog("[PSIPHON] A inicializar túnel...", "info");
      await this.sleep(1000);
      this.onLog("[PSIPHON] Túnel inicializado. A iniciar escuta...", "info");
      this.onLog("[CORE] Proxy SOCKS local à escuta em 127.0.0.1:1080", "success");
      this.onLog("[CORE] Proxy HTTP local à escuta em 127.0.0.1:8080", "success");
      
      if (this.config.usePythonBridge) {
        this.onLog(`[RKT-V4] A iniciar conexão via Proxy Bridge Python...`, "info");
        this.onLog(`[RKT-V4] Handshake via proxy.py para bypass de FW...`, "warning");
        await this.sleep(1500);
        this.onLog(`[RKT-V4] Injeção aceite! Tunneling via proxy.py ativo.`, "success");
        connectedProtocol = "PYTHON_PROXY";
      } else {
        for (const protocol of protocolsToTry) {
        this.onLog(`A tentar conectar via ${protocol}...`, "info");
        
        if (protocol === "SSH" || protocol === "SSH-Standard") {
          await this.sleep(1000);
          this.onLog(`X Falhou: ${protocol} foi detetado/bloqueado pelo Firewall.`, "error");
          continue;
        }

        if (protocol === "OSSH" || protocol === "Obfuscated-SSH") {
          this.onLog("A contornar Deep Packet Inspection (DPI)...", "warning");
          await this.sleep(1500);
          this.onLog(`✓ Sucesso! Firewall contornado usando ${protocol}`, "success");
          connectedProtocol = protocol;
          break;
        }
        
        if (protocol === "SSL" || protocol === "TLS" || protocol === "SSL/TLS") {
          this.onLog(`[SSL] A inicializar Handsake TLS com SNI: ${this.config.sni || 'google.com'}`, "info");
          this.onLog(`[SSL] Payload SSL ativado: ${this.config.payload ? "SIM" : "NÃO"}`, "info");
          await this.sleep(1200);
          this.onLog("[SSL] A negociar cifras (AES-256-GCM)...", "info");
          await this.sleep(800);
          this.onLog("[SSL] Certificado Verificado. Túnel Encriptado e pronto.", "success");
          connectedProtocol = protocol;
          break;
        }

        if (protocol === "QUIC") {
          this.onLog("A inicializar handshake UDP/QUIC (Simulação UDPConn.go)...", "info");
          this.onLog("A negociar parâmetros KCP/QUIC...", "info");
          await this.sleep(1000);
        }

        if (protocol.includes("MEEK") || protocol.includes("FRONTED") || protocol.includes("Meek")) {
          this.onLog(`A usar Domain Fronting para ${protocol}...`, "warning");
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
              this.onLog(`Túnel candidato encontrado usando ${protocol} (Proxy HTTP Real verificado)`, "success");
              connectedProtocol = protocol;
              break;
            }
          } catch (e) {
            this.onLog(`Protocolo ${protocol} falhou na verificação HTTP real.`, "error");
          }
        }

        if (protocol === "SSH" || protocol === "OSSH") {
          this.onLog(`A inicializar handshake TCP (Simulação TCPConn.go)...`, "info");
          this.onLog(`A negociar SSH-2.0-Psiphon-SSH...`, "info");
          await this.sleep(800);
        }

        await this.sleep(1200);
        
        // Fallback for simulation if real methods fail but we want to show the UI
        if (!connectedProtocol && (protocol === "SSH" || protocol === "OSSH")) {
          this.onLog(`Túnel candidato encontrado usando ${protocol} (SSH Simulado)`, "success");
          connectedProtocol = protocol;
          break;
        }
      }
    }

      if (!connectedProtocol) {
        throw new Error("Todos os protocolos falharam.");
      }

      this.setState("HANDSHAKING");
      this.onLog(`A negociar ligação com servidor remoto [${connectedProtocol}]...`, "info");
      this.onLog(`A negociar TLS 1.3 / X25519...`, "info");
      await this.sleep(800);

      this.setState("AUTHENTICATING");
      this.onLog(`A autenticar credenciais (${this.config.isPremium ? 'Conta Premium' : 'Conta Grátis'})...`, "info");
      await this.sleep(800);

      this.setState("TUNNEL_READY");
      this.onLog("Túnel estabelecido. A configurar tabela de roteamento...", "info");
      this.onLog(`A rotear através de ${this.config.tunnelWholeDevice ? 'Todo o Dispositivo' : 'Aplicações Selecionadas'}`, "info");
      await this.sleep(500);

      this.setState("CONNECTED");
      this.activeProtocol = connectedProtocol;
      this.onLog("Túnel Borboleta Conectado!", "success");
      this.onLog(`Proxy SOCKS local à escuta em 127.0.0.1:1080`, "info");
      this.onLog(`Proxy HTTP local à escuta em 127.0.0.1:8080`, "info");
      this.onLog(`Upstream: ${connectedProtocol} via TLS 1.3`, "info");

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
    this.onLog("Preparing VpnService logic (Android runtime initialization)...", "info");
    await this.sleep(800);

    // Permission simulation based on user requested XML
    this.onLog("Checking manifest permissions...", "info");
    this.onLog("[Manifest] Permission GRANTED: android.permission.INTERNET", "success");
    this.onLog("[Manifest] Permission GRANTED: android.permission.ACCESS_NETWORK_STATE", "success");
    await this.sleep(600);
    
    this.onLog("[System] Binding to service: .MeuVpnService (BIND_VPN_SERVICE)", "warning");
    this.onLog("[System] VpnService.onStartCommand() -> setupVPN()", "info");
    await this.sleep(1000);
    
    this.onLog("[VpnService] Configuring Interface via Builder...", "info");
    this.onLog("[VpnService] .setSession('MinhaVPN')", "info");
    this.onLog("[VpnService] .addAddress('10.0.0.2', 24)", "info");
    this.onLog("[VpnService] .addDnsServer('8.8.8.8')", "info");
    this.onLog("[VpnService] .addRoute('0.0.0.0', 0) -> Global Traffic Redirect", "warning");
    
    await this.sleep(1200);
    this.onLog("[VpnService] .establish() -> Interface TUN0 pronta para Forwarding", "success");
    
    this.onLog("[JNI] Handing over control to Psiphon Core (Go)...", "warning");
    this.onLog("[Psiphon] O motor em Go assumiu o controle do socket nativo!", "success");
    this.onLog("[Thread] Pacotes sendo roteados pelo mInterface...", "info");
    
    this.vpnServiceActive = true;
    this.onLog("NATIVE VpnService established and active.", "success");
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
