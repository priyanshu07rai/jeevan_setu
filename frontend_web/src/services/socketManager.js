import { io } from 'socket.io-client';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://jeevansetu-api.onrender.com/api/v2';
const SOCKET_URL = apiBase.split('/api')[0];

class SocketManager {
  constructor() {
    this.sockets = new Map();
  }

  getSocket(namespace = '/') {
    const nsp = namespace === '/' ? '' : namespace;
    // Connect explicitly to the ROOT url, but specify the namespace in the path suffix
    const url = `${SOCKET_URL}${nsp}`;

    if (!this.sockets.has(namespace)) {
      const socket = io(url, {
        path: '/socket.io', // FORCE socket.io path so the proxy doesnt 404 /admin/socket.io/
        transports: ['websocket', 'polling'], // Prefer websocket
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: false, // Let React components manage connection lifecycle
        forceNew: false // Use single multiplexed connection over underlying engine
      });

      socket.on('connect', () => {
        console.log(`[SocketManager] Connected to ${namespace || 'Global'} (ID: ${socket.id})`);
      });

      socket.on('connect_error', (err) => {
        console.error(`[SocketManager] Connection error on ${namespace || 'Global'}:`, err.message);
      });

      socket.on('disconnect', (reason) => {
        console.warn(`[SocketManager] Disconnected from ${namespace || 'Global'} (Reason: ${reason})`);
      });

      this.sockets.set(namespace, socket);
    }

    return this.sockets.get(namespace);
  }

  // Cleanup a specific socket instance if absolutely needed, though preserving singleton is preferred
  destroySocket(namespace = '/') {
    if (this.sockets.has(namespace)) {
      const s = this.sockets.get(namespace);
      s.disconnect();
      this.sockets.delete(namespace);
    }
  }
}

export const socketManager = new SocketManager();
export default socketManager;
