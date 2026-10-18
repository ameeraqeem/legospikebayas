/*
 * Pybricks BLE client (Web Bluetooth).
 * Protocol: https://github.com/pybricks/technical-info/blob/master/pybricks-ble-profile.md
 *   Command/Event characteristic (write + notify):
 *     commands  0x00 STOP_USER_PROGRAM · 0x01 START_USER_PROGRAM · 0x06 WRITE_STDIN
 *     events    0x00 STATUS_REPORT (uint32 flags) · 0x01 WRITE_STDOUT
 *   Hub capabilities: uint16 max_char_size, uint32 feature flags, uint32 max program size
 */

export const PYBRICKS_SERVICE = 'c5f50001-8280-46da-89f4-6d8051e4aeef';
export const PYBRICKS_COMMAND_EVENT = 'c5f50002-8280-46da-89f4-6d8051e4aeef';
export const PYBRICKS_CAPABILITIES = 'c5f50003-8280-46da-89f4-6d8051e4aeef';
export const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const FW_REVISION = '00002a26-0000-1000-8000-00805f9b34fb';
const SW_REVISION = '00002a28-0000-1000-8000-00805f9b34fb';

const CMD_STOP = 0x00;
const CMD_START = 0x01;
const CMD_STDIN = 0x06;
const EVT_STATUS = 0x00;
const EVT_STDOUT = 0x01;
const FLAG_PROGRAM_RUNNING = 1 << 6;
const FLAG_BATTERY_LOW = 1 << 0;

export type LinkState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface HubInfo {
  name: string;
  firmware: string | null;
  protocol: string | null;
  maxWrite: number;
}

export interface HubListener {
  onState(state: LinkState, error?: string): void;
  onInfo(info: HubInfo): void;
  onStatus(flags: { running: boolean; batteryLow: boolean }): void;
  onLine(line: string): void;
}

export function bluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

const enc = new TextEncoder();

export class PybricksHub {
  private device: BluetoothDevice | null = null;
  private char: BluetoothRemoteGATTCharacteristic | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private pendingDrive: string | null = null;
  private driveQueued = false;
  private decoder = new TextDecoder();
  private lineBuf = '';
  private userDisconnect = false;
  private maxWrite = 20;
  state: LinkState = 'idle';

  constructor(private l: HubListener) {}

  private setState(s: LinkState, err?: string) {
    this.state = s;
    this.l.onState(s, err);
  }

