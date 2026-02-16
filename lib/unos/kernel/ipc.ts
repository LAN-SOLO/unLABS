// _unOS Kernel — IPC Manager (Signals, Pipes, Shared Memory, Message Queues)

import type { Pipe, SharedMemorySegment, MessageQueue } from './types'
import type { ProcessManager } from './process'

export class IPCManager {
  private pipes = new Map<number, Pipe>()
  private sharedMemory = new Map<number, SharedMemorySegment>()
  private messageQueues = new Map<number, MessageQueue>()
  private nextId = 1
  private processManager: ProcessManager | null = null

  init(processManager: ProcessManager) {
    this.processManager = processManager
  }

  // --- Signals ---

  sendSignal(pid: number, signal: number): { success: boolean; message: string } {
    if (!this.processManager) return { success: false, message: 'Kernel not initialized' }
    return this.processManager.kill(pid, signal)
  }

  // --- Pipes ---

  createPipe(readPid: number, writePid: number): number {
    const id = this.nextId++
    this.pipes.set(id, {
      id,
      readEnd: readPid,
      writeEnd: writePid,
      buffer: [],
      capacity: 64,
    })
    return id
  }

  closePipe(id: number): boolean {
    return this.pipes.delete(id)
  }

  getPipes(): Pipe[] {
    return Array.from(this.pipes.values())
  }

  // --- Shared Memory ---

  shmget(key: number, size: number, ownerPid: number): number {
    const id = this.nextId++
    this.sharedMemory.set(id, {
      id,
      key,
      size,
      owner: ownerPid,
      attached: [ownerPid],
    })
    return id
  }

  shmat(id: number, pid: number): boolean {
    const seg = this.sharedMemory.get(id)
    if (!seg) return false
    if (!seg.attached.includes(pid)) {
      seg.attached.push(pid)
    }
    return true
  }

  shmdt(id: number, pid: number): boolean {
    const seg = this.sharedMemory.get(id)
    if (!seg) return false
    seg.attached = seg.attached.filter(p => p !== pid)
    return true
  }

  getSharedMemory(): SharedMemorySegment[] {
    return Array.from(this.sharedMemory.values())
  }

  // --- Message Queues ---

  msgget(key: number, ownerPid: number): number {
    const id = this.nextId++
    this.messageQueues.set(id, {
      id,
      key,
      messages: [],
      owner: ownerPid,
    })
    return id
  }

  msgsnd(id: number, type: number, data: string): boolean {
    const q = this.messageQueues.get(id)
    if (!q) return false
    q.messages.push({ type, data })
    return true
  }

  msgrcv(id: number): { type: number; data: string } | null {
    const q = this.messageQueues.get(id)
    if (!q || q.messages.length === 0) return null
    return q.messages.shift()!
  }

  getMessageQueues(): MessageQueue[] {
    return Array.from(this.messageQueues.values())
  }

  /** Pre-create IPC resources for boot */
  setupBootIPC(crystalEnginePid: number, blockchainSyncPid: number) {
    // Shared memory between crystal-engine and blockchain-sync
    const shmId = this.shmget(0x4352_5354, 4096, crystalEnginePid)
    this.shmat(shmId, blockchainSyncPid)

    // Message queue for inter-daemon communication
    this.msgget(0x554E_4F53, crystalEnginePid)
  }
}
