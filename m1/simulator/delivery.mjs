// POST immutable readings before acknowledging their queue entries. If a reply is
// lost, Django's (adapter, timestamp) constraint makes the replay idempotent.
export class Sender {
  constructor(queue, target) {
    this.queue = queue;
    this.target = target;
    this.headers = {};
    this.lastAck = null;
    this.error = null;
    this.nextAttempt = 0;
    this.failures = 0;
    this.active = false;
  }

  async post(payload) {
    return fetch(this.target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
  }

  async refreshCsrf() {
    const url = new URL(this.target);
    url.pathname = url.pathname.replace(/\/$/, '') + '/csrf';
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('CSRF bootstrap HTTP ' + res.status);
    const { csrfToken } = await res.json();
    const cookie = res.headers.getSetCookie().find(value => value.startsWith('csrftoken='));
    if (!csrfToken || !cookie) throw new Error('Missing Django CSRF credentials');
    this.headers = { Cookie: cookie.split(';')[0], 'X-CSRFToken': csrfToken, Origin: url.origin };
  }

  async sendPacket(payload) {
    let res = await this.post(payload);
    if (res.status === 403) {
      await res.body?.cancel();
      await this.refreshCsrf();
      res = await this.post(payload);
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error('Intake HTTP ' + res.status);
    }
    if ((await res.json()).acquittees !== (Array.isArray(payload) ? payload.length : 1)) throw new Error('Incomplete batch acknowledgement');
  }

  async flush() {
    if (this.active || Date.now() < this.nextAttempt) return;
    this.active = true;
    try {
      for (;;) {
        const ticks = this.queue.pending.all();
        if (!ticks.length) break;
        const rows = ticks.flatMap(tick => JSON.parse(tick.payload));
        // Each live adapter sends its own packet. A recovered backlog uses the
        // receiver's batch format, with at most 100 original measurements.
        const packets = ticks.length === 1 ? rows : [rows];
        for (const payload of packets) await this.sendPacket(payload);
        this.queue.acknowledge(ticks.at(-1).instant);
        this.lastAck = new Date().toISOString();
        this.error = null;
        this.failures = 0;
      }
    } catch (error) {
      this.error = error.message;
      this.failures++;
      this.nextAttempt = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(this.failures - 1, 5));
    } finally {
      this.active = false;
    }
  }
}
