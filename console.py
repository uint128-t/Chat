import eventlet
import threading
import queue
import readline
import sys
commands = queue.Queue()
cont = queue.Queue()
def console():
    while True:
        try:
            command = input(">> ")
        except EOFError:
            command = "exit"
        commands.put(command)
        cont.get()

threading.Thread(target=console, daemon=True).start()
def processs_commands():
    while True:
        try:
            cmd = commands.get_nowait()
            process_command(cmd)
        except queue.Empty:
            eventlet.sleep(0.1)

cmdp = {}
cmdp["help"]=lambda:print("commands:",*cmdp.keys())
def register_command(name,fn):
    cmdp[name] = fn
def process_command(cmd):
    args = cmd.split()
    if not args: return cont.put(1)
    name = args[0]
    if name not in cmdp:
        print("Command not found")
    else:
        try:
            cmdp[name](*args[1:])
        except Exception as e:
            print("Error executing command:",e)
    cont.put(1)

def log(text):
    print(end="\0337",flush=True)
    print("\r\x1b[2K"+text,flush=True)
    print(">>",readline.get_line_buffer(),end="\0338",flush=True)