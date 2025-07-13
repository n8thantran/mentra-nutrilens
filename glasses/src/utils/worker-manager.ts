/**
 * Worker Thread Manager
 * Manages the lifecycle and communication with worker threads for parallel processing
 */

import { Worker } from 'worker_threads';
import * as path from 'path';

export interface WorkerMessage {
  type: string;
  id: string;
  [key: string]: any;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface WorkerManagerOptions {
  maxRetries?: number;
  timeout?: number;
}

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private pendingTasks: Map<string, (result: WorkerResponse) => void> = new Map();
  private workerPaths: Map<string, string> = new Map();
  private options: WorkerManagerOptions;

  constructor(options: WorkerManagerOptions = {}) {
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      ...options
    };
  }

  /**
   * Register a worker type with its script path
   */
  registerWorker(type: string, scriptPath: string): void {
    this.workerPaths.set(type, scriptPath);
  }

  /**
   * Initialize a specific worker type
   */
  async initializeWorker(type: string): Promise<boolean> {
    try {
      const scriptPath = this.workerPaths.get(type);
      if (!scriptPath) {
        throw new Error(`Worker type ${type} not registered`);
      }

      // Terminate existing worker if any
      await this.terminateWorker(type);

      // Create new worker
      const worker = new Worker(path.resolve(scriptPath));
      
      // Set up message handling
      worker.on('message', (response: WorkerResponse) => {
        this.handleWorkerMessage(response);
      });

      worker.on('error', (error) => {
        console.error(`Worker ${type} error:`, error);
        this.handleWorkerError(type, error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`Worker ${type} exited with code ${code}`);
        }
      });

      this.workers.set(type, worker);
      console.log(`✅ Worker ${type} initialized successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to initialize worker ${type}:`, error);
      return false;
    }
  }

  /**
   * Send a task to a worker
   */
  async sendTask(workerType: string, message: WorkerMessage): Promise<any> {
    const worker = this.workers.get(workerType);
    if (!worker) {
      throw new Error(`Worker ${workerType} not initialized`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(message.id);
        reject(new Error(`Task ${message.id} timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);

      this.pendingTasks.set(message.id, (response: WorkerResponse) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.error || 'Worker task failed'));
        }
      });

      worker.postMessage(message);
    });
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const callback = this.pendingTasks.get(response.id);
    if (callback) {
      callback(response);
      this.pendingTasks.delete(response.id);
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerType: string, error: Error): void {
    console.error(`Worker ${workerType} encountered an error:`, error);
    
    // Reject all pending tasks for this worker
    const failedTasks: string[] = [];
    this.pendingTasks.forEach((callback, taskId) => {
      if (taskId.startsWith(workerType)) {
        callback({
          id: taskId,
          success: false,
          error: `Worker ${workerType} error: ${error.message}`
        });
        failedTasks.push(taskId);
      }
    });

    failedTasks.forEach(taskId => this.pendingTasks.delete(taskId));
  }

  /**
   * Terminate a specific worker
   */
  async terminateWorker(type: string): Promise<void> {
    const worker = this.workers.get(type);
    if (worker) {
      try {
        await worker.terminate();
        this.workers.delete(type);
        console.log(`✅ Worker ${type} terminated successfully`);
      } catch (error) {
        console.error(`❌ Error terminating worker ${type}:`, error);
      }
    }
  }

  /**
   * Terminate all workers
   */
  async terminateAll(): Promise<void> {
    const terminationPromises = Array.from(this.workers.keys()).map(type => 
      this.terminateWorker(type)
    );
    
    await Promise.allSettled(terminationPromises);
    
    // Clear all pending tasks
    this.pendingTasks.clear();
    
    console.log('✅ All workers terminated successfully');
  }

  /**
   * Check if a worker is available
   */
  isWorkerAvailable(type: string): boolean {
    return this.workers.has(type);
  }

  /**
   * Get worker statistics
   */
  getStats(): { [workerType: string]: { active: boolean; pendingTasks: number } } {
    const stats: { [workerType: string]: { active: boolean; pendingTasks: number } } = {};
    
    this.workers.forEach((worker, type) => {
      const pendingTasks = Array.from(this.pendingTasks.keys())
        .filter(taskId => taskId.startsWith(type))
        .length;
      
      stats[type] = {
        active: true,
        pendingTasks
      };
    });

    return stats;
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId(workerType: string): string {
    return `${workerType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Default worker manager instance
export const defaultWorkerManager = new WorkerManager();

// Helper functions for common worker operations
export async function initializeDefaultWorkers(): Promise<boolean> {
  const imageWorkerPath = path.resolve(__dirname, '../workers/image-worker.js');
  const audioWorkerPath = path.resolve(__dirname, '../workers/audio-worker.js');

  defaultWorkerManager.registerWorker('image', imageWorkerPath);
  defaultWorkerManager.registerWorker('audio', audioWorkerPath);

  const imageReady = await defaultWorkerManager.initializeWorker('image');
  const audioReady = await defaultWorkerManager.initializeWorker('audio');

  return imageReady && audioReady;
}

export async function shutdownDefaultWorkers(): Promise<void> {
  await defaultWorkerManager.terminateAll();
} 