  /** Must be called from a user gesture (tap) — opens the system Bluetooth picker. */
  async requestAndConnect() {
    if (!navigator.bluetooth) throw new Error('Pelayar ini tidak menyokong Bluetooth');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PYBRICKS_SERVICE] }],
      optionalServices: [DEVICE_INFO_SERVICE],
    });
    if (this.device && this.device !== device) this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
    this.device = device;
    device.addEventListener('gattserverdisconnected', this.onDisconnected);
    this.userDisconnect = false;
    await this.open('connecting');
  }

  private async open(phase: 'connecting' | 'reconnecting') {
    const device = this.device;
    if (!device?.gatt) throw new Error('Tiada peranti');
    this.setState(phase);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(PYBRICKS_SERVICE);
    const char = await service.getCharacteristic(PYBRICKS_COMMAND_EVENT);

    // Hub capabilities (protocol ≥ 1.2). Older firmware: assume 20-byte writes.
    try {
      const caps = await (await service.getCharacteristic(PYBRICKS_CAPABILITIES)).readValue();
      this.maxWrite = Math.max(20, caps.getUint16(0, true));
    } catch {
      this.maxWrite = 20;
    }

    let firmware: string | null = null;
    let protocol: string | null = null;
    try {
      const di = await server.getPrimaryService(DEVICE_INFO_SERVICE);
      const dec = new TextDecoder();
      firmware = dec.decode(await (await di.getCharacteristic(FW_REVISION)).readValue()).replace(/\0+$/, '');
      protocol = dec.decode(await (await di.getCharacteristic(SW_REVISION)).readValue()).replace(/\0+$/, '');
    } catch {
      /* optional */
    }

    char.addEventListener('characteristicvaluechanged', this.onNotify);
    await char.startNotifications();
    this.char = char;
    this.lineBuf = '';
    this.chain = Promise.resolve();
    this.l.onInfo({ name: device.name || 'Pybricks Hub', firmware, protocol, maxWrite: this.maxWrite });
    this.setState('connected');
  }

  private onNotify = (e: Event) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (!v || v.byteLength === 0) return;
    const type = v.getUint8(0);
    if (type === EVT_STATUS && v.byteLength >= 5) {
      const flags = v.getUint32(1, true);
      this.l.onStatus({ running: (flags & FLAG_PROGRAM_RUNNING) !== 0, batteryLow: (flags & FLAG_BATTERY_LOW) !== 0 });
    } else if (type === EVT_STDOUT) {
      this.lineBuf += this.decoder.decode(new Uint8Array(v.buffer, v.byteOffset + 1, v.byteLength - 1), { stream: true });
      let i: number;
      while ((i = this.lineBuf.indexOf('\n')) >= 0) {
        const line = this.lineBuf.slice(0, i).replace(/\r$/, '');
        this.lineBuf = this.lineBuf.slice(i + 1);
        if (line) this.l.onLine(line);
      }
      if (this.lineBuf.length > 512) this.lineBuf = '';
    }
  };

  private onDisconnected = () => {
    this.char = null;
    this.pendingDrive = null;
    if (this.userDisconnect) {
      this.setState('disconnected');
      return;
    }
    void this.autoReconnect();
  };

  private async autoReconnect() {
    for (let attempt = 1; attempt <= 5 && !this.userDisconnect; attempt++) {
      try {
        await this.open('reconnecting');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, Math.min(4000, 600 * attempt)));
      }
    }
    if (!this.userDisconnect) this.setState('disconnected', 'Sambungan terputus. Tekan "Sambung semula".');
  }

  async reconnect() {
    if (!this.device) return this.requestAndConnect();
    this.userDisconnect = false;
    try {
      await this.open('reconnecting');
    } catch (e) {
      this.setState('error', errMsg(e));
      throw e;
    }
  }

  disconnect() {
    this.userDisconnect = true;
    this.pendingDrive = null;
    this.device?.gatt?.disconnect();
    this.setState('disconnected');
  }

  get connected() {
    return !!this.char && this.state === 'connected';
  }

  // ---- writes (GATT allows one operation at a time → serialise) ----
  private write(bytes: Uint8Array) {
    const run = async () => {
      const c = this.char;
      if (!c) throw new Error('Tidak bersambung');
      if (c.writeValueWithResponse) await c.writeValueWithResponse(bytes);
      else await c.writeValue(bytes);
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  startProgram() {
    return this.write(new Uint8Array([CMD_START]));
  }

  stopProgram() {
    this.pendingDrive = null;
    return this.write(new Uint8Array([CMD_STOP]));
  }

  /** Send one text line to the running program's stdin. */
  async send(line: string) {
    const data = enc.encode(line.endsWith('\n') ? line : line + '\n');
    const chunk = this.maxWrite - 1;
    for (let i = 0; i < data.length; i += chunk) {
      const part = data.subarray(i, i + chunk);
      const msg = new Uint8Array(part.length + 1);
      msg[0] = CMD_STDIN;
      msg.set(part, 1);
      await this.write(msg);
    }
  }

  /** Latest-wins drive command: never builds a backlog of stale movement. */
  drive(left: number, right: number) {
    this.pendingDrive = `D ${Math.round(left)} ${Math.round(right)}`;
    if (this.driveQueued) return;
    this.driveQueued = true;
    void this.chain.then(async () => {
      this.driveQueued = false;
      const cmd = this.pendingDrive;
      this.pendingDrive = null;
      if (cmd && this.char) await this.send(cmd).catch(() => undefined);
    });
  }

  stop() {
    this.pendingDrive = null;
    return this.send('S').catch(() => undefined);
  }
}

export function errMsg(e: unknown) {
  if (e instanceof DOMException && e.name === 'NotFoundError') return 'Tiada hub dipilih.';
  if (e instanceof DOMException && e.name === 'SecurityError') return 'Bluetooth perlukan sambungan HTTPS.';
  if (e instanceof DOMException && e.name === 'NetworkError') return 'Hub tidak dapat dihubungi. Dekatkan dan cuba lagi.';
  return e instanceof Error ? e.message : String(e);
}
