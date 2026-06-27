import { spawn } from 'node:child_process';

const vite = spawn('npm.cmd', ['run', 'dev:vite'], {
  stdio: 'inherit',
  shell: false
});

let electronStarted = false;

const startElectron = () => {
  if (electronStarted) return;
  electronStarted = true;
  const electron = spawn('npm.cmd', ['run', 'electron'], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173/'
    }
  });
  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
};

setTimeout(startElectron, 2500);

vite.on('exit', (code) => {
  if (!electronStarted) process.exit(code ?? 0);
});
