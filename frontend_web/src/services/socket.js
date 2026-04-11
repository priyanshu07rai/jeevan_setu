import { socketManager } from './socketManager';

// Forward legacy exports using the new robust socketManager
const socket = socketManager.getSocket('/');
// Explicitly connect the legacy sockets since the new architecture enforces autoConnect: false 
// to prevent memory leaks, but legacy components expect an always-connected stream.
socket.connect();

export const adminSocket = socketManager.getSocket('/admin');
adminSocket.connect();

export default socket;
