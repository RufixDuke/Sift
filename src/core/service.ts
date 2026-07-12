import type { ServiceConfig, ServiceState, ServiceStatus } from '../types/index.js';
import { SERVICE_COLORS } from '../types/index.js';

export function createServiceState(config: ServiceConfig, index: number): ServiceState {
  return {
    ...config,
    status: 'starting' as ServiceStatus,
    logCount: 0,
    restartCount: 0,
    color: config.color || SERVICE_COLORS[index % SERVICE_COLORS.length],
  };
}
