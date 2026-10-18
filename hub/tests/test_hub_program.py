"""Runs the real hub program in CPython against stub pybricks/usys/uselect modules."""
import io, sys, types, pathlib

PROG = pathlib.Path(__file__).resolve().parents[2] / "web" / "src" / "hub" / "robot_control.py"


class Clock:
    t = 0


def run_prog(stdin_text, devices=None, colors=(), limit_ms=60000, distances=(), presses=()):
    """devices: {'A': 'motor', 'C': 'color', ...}. Returns (log, output lines)."""
    devices = devices if devices is not None else {"E": "motor", "F": "motor", "C": "color"}
    Clock.t = 0
    log = {"dc": [], "stop": 0, "dirs": {}}
    color_seq = list(colors)
    outbuf = []

    class Port:
        A, B, C, D, E, F = "A", "B", "C", "D", "E", "F"

    class Direction:
        CLOCKWISE, COUNTERCLOCKWISE = "cw", "ccw"

    class Color:
        RED, BLUE, GREEN, YELLOW, WHITE, NONE = "R", "Bl", "G", "Y", "W", "N"
        ORANGE, CYAN, VIOLET, MAGENTA, BLACK = "O", "Cy", "V", "Mg", "K"

    class Motor:
        def __init__(self, port, direction="cw"):
            if devices.get(port) != "motor":
                raise OSError(19)
            self.port = port
            log["dirs"][port] = direction
        def dc(self, v): log["dc"].append((self.port, v))
        def stop(self): log["stop"] += 1

    class ColorSensor:
        def __init__(self, port):
            if devices.get(port) != "color":
                raise OSError(19)
        def detectable_colors(self, cols):
            log["detectable"] = list(cols)
        def color(self):
            return color_seq.pop(0) if color_seq else Color.NONE

    class Light:
        def on(self, c): pass

    dist_seq = list(distances)

    class UltrasonicSensor:
        def __init__(self, port):
            if devices.get(port) != "ultra":
                raise OSError(19)
            self.lights = Light()
        def distance(self):
            return dist_seq.pop(0) if len(dist_seq) > 1 else (dist_seq[0] if dist_seq else 2000)

    press_seq = list(presses)

    class ForceSensor:
        def __init__(self, port):
            if devices.get(port) != "force":
                raise OSError(19)
        def pressed(self):
            return press_seq.pop(0) if len(press_seq) > 1 else (press_seq[0] if press_seq else False)
        def force(self):
            return 5.0 if (press_seq[0] if press_seq else False) else 0.0

    class Battery:
        def voltage(self): return 8123

    class PrimeHub:
        def __init__(self): self.light, self.battery = Light(), Battery()

    class StopWatch:
        def time(self): return Clock.t

    def wait(ms):
        Clock.t += ms
        if Clock.t > limit_ms:
            raise SystemExit("timeout")

    data = io.StringIO(stdin_text)

    class Poller:
        def register(self, s): pass
        def poll(self, t): return data.tell() < len(stdin_text)

    sys.modules.update({
        "pybricks": types.ModuleType("pybricks"),
        "pybricks.hubs": types.SimpleNamespace(PrimeHub=PrimeHub),
        "pybricks.pupdevices": types.SimpleNamespace(Motor=Motor, ColorSensor=ColorSensor, UltrasonicSensor=UltrasonicSensor, ForceSensor=ForceSensor),
        "pybricks.parameters": types.SimpleNamespace(Port=Port, Direction=Direction, Color=Color),
        "pybricks.tools": types.SimpleNamespace(wait=wait, StopWatch=StopWatch),
        "usys": types.SimpleNamespace(stdin=data),
        "uselect": types.SimpleNamespace(poll=Poller),
    })
    src = PROG.read_text()
    # guard: features missing from Pybricks' size-optimised MicroPython
    for banned in (".encode(", ".decode(", "f\"", "stdout.", ".buffer", ".clear(", "{cfg"):
        assert banned not in src, banned
    try:
        exec(compile(src, str(PROG), "exec"), {"__name__": "__main__", "print": lambda t: outbuf.append(str(t))})
    except SystemExit:
        pass
    return log, outbuf


