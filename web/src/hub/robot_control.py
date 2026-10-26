# ROBOT SPIKE — program hub (Pybricks firmware, SPIKE Prime)  versi 8
# Copyright (c) 2026 ameermustaqeem. Hak cipta terpelihara.
# Pasang SEKALI melalui https://code.pybricks.com  (tampal kod ini, tekan Run).
# Selepas itu app di iPhone/iPad memulakan program ini sendiri.
#
# Arahan dari app (satu baris setiap arahan):
#   Q                    kesan semua port -> "Q A motor 48" ... "Q end"
#                        (nombor = ID peranti LEGO, untuk semakan)
#                        jenis: motor, color, ultra (jarak), force (tekan), none
#   M <peranan> <balik>  6 aksara setiap satu, port A hingga F
#                        peranan: L roda/kaki kiri, R roda/kaki kanan,
#                                 S motor stereng (kereta), X aksesori/tangan,
#                                 C sensor warna, U sensor jarak,
#                                 F sensor tekan, N tiada
#                        balik:   1 = terbalikkan arah motor, 0 = biasa
#                        contoh:  M LRCUFX 100000
#   O <mm>               berhenti automatik jika halangan lebih dekat (0 = mati)
#   D <kiri> <kanan> [stereng]
#                        kuasa roda -100..100; stereng -100..100 (kiri..kanan)
#   G <darjah>           sudut stereng maksimum (lalai 35)
#   J <port>             uji motor: pusing sekejap ke depan dan ke belakang
#   A <kuasa>            kuasa motor aksesori -100..100
#   S                    berhenti semua motor
#   K                    imbas warna sekarang -> "K red" / "K none" / "K nosensor"
#                        warna: red orange yellow green azure blue violet
#                               magenta white black none
#   H                    ukur warna di bawah sensor -> "H <hue> <sat> <val>"
#   T <warna> <h> <s> <v> ajar warna (contoh: T magenta 335 40 85)
#   T reset              kembali ke warna asal LEGO
#   P                    ping -> "P 8"
#   X                    tamatkan program
# Mesej ke app: SPIKECTL 8, Q ..., M ok, C <warna> (bila berubah),
#               U <mm> (jarak, 2000 = tiada objek), F <tekan 0/1> <daya x10>,
#               O stop (berhenti kerana halangan), B <mV> (bateri),
#               E <port> <peranan> (ralat), W (watchdog)
#
# Keselamatan: semua motor berhenti sendiri jika app senyap lebih 600 ms.
# Nota: hanya ciri asas MicroPython digunakan (print, stdin.read) kerana
# firmware Pybricks tiada str.encode / bytes.decode.

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Port, Direction, Color, Stop
from pybricks.tools import wait, StopWatch
from pybricks.iodevices import PUPDevice
try:
    from usys import stdin
except ImportError:  # newer Pybricks firmware
    from sys import stdin
try:
    from uerrno import ENODEV
except ImportError:
    from errno import ENODEV
try:
    from uselect import poll
except ImportError:
    from select import poll
try:
    from gc import collect
except ImportError:
    def collect():
        pass

NAMES = "ABCDEF"
PORTS = (Port.A, Port.B, Port.C, Port.D, Port.E, Port.F)
# Semua warna yang boleh dikenal pasti oleh SPIKE Prime Color Sensor.
# Color.CYAN = "biru muda" (azure) LEGO.
DEFAULT_COLORS = ((Color.RED, "red"), (Color.ORANGE, "orange"), (Color.YELLOW, "yellow"),
                  (Color.GREEN, "green"), (Color.CYAN, "azure"), (Color.BLUE, "blue"),
                  (Color.VIOLET, "violet"), (Color.MAGENTA, "magenta"),
                  (Color.WHITE, "white"), (Color.BLACK, "black"))
# The colours the sensor compares against. The app can replace any of them with the
# colour measured on the real map ("Ajar warna"), because printed colours differ from
# LEGO bricks.
COLORS = [list(pair) for pair in DEFAULT_COLORS]
DETECTABLE = [pair[0] for pair in COLORS] + [Color.NONE]
LIGHT = {"red": Color.RED, "orange": Color.ORANGE, "yellow": Color.YELLOW, "green": Color.GREEN,
         "azure": Color.CYAN, "blue": Color.BLUE, "violet": Color.VIOLET, "magenta": Color.MAGENTA,
         "white": Color.WHITE}

WATCHDOG_MS = 600
STABLE_READS = 3
COLOR_EVERY_MS = 50
DIST_EVERY_MS = 100
FORCE_EVERY_MS = 60
BATTERY_EVERY_MS = 2000

