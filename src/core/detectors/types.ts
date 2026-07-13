import type { ServiceType } from '../../types/index.js';

export interface RawService {
  name: string;
  command: string;
  type: ServiceType;
  /** True when the command is a best-effort guess (e.g. Celery/Sidekiq args) that likely needs editing before it should run. */
  guessed?: boolean;
}
