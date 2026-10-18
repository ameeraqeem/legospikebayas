"""Runs the real hub program in CPython against stub pybricks/usys/uselect modules."""
import io, sys, types, pathlib

PROG = pathlib.Path(__file__).resolve().parents[2] / "web" / "src" / "hub" / "robot_control.py"


class Clock:
    t = 0


def run_prog(stdin_text, devices=None, colors=(), limit_ms=60000, distances=(), presses=()):
    """devices: {'A': 'motor', 'C': 'color', ...}. Returns (log, output lines)."""
    devices = devices if devices is not None else {"E": "motor", "F": "motor", "C": "color"}
    Clock.t = 0
    log = {"dc": [], "stop": 0, "dirs": {}, "target": [], "reset": []}
    color_seq = list(colors)
    outbuf = []

    class Port:
        A, B, C, D, E, F = "A", "B", "C", "D", "E", "F"

    class Direction:
        CLOCKWISE, COUNTERCLOCKWISE = "cw", "ccw"

    class Stop:
        HOLD = "hold"

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
        def reset_angle(self, a): log["reset"].append((self.port, a))
        def run_target(self, speed, angle, then, wait):
            assert then == "hold" and wait is False
            log["target"].append((self.port, angle))

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

    IDS = {"motor": 48, "color": 61, "ultra": 62, "force": 63}

    flaky = {"left": 1}

    class PUPDevice:
        def __init__(self, port):
            if port not in devices:
                raise OSError(19)
            if devices[port] == "flaky-motor":
                if flaky["left"] > 0:
                    flaky["left"] -= 1
                    raise OSError(11)  # EAGAIN: motor still starting up
                devices[port] = "motor"
            self.port = port
        def info(self):
            return {"id": IDS.get(devices[self.port], devices[self.port]) if isinstance(devices[self.port], str) else devices[self.port]}

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
        "pybricks.parameters": types.SimpleNamespace(Port=Port, Direction=Direction, Color=Color, Stop=Stop),
        "pybricks.tools": types.SimpleNamespace(wait=wait, StopWatch=StopWatch),
        "pybricks.iodevices": types.SimpleNamespace(PUPDevice=PUPDevice),
        "usys": types.SimpleNamespace(stdin=data),
        "uerrno": types.SimpleNamespace(ENODEV=19),
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
    assert lines[0] == "SPIKECTL 6"
    assert lines[1:8] == ["Q A motor 48", "Q B motor 48", "Q C color 61", "Q D motor 48", "Q E none -", "Q F none -", "Q end"]


def test_two_motors_per_side_and_accessory():
    devs = {"A": "motor", "B": "motor", "C": "motor", "D": "motor", "E": "motor", "F": "color"}
    log, lines = run_prog("M LLRRXC 110000\nD 40 -20\nA 70\nX\n", devices=devs)
    assert "M ok LLRRXC 110000" in lines
    assert {("A", 40), ("B", 40), ("C", -20), ("D", -20), ("E", 70)} <= set(log["dc"])
    assert log["dirs"]["A"] == "ccw" and log["dirs"]["C"] == "cw"


def test_missing_device_reported():
    _, lines = run_prog("M LRNNNC 000000\nX\n", devices={"A": "motor"})
    assert any(l.startswith("E B R") for l in lines) and any(l.startswith("E F C") for l in lines)


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
    assert lines[1:8] == ["Q A motor 48", "Q B ultra 62", "Q C force 63", "Q D color 61", "Q E none -", "Q F none -", "Q end"]


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


def test_technic_motor_ids_detected_as_motor():
    # e.g. Technic Large Angular Motor (76) and Technic L motor (46)
    _, lines = run_prog("X\n", devices={"A": 76, "B": 46})
    assert "Q A motor 76" in lines and "Q B motor 46" in lines


def test_busy_device_is_retried():
    _, lines = run_prog("X\n", devices={"A": "flaky-motor"})
    assert "Q A motor 48" in lines


def test_car_drive_and_steering():
    devs = {"A": "motor", "B": "motor"}
    log, lines = run_prog("M LSNNNN 000000\nG 40\nD 60 60 50\nD 60 60 -100\nD 60 60 -100\nS\nX\n", devices=devs)
    assert "M ok LSNNNN 000000" in lines and "G ok 40" in lines
    assert ("B", 0) in log["reset"]                       # straight wheels = 0 degrees
    assert ("A", 60) in log["dc"] and not any(p == "B" for p, _ in log["dc"])
    assert log["target"] == [("B", 20), ("B", -40), ("B", 0)]  # repeated target not resent; S re-centres


def test_old_two_value_drive_still_works():
    log, _ = run_prog("M NNNNLR 000000\nD 30 30\nX\n")
    assert ("E", 30) in log["dc"] and ("F", 30) in log["dc"]


def test_motor_test_spins_one_port():
    log, lines = run_prog("J B\nJ C\nJ Z\nX\n", devices={"B": "motor"})
    assert ("B", 50) in log["dc"] and ("B", -50) in log["dc"]
    assert "J B ok" in lines
    assert any(l.startswith("J C ") and l != "J C ok" for l in lines)
    assert "E arahan" in lines


def test_humanoid_legs_and_arm():
    devs = {"A": "motor", "B": "motor", "C": "motor"}
    log, _ = run_prog("M LRXNNN 100000\nD 40 -40\nA -60\nX\n", devices=devs)
    assert {("A", 40), ("B", -40), ("C", -60)} <= set(log["dc"])
