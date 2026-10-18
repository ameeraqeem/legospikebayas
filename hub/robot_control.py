# ROBOT SPIKE — program hub (Pybricks firmware, SPIKE Prime)  versi 4
# Copyright (c) 2026 ameermustaqeem. Hak cipta terpelihara.
# Pasang SEKALI melalui https://code.pybricks.com  (tampal kod ini, tekan Run).
# Selepas itu app di iPhone/iPad memulakan program ini sendiri.
#
# Arahan dari app (satu baris setiap arahan):
#   Q                    kesan semua port -> "Q A motor" ... "Q end"
#                        jenis: motor, color, ultra (jarak), force (tekan), none
#   M <peranan> <balik>  6 aksara setiap satu, port A hingga F
#                        peranan: L roda kiri, R roda kanan, X aksesori,
#                                 C sensor warna, U sensor jarak,
#                                 F sensor tekan, N tiada
#                        balik:   1 = terbalikkan arah motor, 0 = biasa
#                        contoh:  M LRCUFX 100000
#   O <mm>               berhenti automatik jika halangan lebih dekat (0 = mati)
#   D <kiri> <kanan>     kuasa roda -100..100
#   A <kuasa>            kuasa motor aksesori -100..100
#   S                    berhenti semua motor
#   K                    imbas warna sekarang -> "K red" / "K none" / "K nosensor"
#                        warna: red orange yellow green azure blue violet
#                               magenta white black none
#   P                    ping -> "P 4"
#   X                    tamatkan program
# Mesej ke app: SPIKECTL 4, Q ..., M ok, C <warna> (bila berubah),
#               U <mm> (jarak, 2000 = tiada objek), F <tekan 0/1> <daya x10>,
#               O stop (berhenti kerana halangan), B <mV> (bateri),
#               E <port> <peranan> (ralat), W (watchdog)
#
# Keselamatan: semua motor berhenti sendiri jika app senyap lebih 600 ms.
# Nota: hanya ciri asas MicroPython digunakan (print, stdin.read) kerana
# firmware Pybricks tiada str.encode / bytes.decode.

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Port, Direction, Color
from pybricks.tools import wait, StopWatch
from usys import stdin
from uselect import poll

NAMES = "ABCDEF"
PORTS = (Port.A, Port.B, Port.C, Port.D, Port.E, Port.F)
# Semua warna yang boleh dikenal pasti oleh SPIKE Prime Color Sensor.
# Color.CYAN = "biru muda" (azure) LEGO.
COLORS = ((Color.RED, "red"), (Color.ORANGE, "orange"), (Color.YELLOW, "yellow"),
          (Color.GREEN, "green"), (Color.CYAN, "azure"), (Color.BLUE, "blue"),
          (Color.VIOLET, "violet"), (Color.MAGENTA, "magenta"),
          (Color.WHITE, "white"), (Color.BLACK, "black"))
DETECTABLE = [Color.RED, Color.ORANGE, Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE,
              Color.VIOLET, Color.MAGENTA, Color.WHITE, Color.BLACK, Color.NONE]
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


def stop_wheels():
    for m in lefts:
        m.stop()
    for m in rights:
        m.stop()


def detect(i):
    try:
        Motor(PORTS[i])
        return "motor"
    except Exception:
        pass
    try:
        ColorSensor(PORTS[i])
        return "color"
    except Exception:
        pass
    try:
        UltrasonicSensor(PORTS[i])
        return "ultra"
    except Exception:
        pass
    try:
        ForceSensor(PORTS[i])
        return "force"
    except Exception:
        pass
    return "none"


def setup():
    global lefts, rights, extras, sensor, ultra, force
    stop_all()
    lefts = []
    rights = []
    extras = []
    sensor = None
    ultra = None
    force = None
    for i in range(6):
        r = roles[i]
        if r == "N":
            continue
        try:
            if r == "C":
                sensor = ColorSensor(PORTS[i])
                try:
                    sensor.detectable_colors(DETECTABLE)
                except Exception:
                    pass
            elif r == "U":
                ultra = UltrasonicSensor(PORTS[i])
            elif r == "F":
                force = ForceSensor(PORTS[i])
            else:
                if inverts[i] == "1":
                    m = Motor(PORTS[i], Direction.COUNTERCLOCKWISE)
                else:
                    m = Motor(PORTS[i], Direction.CLOCKWISE)
                if r == "L":
                    lefts.append(m)
                elif r == "R":
                    rights.append(m)
                else:
                    extras.append(m)
        except Exception:
            out("E " + NAMES[i] + " " + r)


def scan_ports():
    stop_all()
    for i in range(6):
        out("Q " + NAMES[i] + " " + detect(i))
    out("Q end")
    setup()  # detection replaced the device objects; rebuild them


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
    global roles, inverts, obstacle_mm
    parts = line.split()
    if not parts:
        return True
    cmd = parts[0]
    now = state["clock"].time()
    if cmd == "D" and len(parts) == 3:
        try:
            l = clamp(int(parts[1]))
            r = clamp(int(parts[2]))
        except ValueError:
            out("E arahan")
            return True
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
        if valid(parts[1], "LRXCUFN") and valid(parts[2], "01"):
            roles = parts[1]
            inverts = parts[2]
            setup()
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
    elif cmd == "Q":
        scan_ports()
    elif cmd == "K":
        scan_now()
    elif cmd == "P":
        out("P 4")
    elif cmd == "X":
        return False
    else:
        out("E arahan")
    return True


def run():
    hub.light.on(Color.GREEN)
    out("SPIKECTL 4")
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
