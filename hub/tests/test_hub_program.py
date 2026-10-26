"""Runs the real hub program in CPython against stub pybricks/usys/uselect modules."""
import io, sys, types, pathlib

PROG = pathlib.Path(__file__).resolve().parents[2] / "web" / "src" / "hub" / "robot_control.py"


class Clock:
    t = 0


def run_prog(stdin_text, devices=None, colors=(), limit_ms=60000, distances=(), presses=(), hsv=((330, 40, 85),)):
    """devices: {'A': 'motor', 'C': 'color', ...}. Returns (log, output lines)."""
    devices = devices if devices is not None else {"E": "motor", "F": "motor", "C": "color"}
    Clock.t = 0
    log = {"dc": [], "stop": 0, "dirs": {}, "target": [], "reset": []}
    color_seq = list(colors)
    hsv_seq = list(hsv)
    outbuf = []

    class Port:
        A, B, C, D, E, F = "A", "B", "C", "D", "E", "F"

    class Direction:
        CLOCKWISE, COUNTERCLOCKWISE = "cw", "ccw"

    class Stop:
        HOLD = "hold"

    class Color:
        def __init__(self, h=0, s=100, v=100):
            self.h, self.s, self.v = h, s, v
        def __eq__(self, o):
            return isinstance(o, Color) and (o.h, o.s, o.v) == (self.h, self.s, self.v)
        def __repr__(self):
            return "Color(%d,%d,%d)" % (self.h, self.s, self.v)
        RED, BLUE, GREEN, YELLOW, WHITE, NONE = "R", "Bl", "G", "Y", "W", "N"
        ORANGE, CYAN, VIOLET, MAGENTA, BLACK = "O", "Cy", "V", "Mg", "K"

    class Motor:
        def __init__(self, port, direction="cw"):
            log.setdefault("opens", {})
            log["opens"][port] = log["opens"].get(port, 0) + 1
            if devices.get(port) == "busy-motor":
                if busy["left"] > 0:
                    busy["left"] -= 1
                    raise OSError(16)  # EBUSY
            elif devices.get(port) != "motor":
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
            log.setdefault("detect_hist", []).append(list(cols))
            self.cols = list(cols)
        def color(self):
            c = color_seq.pop(0) if color_seq else Color.NONE
            return self.cols[7] if c == "TAUGHT" else c
        def hsv(self):
            h, s_, v = hsv_seq.pop(0) if len(hsv_seq) > 1 else hsv_seq[0]
            return Color(h, s_, v)

    class Light:
        def on(self, c): pass

    IDS = {"motor": 48, "busy-motor": 48, "color": 61, "ultra": 62, "force": 63}

    flaky = {"left": 1}
    busy = {"left": 2}

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
    assert lines[0] == "SPIKECTL 8"
    assert lines[1:8] == ["Q A motor 48", "Q B motor 48", "Q C color 61", "Q D motor 48", "Q E none -", "Q F none -", "Q end"]


def test_two_motors_per_side_and_accessory():
    devs = {"A": "motor", "B": "motor", "C": "motor", "D": "motor", "E": "motor", "F": "color"}
    log, lines = run_prog("M LLRRXC 110000\nD 40 -20\nA 70\nX\n", devices=devs)
    assert "M ok LLRRXC 110000" in lines
    # A and B are inverted in software
    assert {("A", -40), ("B", -40), ("C", -20), ("D", -20), ("E", 70)} <= set(log["dc"])


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
    assert {("A", -40), ("B", -40), ("C", -60)} <= set(log["dc"])


def test_busy_motor_is_retried_not_reported():
    log, lines = run_prog("M LNNNNN 000000\nD 40 0\nX\n", devices={"A": "busy-motor"})
    assert not any(l.startswith("E ") for l in lines), lines
    assert ("A", 40) in log["dc"]


def test_same_config_reuses_open_motor():
    log, lines = run_prog("M LRNNNN 000000\nM LRNNNN 000000\nJ A\nX\n", devices={"A": "motor", "B": "motor"})
    assert log["opens"]["A"] == 1 and "J A ok" in lines


def test_inverting_does_not_reopen_motor():
    log, _ = run_prog("M LNNNNN 000000\nD 40 0\nM LNNNNN 100000\nD 40 0\nX\n", devices={"A": "motor"})
    assert log["opens"]["A"] == 1
    assert ("A", 40) in log["dc"] and ("A", -40) in log["dc"]


def test_rapid_manual_edits_keep_working():
    devs = {"A": "busy-motor", "B": "motor", "C": "motor"}
    cmds = "M LRXNNN 100000\nM LRXNNN 000000\nM LRXNNN 010000\nM RLXNNN 010000\nM RLXNNN 010000\nD 50 20\nX\n"
    log, lines = run_prog(cmds, devices=devs)
    assert not any(l.startswith("E ") for l in lines), lines
    # A: two busy attempts + one success; nothing is opened twice afterwards
    assert log["opens"]["A"] == 3 and log["opens"]["B"] == 1 and log["opens"]["C"] == 1, log["opens"]
    # A is now the right wheel (normal), B the left wheel (inverted)
    assert ("A", 20) in log["dc"] and ("B", -50) in log["dc"]


def test_measure_colour_under_sensor():
    _, lines = run_prog("M NNCNLR 000000\nH\nX\n", hsv=[(335, 40, 80), (337, 42, 82), (333, 38, 84), (335, 40, 80), (335, 40, 84)])
    assert "H 335 40 82" in lines


def test_measure_red_wraps_around_zero():
    _, lines = run_prog("M NNCNLR 000000\nH\nX\n", hsv=[(358, 90, 70), (2, 90, 70), (358, 90, 70), (2, 90, 70), (0, 90, 70)])
    h = int([l for l in lines if l.startswith("H ")][0].split()[1])
    assert h >= 355 or h <= 5, h


def test_measure_without_sensor():
    _, lines = run_prog("H\nX\n")
    assert "H nosensor" in lines


def test_teach_colour_replaces_lego_default_and_reset():
    log, lines = run_prog("M NNCNLR 000000\nT magenta 335 40 82\nT reset\nT pink 1 2 3\nX\n")
    assert "T ok magenta" in lines and "T ok reset" in lines and "E arahan" in lines
    hist = log["detect_hist"]
    assert any(repr(c) == "Color(335,40,82)" for c in hist[-2])   # taught
    assert "Mg" in hist[-1]                                       # back to LEGO magenta


def test_taught_colour_is_reported_by_name():
    pink = (335, 40, 82)
    taught = []
    def colors():
        return taught
    log, lines = run_prog("M NNCNLR 000000\nT magenta 335 40 82\nK\nX\n", colors=["TAUGHT"] * 5)
    assert "K magenta" in lines
