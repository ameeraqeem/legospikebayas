"""Runs the real hub program in CPython against stub pybricks/usys/uselect modules."""
import io, sys, types, pathlib

PROG = pathlib.Path(__file__).resolve().parents[2] / "web" / "src" / "hub" / "robot_control.py"


class Clock:
    t = 0


def make_env(stdin_bytes, attached=("E", "F", "C"), colors=()):
    log = {"dc": [], "stop": 0, "light": []}
    color_seq = list(colors)

    class Port:
        A, B, C, D, E, F = "A", "B", "C", "D", "E", "F"

    class Direction:
        CLOCKWISE, COUNTERCLOCKWISE = "cw", "ccw"

    class Color:
        RED, BLUE, GREEN, YELLOW, WHITE, NONE = "R", "Bl", "G", "Y", "W", "N"

    class Motor:
        def __init__(self, port, direction):
            if port not in attached:
                raise OSError(19)
            self.port, self.direction = port, direction
        def dc(self, v): log["dc"].append((self.port, v))
        def stop(self): log["stop"] += 1

    class ColorSensor:
        def __init__(self, port):
            if port not in attached:
                raise OSError(19)
        def color(self):
            return color_seq.pop(0) if color_seq else Color.NONE

    class Light:
        def on(self, c): log["light"].append(c)

    class Battery:
        def voltage(self): return 8123

    class PrimeHub:
        def __init__(self): self.light, self.battery = Light(), Battery()

    class StopWatch:
        def time(self): return Clock.t

    def wait(ms):
        Clock.t += ms
        if Clock.t > 60000:
            raise SystemExit("timeout")

    data = io.BytesIO(stdin_bytes)
    stdout = types.SimpleNamespace(buffer=io.BytesIO())
    stdin = types.SimpleNamespace(buffer=data)

    class Poller:
        def register(self, s): pass
        def poll(self, t): return data.tell() < len(stdin_bytes)

    mods = {
        "pybricks": types.ModuleType("pybricks"),
        "pybricks.hubs": types.SimpleNamespace(PrimeHub=PrimeHub),
        "pybricks.pupdevices": types.SimpleNamespace(Motor=Motor, ColorSensor=ColorSensor),
        "pybricks.parameters": types.SimpleNamespace(Port=Port, Direction=Direction, Color=Color),
        "pybricks.tools": types.SimpleNamespace(wait=wait, StopWatch=StopWatch),
        "usys": types.SimpleNamespace(stdin=stdin, stdout=stdout),
        "uselect": types.SimpleNamespace(poll=Poller),
    }
    sys.modules.update(mods)
    return log, stdout, Color


def run_prog(stdin_bytes, **kw):
    Clock.t = 0
    log, stdout, Color = make_env(stdin_bytes, **kw)
    code = compile(PROG.read_text(), str(PROG), "exec")
    exec(code, {"__name__": "__main__"})
    return log, stdout.buffer.getvalue().decode().splitlines()


def test_banner_drive_and_exit():
    log, lines = run_prog(b"D 50 -30\nS\nP\nX\n")
    assert lines[0] == "SPIKECTL 1"
    assert ("E", 50) in log["dc"] and ("F", -30) in log["dc"]
    assert "P EFC" in lines
    assert log["stop"] >= 2


def test_clamp_and_bad_command():
    log, lines = run_prog(b"D 500 -900\nD x y\nHELLO\nX\n")
    assert ("E", 100) in log["dc"] and ("F", -100) in log["dc"]
    assert "E arahan D x y" in lines and "E arahan HELLO" in lines


def test_watchdog_stops_motors_without_keepalive():
    # program never receives X: runs until stub wait() times out → SystemExit
    try:
        run_prog(b"D 40 40\n")
    except SystemExit:
        pass
    out = sys.modules["usys"].stdout.buffer.getvalue().decode().splitlines()
    assert "W" in out


def test_reconfigure_ports_and_missing_devices():
    log, lines = run_prog(b"M A B 0 1 D\nX\n", attached=("E", "F", "C", "A"))
    assert "M ok A B D" in lines
    assert "E motor B" in lines and "E sensor D" in lines


def test_overlapping_ports_rejected():
    log, lines = run_prog(b"M A A 0 0 C\nX\n", attached=("A", "C", "E", "F"))
    assert "E port bertindih" in lines


def test_color_stability_and_changes():
    # 2 reds (unstable) then 3 blues → only blue reported; then none
    R, Bl, N = "R", "Bl", "N"
    try:
        run_prog(b"", colors=[R, R, Bl, Bl, Bl, Bl, N, N, N])
    except SystemExit:
        pass
    out = sys.modules["usys"].stdout.buffer.getvalue().decode().splitlines()
    cs = [l for l in out if l.startswith("C ")]
    assert cs == ["C blue", "C none"]
    assert any(l.startswith("B 8123") for l in out)
