import { detectNodeServices } from './node.js';
import { detectPythonServices } from './python.js';
import { detectGoServices } from './go.js';
import { detectRubyServices } from './ruby.js';
import { detectRustServices } from './rust.js';
import { detectPhpServices } from './php.js';
import { detectJavaServices } from './java.js';
import { detectDotnetServices } from './dotnet.js';
import { detectProcfileServices } from './procfile.js';
import type { RawService } from './types.js';

export type { RawService } from './types.js';

export function detectInDirectory(dir: string, packageJsonPathOverride?: string): RawService[] {
  return [
    ...detectNodeServices(dir, packageJsonPathOverride),
    ...detectProcfileServices(dir),
    ...detectPythonServices(dir),
    ...detectGoServices(dir),
    ...detectRubyServices(dir),
    ...detectRustServices(dir),
    ...detectPhpServices(dir),
    ...detectJavaServices(dir),
    ...detectDotnetServices(dir),
  ];
}
