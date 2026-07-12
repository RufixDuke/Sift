import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { detectServices } from '../../core/detector.js';
import {
  createDefaultConfig,
  writeConfig,
  CONFIG_FILE_NAME,
  validateConfig,
} from '../../core/config.js';

export interface ConfigOptions {
  package?: string;
}

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function configCommand(action: string, options: ConfigOptions): Promise<void> {
  if (action !== 'init') {
    console.error(`Unknown config action: ${action}. Supported: init`);
    process.exit(1);
  }

  const targetPath = resolve(process.cwd(), CONFIG_FILE_NAME);
  if (existsSync(targetPath)) {
    console.error(`${CONFIG_FILE_NAME} already exists.`);
    process.exit(1);
  }

  const services = detectServices({ packagePath: options.package });

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const confirmed: typeof services = [];

    console.log(`Detected ${services.length} service(s). Confirm or rename each (empty = keep):`);
    for (const svc of services) {
      const name = await prompt(rl, `  ${svc.name} (${svc.command}): `);
      confirmed.push({ ...svc, name: name || svc.name });
    }
    rl.close();

    const config = createDefaultConfig(confirmed);
    validateConfig(config);
    writeConfig(targetPath, config);
    console.log(`Created ${CONFIG_FILE_NAME} with ${confirmed.length} service(s).`);
    return;
  }

  const config = createDefaultConfig(services);
  validateConfig(config);
  writeConfig(targetPath, config);
  console.log(`Created ${CONFIG_FILE_NAME} with ${services.length} detected service(s).`);
}
