import * as SQLite from 'expo-sqlite';
import axios from 'axios';

// Initialize the local database
const db = SQLite.openDatabaseSync('disaster_queue.db');

export const initDB = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending_sync',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Offline Database Initialized");
  } catch (error) {
    console.error("DB Init Error:", error);
  }
};

export const queuePacket = (packet) => {
  try {
    const payloadStr = JSON.stringify(packet);
    db.runSync('INSERT INTO sync_queue (payload) VALUES (?)', [payloadStr]);
    console.log("Packet queued locally for later sync");
  } catch (error) {
    console.error("Queue Error:", error);
  }
};

export const getPendingPackets = () => {
  try {
    const rows = db.getAllSync('SELECT * FROM sync_queue WHERE status = ?', ['pending_sync']);
    return rows;
  } catch (error) {
    console.error("Get Pending Error:", error);
    return [];
  }
};

export const markAsSynced = (ids) => {
  try {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    db.runSync(`UPDATE sync_queue SET status = 'synced' WHERE id IN (${placeholders})`, ids);
    console.log(`Marked ${ids.length} packets as synced`);
  } catch (error) {
    console.error("Mark Synced Error:", error);
  }
};

export const syncOfflineData = async (serverUrl) => {
  try {
    const pendingPackets = getPendingPackets();
    if (pendingPackets.length === 0) return;

    console.log(`Attempting to sync ${pendingPackets.length} offline packets to ${serverUrl}/api/v2/mobile/sync`);
    
    const parsedPackets = pendingPackets.map(p => JSON.parse(p.payload));
    
    const response = await axios.post(`${serverUrl}/api/v2/mobile/sync`, { packets: parsedPackets });
    
    if (response.data.status === 'success') {
      const ids = pendingPackets.map(p => p.id);
      markAsSynced(ids);
    }
  } catch (error) {
    console.log("Could not sync right now, device still offline or server unreachable.", error.message);
  }
};
