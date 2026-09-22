import { BaseApiClient } from '../client';

export interface VercelBlobStore {
  id: string;
  name: string;
  status: string;
  createdAt: number;
}

export interface VercelQueueItem {
  id: string;
  name: string;
  status: string;
  consumerCount: number;
}

export class PlatformServices {
  constructor(private client: BaseApiClient) {}

  public async listBlobStores(): Promise<VercelBlobStore[]> {
    try {
      const res = await this.client.request<{ stores: VercelBlobStore[] }>('/v1/blob', {
        cacheTtlSeconds: 60
      });
      return res.stores || [];
    } catch {
      return [];
    }
  }

  public async listQueues(): Promise<VercelQueueItem[]> {
    try {
      const res = await this.client.request<{ queues: VercelQueueItem[] }>('/v1/queues', {
        cacheTtlSeconds: 60
      });
      return res.queues || [];
    } catch {
      return [];
    }
  }
}