hub = PrimeHub()
roles = "NNNNNN"
inverts = "000000"
lefts = []
rights = []
extras = []
steers = []
steer_deg = 35
steer_target = 0
sensor = None
ultra = None
force = None
obstacle_mm = 0


def out(text):
    print(text)


def clamp(v):
    if v < -100:
        return -100
    if v > 100:
        return 100
    return v


def stop_all():
    for m in lefts:
        m.stop()
    for m in rights:
        m.stop()
    for m in extras:
        m.stop()
    steer_to(0)


def steer_to(t):
    # t = -100..100 -> angle; only send a new target when it really changes
    global steer_target
    a = t * steer_deg // 100
    if a == steer_target:
        return
    steer_target = a
    for m in steers:
        try:
            m.run_target(500, a, Stop.HOLD, False)
        except Exception:
            pass


def stop_wheels():
    for m in lefts:
        m.stop()
    for m in rights:
        m.stop()


# LEGO Powered Up device IDs (Pybricks PUPDevice documentation)
MOTOR_IDS = (38, 46, 47, 48, 49, 65, 75, 76)
KIND_BY_ID = {61: "color", 62: "ultra", 63: "force"}


def device_id(i):
    # read the device ID; a motor that is still waking up may need a moment
    for _ in range(3):
        try:
            return PUPDevice(PORTS[i]).info()["id"]
        except OSError as ex:
            if ex.args and ex.args[0] == ENODEV:
                return None  # nothing plugged in: no need to retry
            wait(150)
        except Exception:
            wait(150)
    return None


def try_open(i):
    # fallback: open the port as each device type in turn (kept open for reuse)
    for kind, name in (("M", "motor"), ("C", "color"), ("U", "ultra"), ("F", "force")):
        try:
            open_dev(kind, i)
            return name
        except Exception:
            pass
    return "none"


def detect(i):
    did = device_id(i)
    if did is None:
        return try_open(i), "-"
    if did in MOTOR_IDS:
        return "motor", str(did)
    if did in KIND_BY_ID:
        return KIND_BY_ID[did], str(did)
    # a device we do not use (or a motor type not in the list): try anyway
    return try_open(i), str(did)


class Flip:
    # a motor that turns the other way, without opening the port a second time
    def __init__(self, m, sign):
        self.m = m
        self.sign = sign

    def dc(self, v):
        self.m.dc(v * self.sign)

    def stop(self):
        self.m.stop()

    def reset_angle(self, a):
        self.m.reset_angle(a * self.sign)

    def run_target(self, speed, a, then, w):
        self.m.run_target(speed, a * self.sign, then, w)


# Each port is opened ONCE and reused: opening a port again while the old
# object still holds it gives "EBUSY" (errno 16) on newer firmware.
opened = {}
failed = 0  # ports that could not be opened at the last setup
EBUSY = 16
EAGAIN = 11


def make(kind, i):
    if kind == "C":
        return ColorSensor(PORTS[i])
    if kind == "U":
        return UltrasonicSensor(PORTS[i])
    if kind == "F":
        return ForceSensor(PORTS[i])
    return Motor(PORTS[i], Direction.CLOCKWISE)


def open_dev(kind, i):
    # reuse what is already open on this port; otherwise open it, retrying while busy
    have = opened.get(i)
    if have is not None and have[0] == kind:
        return have[1]
    last = None
    for _ in range(8):
        try:
            dev = make(kind, i)
            opened[i] = (kind, dev)
            return dev
        except OSError as ex:
            last = ex
            if ex.args and ex.args[0] in (EBUSY, EAGAIN):
                collect()  # free old objects that may still hold the port
                wait(250)  # port still starting up / switching mode
            else:
                raise
    raise last


def setup():
    global lefts, rights, extras, steers, steer_target, sensor, ultra, force, failed
    stop_all()
    if steers:
        wait(300)  # let the steering come back to the centre first
    lefts = []
    rights = []
    extras = []
    steers = []
    steer_target = 0
    sensor = None
    ultra = None
    force = None
    failed = 0
    for i in range(6):
        r = roles[i]
        if r == "N":
            continue
        try:
            if r == "C":
                sensor = open_dev("C", i)
                use_colors()
            elif r == "U":
                ultra = open_dev("U", i)
            elif r == "F":
                force = open_dev("F", i)
            else:
                m = Flip(open_dev("M", i), -1 if inverts[i] == "1" else 1)
                if r == "L":
                    lefts.append(m)
                elif r == "R":
                    rights.append(m)
                elif r == "S":
                    m.reset_angle(0)  # wheels straight = 0
                    steers.append(m)
                else:
                    extras.append(m)
        except Exception as ex:
            failed = failed + 1
            out("E " + NAMES[i] + " " + r + " " + str(ex))