def test_banner_and_port_scan():
    _, lines = run_prog("X\n", devices={"A": "motor", "B": "motor", "C": "color", "D": "motor"})
    assert lines[0] == "SPIKECTL 4"
    assert lines[1:8] == ["Q A motor", "Q B motor", "Q C color", "Q D motor", "Q E none", "Q F none", "Q end"]


def test_two_motors_per_side_and_accessory():
    devs = {"A": "motor", "B": "motor", "C": "motor", "D": "motor", "E": "motor", "F": "color"}
    log, lines = run_prog("M LLRRXC 110000\nD 40 -20\nA 70\nX\n", devices=devs)
    assert "M ok LLRRXC 110000" in lines
    assert {("A", 40), ("B", 40), ("C", -20), ("D", -20), ("E", 70)} <= set(log["dc"])
    assert log["dirs"]["A"] == "ccw" and log["dirs"]["C"] == "cw"


def test_missing_device_reported():
    _, lines = run_prog("M LRNNNC 000000\nX\n", devices={"A": "motor"})
    assert "E B R" in lines and "E F C" in lines


def test_bad_config_and_commands():
    log, lines = run_prog("M LRZ 0\nD 500 -900\nD x y\nHELLO\nX\n")
    assert lines.count("E arahan") == 3


def test_clamp_with_config():
    log, _ = run_prog("M NNCNLR 000000\nD 500 -900\nX\n")
    assert ("E", 100) in log["dc"] and ("F", -100) in log["dc"]


def test_watchdog_stops_drive_and_accessory():
    _, lines = run_prog("M NNCNLR 000000\nD 40 40\n", limit_ms=3000)
    assert "W" in lines


def test_scan_command_majority():
    R, Bl = "R", "Bl"
    _, lines = run_prog("M NNCNLR 000000\nK\nX\n", colors=[R, Bl, R, R, Bl])
    assert "K red" in lines


def test_scan_without_sensor():
    _, lines = run_prog("K\nX\n")  # roles all N by default
    assert "K nosensor" in lines


def test_continuous_color_reports_only_stable_changes():
    R, Bl, N = "R", "Bl", "N"
    _, lines = run_prog("M NNCNLR 000000\n", colors=[R, R, Bl, Bl, Bl, Bl, N, N, N], limit_ms=3000)
    assert [l for l in lines if l.startswith("C ")] == ["C blue", "C none"]
    assert "B 8123" in lines


def test_detects_ultrasonic_and_force():
    _, lines = run_prog("X\n", devices={"A": "motor", "B": "ultra", "C": "force", "D": "color"})
    assert lines[1:8] == ["Q A motor", "Q B ultra", "Q C force", "Q D color", "Q E none", "Q F none", "Q end"]


def test_obstacle_setting_and_distance_report():
    devs = {"E": "motor", "F": "motor", "B": "ultra"}
    _, lines = run_prog("M NUNNLR 000000\nO 150\n", devices=devs, distances=[80], limit_ms=400)
    assert "O ok 150" in lines and "U 80" in lines


def test_obstacle_stop_while_driving():
    devs = {"E": "motor", "F": "motor", "B": "ultra"}
    # far at first (driving allowed), then the wall comes close → hub stops by itself
    log, lines = run_prog("M NUNNLR 000000\nO 150\nD 50 50\n", devices=devs, distances=[900, 900, 120], limit_ms=500)
    assert ("E", 50) in log["dc"]
    assert "O stop" in lines and "U 120" in lines


def test_force_button_reports_press():
    _, lines = run_prog("M NNFNNN 000000\n", devices={"C": "force"}, presses=[False, False, True, True, True], limit_ms=600)
    assert "F 1 50" in lines


def test_all_spike_colours_enabled_and_named():
    log, lines = run_prog("M NNCNLR 000000\nK\nX\n", colors=["Cy", "Cy", "Cy", "Cy", "Cy"])
    assert log["detectable"] == ["R", "O", "Y", "G", "Cy", "Bl", "V", "Mg", "W", "K", "N"]
    assert "K azure" in lines
