
import { PythonShell, Options } from 'python-shell';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { app } from 'electron';

function resolveResourcesRoot(): string {
    if (app.isPackaged) return process.resourcesPath
    return path.join(__dirname, '..')
}

/** Prefer bundled portable Python, then system. */
function resolvePythonPath(): string {
    const root = resolveResourcesRoot()
    const bundled = [
        path.join(root, 'runtime', 'python', 'python.exe'),
        path.join(root, 'resources', 'runtime', 'python', 'python.exe'),
    ]
    for (const candidate of bundled) {
        if (fs.existsSync(candidate)) return candidate
    }
    if (process.platform === 'win32') {
        const candidates = ['py', 'python'];
        for (const name of candidates) {
            try {
                const { execSync } = require('child_process');
                execSync(`${name} --version`, { stdio: 'pipe' });
                return name;
            } catch (_) {
                continue;
            }
        }
        return 'python';
    }
    return 'python3';
}

function resolveEngineScript(): string {
    const packaged = path.join(process.resourcesPath, 'python', 'engine.py');
    if (app.isPackaged && fs.existsSync(packaged)) return packaged;
    const dev = path.join(__dirname, '..', 'python', 'engine.py');
    return dev;
}

export class PythonManager extends EventEmitter {
    private shell: PythonShell | null = null;
    private pythonPath: string;
    private scriptPath: string;
    private commandCounter = 0;

    constructor() {
        super();
        this.pythonPath = resolvePythonPath();
        this.scriptPath = resolveEngineScript();
        if (!fs.existsSync(this.scriptPath)) {
            console.warn('[PythonManager] engine.py not found at:', this.scriptPath);
        }
    }

    start() {
        const scriptDir = path.dirname(this.scriptPath);
        const pythonOptions: string[] = ['-u'];
        const scriptArgs: string[] = [];
        if (process.platform === 'win32' && this.pythonPath === 'py') {
            pythonOptions.unshift('-3');
        }
        const resourcesRoot = resolveResourcesRoot()
        process.env.CTRACK_RESOURCES_PATH = resourcesRoot
        const ffmpegDir = path.join(resourcesRoot, 'runtime', 'ffmpeg')
        if (fs.existsSync(path.join(ffmpegDir, 'ffmpeg.exe'))) {
            process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH || ''}`
        }
        const options: Options = {
            mode: 'json',
            pythonPath: this.pythonPath,
            pythonOptions,
            scriptPath: scriptDir,
            args: scriptArgs,
            env: { ...process.env, CTRACK_RESOURCES_PATH: resourcesRoot },
        };

        this.shell = new PythonShell(path.basename(this.scriptPath), options);

        this.shell.on('message', (message: any) => {
            if (message && message.type === 'log') {
                this.emit('python-log', message.message);
            }
            // Optional: console.log('Python received:', message);
        });

        this.shell.on('error', (err) => {
            console.error('Python error:', err);
        });

        this.shell.on('stderr', (stderr) => {
            console.error('Python stderr:', stderr);
        });

        console.log('Python Sidecar started.');
    }

    async sendCommand(command: string, params: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.shell) {
                return reject('Python shell not started');
            }

            const commandId = ++this.commandCounter;
            this.shell.send({ id: commandId, command, params });

            const onMessage = (message: any) => {
                // Ignore log messages
                if (message && message.type === 'log') return;

                // Correlate by ID
                if (message && message.id === commandId) {
                    clearTimeout(timeoutId);
                    resolve(message);
                    this.shell?.removeListener('message', onMessage);
                }
            };

            this.shell.on('message', onMessage);

            // Timeout: 60 min for transcode/sequence jobs (long EXR/JPG sequences can take 30+ min)
            const timeoutMs = /transcode|webp|thumb/i.test(command) ? 3600000 : 300000;
            const timeoutId = setTimeout(() => {
                this.shell?.removeListener('message', onMessage);
                reject(`Python command timeout (ID: ${commandId}, Command: ${command})`);
            }, timeoutMs);
        });
    }

    stop() {
        if (this.shell) {
            this.shell.end((err, code, _signal) => {
                if (err) console.error('Python stop error:', err);
                console.log('Python Sidecar stopped with code', code);
            });
            this.shell = null;
        }
    }
}
