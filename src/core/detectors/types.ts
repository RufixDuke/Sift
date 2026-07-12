import type { ServiceType } from '../../types/index.js';

export interface RawService {
  name: string;
  command: string;
  type: ServiceType;
}
