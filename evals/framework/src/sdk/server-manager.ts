import { spawn, ChildProcess } from 'child_process';
import { createOpencode } from '@opencode-ai/sdk';

export interface ServerConfig {
  port?: number;
  hostname?: string;
  printLogs?: boolean;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  timeout?: number; // ms to wait for server to start
  cwd?: string; // Working directory for the server (important for agent detection)
  debug?: boolean; // Enable debug output
  agent?: string; // Agent to use (e.g., 'openagent', 'opencoder')
}

export class ServerManager {
  private process: ChildProcess | null = null;
  private sdkServer: any = null; // SDK server instance
  private port: number;
  private hostname: string;
  private isRunning: boolean = false;
  private useSDK: boolean = false; // Use SDK's createOpencode vs manual spawn

  constructor(private config: ServerConfig = {}) {
    this.port = config.port || 0; // 0 = random port
    this.hostname = config.hostname || '127.0.0.1';
    
    // IMPORTANT: SDK mode is currently broken (session creation fails)
    // Always use manual spawn until SDK mode is fixed
    // 
    // Background:
    // - Commit 9949220 enabled SDK mode to avoid CLI installation in CI/CD
    // - SDK mode causes "No data in response" errors during session creation
    // - Manual spawn works reliably but requires opencode CLI to be installed
    // 
     // Current workflow (.github/workflows/test-agents.yml) installs CLI via:
     //   npm install -g opencode-ai
     // 
     // FIXED: Enable SDK mode with proper API key configuration
     this.useSDK = !!config.agent;
  }

  /**
   * Start the opencode server
   */
  async start(): Promise<{ url: string; port: number }> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    // Use SDK's createOpencode if agent is specified
    if (this.useSDK) {
      return this.startWithSDK();
    }

    // Otherwise use manual spawn
    return this.startManual();
  }

  /**
   * Start server using SDK's createOpencode (supports config)
   */
  private async startWithSDK(): Promise<{ url: string; port: number }> {
    try {
      const sdkConfig: any = {
        hostname: this.hostname,
        port: this.port,
        timeout: this.config.timeout || 10000,
      };

      // Add agent config if specified
      if (this.config.agent) {
        sdkConfig.config = {
          agent: this.config.agent,
        };
      }

      // Add API keys from environment
      if (process.env.GROQ_API_KEY) {
        sdkConfig.config.groqApiKey = process.env.GROQ_API_KEY;
      }
      if (process.env.GEMINI_API_KEY) {
        sdkConfig.config.geminiApiKey = process.env.GEMINI_API_KEY;
      }
      if (process.env.OPENAI_API_KEY) {
        sdkConfig.config.openaiApiKey = process.env.OPENAI_API_KEY;
      }

      // Change to the specified directory before starting
      const originalCwd = process.cwd();
      if (this.config.cwd) {
        process.chdir(this.config.cwd);
      }

      if (this.config.debug) {
        console.log(`[Server SDK] Creating server with config:`, JSON.stringify(sdkConfig, null, 2));
      }

      const opencode = await createOpencode(sdkConfig);
      
      // Restore original directory
      if (this.config.cwd) {
        process.chdir(originalCwd);
      }

      this.sdkServer = opencode.server;
      const url = opencode.server.url;
      // Extract port from URL
      const portMatch = url.match(/:(\d+)$/);
      this.port = portMatch ? parseInt(portMatch[1]) : this.port;
      this.isRunning = true;

      if (this.config.debug) {
        console.log(`[Server SDK] Started at ${url} with agent: ${this.config.agent}`);
      }

      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      return { url, port: this.port };
    } catch (error) {
      console.error('[Server SDK] Error:', error);
      throw new Error(`Failed to start server with SDK: ${(error as Error).message}`);
    }
  }

  /**
   * Start server manually using spawn (legacy method)
   */
  private async startManual(): Promise<{ url: string; port: number }> {
    return new Promise((resolve, reject) => {
      const args = ['serve'];

      if (this.port !== 0) {
        args.push('--port', this.port.toString());
      }
      if (this.hostname) {
        args.push('--hostname', this.hostname);
      }
      if (this.config.printLogs) {
        args.push('--print-logs');
      }
      if (this.config.logLevel) {
        args.push('--log-level', this.config.logLevel);
      }

      // Spawn opencode serve
      // IMPORTANT: Set cwd to ensure agent is detected from the correct directory
      this.process = spawn('opencode', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.config.cwd || process.cwd(), // Use provided cwd or current directory
      });

      let stderr = '';
      let stdout = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          this.stop();
          reject(new Error(`Server failed to start within ${this.config.timeout || 5000}ms`));
        }
      }, this.config.timeout || 5000);

      // Listen for server startup message
      this.process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        
        // Debug: Print server output
        if (this.config.debug) {
          console.log('[Server STDOUT]:', data.toString().trim());
        }
        
        // Look for "opencode server listening on http://..."
        const match = stdout.match(/opencode server listening on (http:\/\/[^\s]+)/);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          const url = match[1];
          const portMatch = url.match(/:(\d+)$/);
          this.port = portMatch ? parseInt(portMatch[1]) : this.port;
          this.isRunning = true;

          resolve({ url, port: this.port });
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        
        // Debug: Print server errors
        if (this.config.debug) {
          console.log('[Server STDERR]:', data.toString().trim());
        }
        
        // Also check stderr for the startup message
        const match = stderr.match(/opencode server listening on (http:\/\/[^\s]+)/);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          const url = match[1];
          const portMatch = url.match(/:(\d+)$/);
          this.port = portMatch ? parseInt(portMatch[1]) : this.port;
          this.isRunning = true;

          resolve({ url, port: this.port });
        }
      });

      this.process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to start server: ${error.message}`));
        }
      });

      this.process.on('exit', (code) => {
        this.isRunning = false;
        if (!resolved && code !== 0) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}\nstderr: ${stderr}`));
        }
      });
    });
  }

  /**
   * Stop the opencode server
   */
  async stop(): Promise<void> {
    // Stop SDK server if using SDK
    if (this.sdkServer) {
      try {
        await this.sdkServer.close();
        this.isRunning = false;
        this.sdkServer = null;
        return;
      } catch (error) {
        console.error('Error stopping SDK server:', error);
      }
    }

    // Stop manual process
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.on('exit', () => {
        this.isRunning = false;
        this.process = null;
        resolve();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Force kill after 3 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
    });
  }

  /**
   * Get the server URL
   */
  getUrl(): string | null {
    if (!this.isRunning) {
      return null;
    }
    return `http://${this.hostname}:${this.port}`;
  }

  /**
   * Check if server is running
   */
  running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the server port
   */
  getPort(): number | null {
    return this.isRunning ? this.port : null;
  }
}
