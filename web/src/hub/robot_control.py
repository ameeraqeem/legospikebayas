# SPIKE ROBOT CONTROL — program hub (Pybricks firmware, SPIKE Prime)
# Pasang SEKALI melalui https://code.pybricks.com  (tampal kod ini → Run).
# Selepas itu app di iPhone/iPad akan memulakan program ini sendiri.
#
# Protokol (teks, satu baris setiap arahan, diakhiri "\n"):
#   App → hub (stdin)
#     D <kiri> <kanan>        kuasa motor -100..100 (dc %)
#     S                       berhenti
#     M <L> <R> <iL> <iR> <C> konfigurasi: port motor kiri/kanan (A-F),
#                             terbalikkan arah (0/1), port sensor warna (A-F)
#     P                       ping → balas "P ..."
#     X                       tamatkan program
#   Hub → app (stdout)
#     SPIKECTL 1              program bermula
#     C <warna>               warna stabil berubah: red blue green yellow white none
#     B <mV>                  voltan bateri (setiap 2 s)
#     M ok <L> <R> <C>        konfigurasi diterima
#     E <mesej>               ralat (cth. "E motor E", "E sensor C")
#     W                       watchdog: motor dihentikan (tiada arahan > 600 ms)
#
# Keselamatan: motor berhenti sendiri jika app tidak menghantar arahan
# selama 600 ms (cth. iPhone terputus / skrin dikunci).

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor
from pybricks.parameters import Port, Direction, Color
from pybricks.tools import wait, StopWatch
from usys import stdin, stdout
from uselect import poll

PORTS = {"A": Port.A, "B": Port.B, "C": Port.C, "D": Port.D, "E": Port.E, "F": Port.F}
COLORS = ((Color.RED, "red"), (Color.BLUE, "blue"), (Color.GREEN, "green"),
          (Color.YELLOW, "yellow"), (Color.WHITE, "white"))
LIGHT = {"red": Color.RED, "blue": Color.BLUE, "green": Color.GREEN, "yellow": Color.YELLOW}

WATCHDOG_MS = 600
STABLE_READS = 3        # bacaan sama berturut-turut sebelum warna dikira
COLOR_EVERY_MS = 40
BATTERY_EVERY_MS = 2000

hub = PrimeHub()
cfg = {"L": "E", "R": "F", "iL": 1, "iR": 0, "C": "C"}
left = None
right = None
sensor = None


def out(text):
    stdout.buffer.write((text + "\n").encode())


def clamp(v):
    return -100 if v < -100 else (100 if v > 100 else v)


def stop_motors():
    for m in (left, right):
        if m is not None:
            m.stop()


def setup():
    global left, right, sensor
    stop_motors()
    left = right = sensor = None
    if len({cfg["L"], cfg["R"], cfg["C"]}) < 3:
        out("E port bertindih")
        return
    try:
        left = Motor(PORTS[cfg["L"]], Direction.COUNTERCLOCKWISE if cfg["iL"] else Direction.CLOCKWISE)
    except OSError:
        out("E motor " + cfg["L"])
    try:
        right = Motor(PORTS[cfg["R"]], Direction.COUNTERCLOCKWISE if cfg["iR"] else Direction.CLOCKWISE)
    except OSError:
        out("E motor " + cfg["R"])
    try:
        sensor = ColorSensor(PORTS[cfg["C"]])
    except OSError:
        out("E sensor " + cfg["C"])


def color_name():
    if sensor is None:
        return None
    try:
        c = sensor.color()
    except OSError:
        return None
    for value, name in COLORS:
        if c == value:
            return name
    return "none"


def handle(line, state):
    parts = line.split()
    if not parts:
        return True
    cmd = parts[0]
    if cmd == "D" and len(parts) == 3:
        try:
            l = clamp(int(parts[1]))
            r = clamp(int(parts[2]))
        except ValueError:
            out("E arahan " + line)
            return True
        if left is not None:
            left.dc(l)
        if right is not None:
            right.dc(r)
        state["moving"] = l != 0 or r != 0
        state["last"] = state["clock"].time()
    elif cmd == "S":
        stop_motors()
        state["moving"] = False
    elif cmd == "M" and len(parts) == 6:
        L, R, iL, iR, C = parts[1], parts[2], parts[3], parts[4], parts[5]
        if L in PORTS and R in PORTS and C in PORTS:
            cfg["L"], cfg["R"], cfg["C"] = L, R, C
            cfg["iL"], cfg["iR"] = 1 if iL == "1" else 0, 1 if iR == "1" else 0
            setup()
            state["moving"] = False
            state["color"] = None
            out("M ok " + L + " " + R + " " + C)
        else:
            out("E port " + line)
    elif cmd == "P":
        out("P " + cfg["L"] + cfg["R"] + cfg["C"])
    elif cmd == "X":
        return False
    else:
        out("E arahan " + line)
    return True


def run():
    setup()
    hub.light.on(Color.GREEN)
    out("SPIKECTL 1")

    keyboard = poll()
    keyboard.register(stdin)
    clock = StopWatch()
    state = {"moving": False, "last": 0, "clock": clock, "color": None}
    buf = b""
    candidate = None
    count = 0
    next_color = 0
    next_battery = 0

    while True:
        # 1) arahan dari app
        while keyboard.poll(0):
            ch = stdin.buffer.read(1)
            if not ch:
                break
            if ch == b"\n":
                line = buf.decode().strip()
                buf = b""
                if not handle(line, state):
                    stop_motors()
                    return
            elif len(buf) < 64:
                buf += ch

        now = clock.time()

        # 2) watchdog keselamatan
        if state["moving"] and now - state["last"] > WATCHDOG_MS:
            stop_motors()
            state["moving"] = False
            out("W")

        # 3) sensor warna (dengan penapis kestabilan)
        if now >= next_color:
            next_color = now + COLOR_EVERY_MS
            name = color_name()
            if name is not None:
                if name == candidate:
                    count += 1
                else:
                    candidate = name
                    count = 1
                if count == STABLE_READS and name != state["color"]:
                    state["color"] = name
                    out("C " + name)
                    hub.light.on(LIGHT.get(name, Color.GREEN))

        # 4) bateri
        if now >= next_battery:
            next_battery = now + BATTERY_EVERY_MS
            out("B " + str(hub.battery.voltage()))

        wait(5)


run()
