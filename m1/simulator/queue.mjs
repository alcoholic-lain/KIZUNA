import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class DeliveryQueue {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ticks (
        instant INTEGER PRIMARY KEY,
        payload TEXT NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS pending_ticks ON ticks(instant) WHERE delivered = 0;
    `);
    this.insert = this.db.prepare('INSERT INTO ticks (instant, payload) VALUES (?, ?)');
    this.newest = this.db.prepare('SELECT instant, payload FROM ticks ORDER BY instant DESC LIMIT 1');
    this.pending = this.db.prepare('SELECT instant, payload FROM ticks WHERE delivered = 0 ORDER BY instant LIMIT 20');
    this.size = this.db.prepare('SELECT COUNT(*) AS ticks FROM ticks WHERE delivered = 0');
    this.mark = this.db.prepare('UPDATE ticks SET delivered = 1 WHERE delivered = 0 AND instant <= ?');
    this.prune = this.db.prepare('DELETE FROM ticks WHERE delivered = 1 AND instant < (SELECT MAX(instant) FROM ticks)');
  }

  append(instant, readings) {
    this.insert.run(instant, JSON.stringify(readings));
  }

  acknowledge(instant) {
    this.db.exec('BEGIN');
    try {
      this.mark.run(instant);
      this.prune.run();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