def test_motor(i):
    # spin one motor briefly so pupils can see which port it is on
    stop_all()
    try:
        m = open_dev("M", i)
        m.dc(50)
        wait(350)
        m.dc(-50)
        wait(350)
        m.stop()
        out("J " + NAMES[i] + " ok")
    except Exception as ex:
        out("J " + NAMES[i] + " " + str(ex))
    setup()


def scan_ports():
    global opened
    stop_all()
    opened = {}  # cables may have moved: open everything afresh
    for i in range(6):
        kind, did = detect(i)
        out("Q " + NAMES[i] + " " + kind + " " + did)
    out("Q end")
    wait(300)  # let the ports settle after detection
    setup()  # detection replaced the device objects; rebuild them


def use_colors():
    global DETECTABLE
    DETECTABLE = [pair[0] for pair in COLORS] + [Color.NONE]
    if sensor is not None:
        try:
            sensor.detectable_colors(DETECTABLE)
        except Exception:
            pass


def measure():
    # average of 5 readings; hue is on a circle (359 is next to 0)
    hs = []
    ss = 0
    vs = 0
    for _ in range(5):
        c = sensor.hsv()
        hs.append(c.h)
        ss = ss + c.s
        vs = vs + c.v
        wait(30)
    if max(hs) - min(hs) > 180:
        hs = [h + 360 if h < 180 else h for h in hs]
    h = (sum(hs) // len(hs)) % 360
    return h, ss // 5, vs // 5


def teach(parts):
    # T <name> <h> <s> <v>  |  T reset
    if len(parts) == 2 and parts[1] == "reset":
        for i in range(len(COLORS)):
            COLORS[i][0] = DEFAULT_COLORS[i][0]
        use_colors()
        out("T ok reset")
        return
    if len(parts) != 5:
        out("E arahan")
        return
    try:
        h = int(parts[2]) % 360
        sat = int(parts[3])
        val = int(parts[4])
    except ValueError:
        out("E arahan")
        return
    for pair in COLORS:
        if pair[1] == parts[1]:
            pair[0] = Color(h, sat, val)
            use_colors()
            out("T ok " + parts[1])
            return
    out("E arahan")


def read_color():
    if sensor is None:
        return None
    try:
        c = sensor.color()
    except Exception:
        return None
    for value, name in COLORS:
        if c == value:
            return name
    return "none"


def read_distance():
    if ultra is None:
        return None
    try:
        return ultra.distance()
    except Exception:
        return None


def scan_now():
    if sensor is None:
        out("K nosensor")
        return
    votes = {}
    best = "none"
    for _ in range(5):
        n = read_color()
        if n is not None:
            votes[n] = votes.get(n, 0) + 1
            if votes[n] > votes.get(best, 0):
                best = n
        wait(30)
    out("K " + best)


def valid(text, allowed):
    if len(text) != 6:
        return False
    for ch in text:
        if ch not in allowed:
            return False
    return True


def blocked(state, l, r):
    # forward movement into an obstacle that is too close
    return obstacle_mm > 0 and l + r > 0 and state["dist"] is not None and state["dist"] < obstacle_mm


def handle(line, state):
    global roles, inverts, obstacle_mm, steer_deg
    parts = line.split()
    if not parts:
        return True
    cmd = parts[0]
    now = state["clock"].time()
    if cmd == "D" and (len(parts) == 3 or len(parts) == 4):
        try:
            l = clamp(int(parts[1]))
            r = clamp(int(parts[2]))
            t = clamp(int(parts[3])) if len(parts) == 4 else 0
        except ValueError:
            out("E arahan")
            return True
        steer_to(t)
        if blocked(state, l, r):
            if state["drive"] or not state["warned"]:
                out("O stop")
                state["warned"] = True
            stop_wheels()
            state["drive"] = False
            return True
        state["warned"] = False
        for m in lefts:
            m.dc(l)
        for m in rights:
            m.dc(r)
        state["drive"] = l != 0 or r != 0
        state["fwd"] = l + r > 0
        state["last"] = now
    elif cmd == "A" and len(parts) == 2:
        try:
            p = clamp(int(parts[1]))
        except ValueError:
            out("E arahan")
            return True
        for m in extras:
            m.dc(p)
        state["extra"] = p != 0
        state["last"] = now
    elif cmd == "S":
        stop_all()
        state["drive"] = False
        state["extra"] = False
    elif cmd == "M" and len(parts) == 3:
        if valid(parts[1], "LRSXCUFN") and valid(parts[2], "01"):
            same = parts[1] == roles and parts[2] == inverts
            roles = parts[1]
            inverts = parts[2]
            if not same or failed > 0:
                setup()  # nothing changed and all ports work: keep running as is
            state["drive"] = False
            state["extra"] = False
            state["color"] = None
            state["dist"] = None
            state["sent_dist"] = None
            state["press"] = None
            out("M ok " + roles + " " + inverts)
        else:
            out("E arahan")
    elif cmd == "O" and len(parts) == 2:
        try:
            v = int(parts[1])
        except ValueError:
            out("E arahan")
            return True
        if v < 0:
            v = 0
        obstacle_mm = v
        out("O ok " + str(v))
    elif cmd == "G" and len(parts) == 2:
        try:
            v = int(parts[1])
        except ValueError:
            out("E arahan")
            return True
        if v < 5:
            v = 5
        if v > 120:
            v = 120
        steer_deg = v
        out("G ok " + str(v))
    elif cmd == "J" and len(parts) == 2 and len(parts[1]) == 1 and parts[1] in NAMES:
        test_motor(NAMES.index(parts[1]))
        state["drive"] = False
        state["extra"] = False
    elif cmd == "H":
        if sensor is None:
            out("H nosensor")
        else:
            try:
                h, sat, val = measure()
                out("H " + str(h) + " " + str(sat) + " " + str(val))
            except Exception as ex:
                out("H ralat " + str(ex))
    elif cmd == "T":
        teach(parts)
    elif cmd == "Q":
        scan_ports()
    elif cmd == "K":
        scan_now()
    elif cmd == "P":
        out("P 8")
    elif cmd == "X":
        return False
    else:
        out("E arahan")
    return True


def run():
    hub.light.on(Color.GREEN)
    out("SPIKECTL 8")
    scan_ports()

    keyboard = poll()
    keyboard.register(stdin)
    clock = StopWatch()
    state = {"drive": False, "extra": False, "fwd": False, "last": 0, "clock": clock,
             "color": None, "dist": None, "sent_dist": None, "press": None, "force": 0,
             "warned": False}
    buf = ""
    candidate = None
    count = 0
    next_color = 0
    next_dist = 0
    next_force = 0
    next_battery = 0

    while True:
        while keyboard.poll(0):
            ch = stdin.read(1)
            if not ch:
                break
            if ch == "\n":
                line = buf.strip()
                buf = ""
                if not handle(line, state):
                    stop_all()
                    return
            elif len(buf) < 64:
                buf = buf + ch

        now = clock.time()

        if (state["drive"] or state["extra"]) and now - state["last"] > WATCHDOG_MS:
            stop_all()
            state["drive"] = False
            state["extra"] = False
            out("W")

        # distance + automatic obstacle stop
        if ultra is not None and now >= next_dist:
            next_dist = now + DIST_EVERY_MS
            d = read_distance()
            state["dist"] = d
            if d is not None:
                last = state["sent_dist"]
                if last is None or d - last > 10 or last - d > 10:
                    state["sent_dist"] = d
                    out("U " + str(d))
                if state["drive"] and state["fwd"] and obstacle_mm > 0 and d < obstacle_mm:
                    stop_wheels()
                    state["drive"] = False
                    state["warned"] = True
                    out("O stop")
                try:
                    if obstacle_mm > 0 and d < obstacle_mm:
                        ultra.lights.on(100)
                    else:
                        ultra.lights.on(30)
                except Exception:
                    pass

        # force sensor (button)
        if force is not None and now >= next_force:
            next_force = now + FORCE_EVERY_MS
            try:
                p = 1 if force.pressed() else 0
                f = int(force.force() * 10)
            except Exception:
                p = None
                f = 0
            if p is not None:
                if p != state["press"] or f - state["force"] > 5 or state["force"] - f > 5:
                    state["press"] = p
                    state["force"] = f
                    out("F " + str(p) + " " + str(f))

        # colour sensor (stable changes only)
        if now >= next_color:
            next_color = now + COLOR_EVERY_MS
            name = read_color()
            if name is not None:
                if name == candidate:
                    count = count + 1
                else:
                    candidate = name
                    count = 1
                if count == STABLE_READS and name != state["color"]:
                    state["color"] = name
                    out("C " + name)
                    hub.light.on(LIGHT.get(name, Color.GREEN))

        if now >= next_battery:
            next_battery = now + BATTERY_EVERY_MS
            out("B " + str(hub.battery.voltage()))

        wait(5)


run()
