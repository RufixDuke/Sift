import { spawn } from 'node:child_process';

function runCopyCommand(cmd: string, args: string[], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
    child.stdin.on('error', () => {
      // Swallow EPIPE if the target binary exits before we finish writing.
    });
    child.stdin.end(text);
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  switch (process.platform) {
    case 'darwin':
      return runCopyCommand('pbcopy', [], text);
    case 'win32':
      return runCopyCommand('clip', [], text);
    default: {
      if (await runCopyCommand('xclip', ['-selection', 'clipboard'], text)) return true;
      return runCopyCommand('xsel', ['--clipboard', '--input'], text);
    }
  }
}
