import flask
from flask_socketio import SocketIO,emit, join_room, leave_room
from collections import defaultdict
import eventlet
import eventlet.wsgi
import ssl
import sys
import hashlib
from . import console

messagect=0
app = flask.Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
socket = SocketIO(app)
userIDs=set()

HTTPS = False
if HTTPS:
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
    context.load_cert_chain('cert.pem', 'key.pem')

def kw(**kw):
    return kw

usrroom = {} # sid -> room
usrname = {} # sid -> name
useraddr = {}

def system_message(content):
    global messagect
    socket.emit("message",kw(user="SYSTEM",content=content,images=[],id=messagect),room=usrroom[flask.request.sid])
    messagect+=1

def address_hash(addr):
    return hashlib.sha256(addr.encode()).hexdigest()[:8]

@socket.on("smessage")
def msg(o):
    content = o['message']
    user = usrname[flask.request.sid]
    mid = o['id']
    img = []
    address=useraddr[flask.request.sid]
    if 'images' in o:
        img = o['images']
    console.log(f"\x1b[1m{user} ({flask.request.sid}) in {usrroom[flask.request.sid]}:")
    console.log("\x1b[0m"+content)
    emit("message",kw(
        user=user,content=content,
        images=img,userid=flask.request.sid,id=mid,
        address=address_hash(address)
        ),broadcast=True,include_self=True,room=usrroom[flask.request.sid])

def namesinroom(room)->list:
    names = []
    for user,uroom in usrroom.items():
        if room == uroom:
            names.append((usrname[user],user,address_hash(useraddr[user])))
    return names

@socket.on("connect")
def connect():
    if flask.request.remote_addr in bannedIPs:
        console.log(f"\x1b[31mBlocked connection from {flask.request.remote_addr}\x1b[0m")
        socket.server.disconnect(flask.request.sid)

@socket.on("disconnect")
def disconnect():
    if flask.request.sid not in usrname:
        return
    system_message(f"**{usrname.get(flask.request.sid)}** disconnected.")
    console.log(f"\x1b[31mDisconnected {usrname.get(flask.request.sid)} ({flask.request.sid})\x1b[0m")
    cr = usrroom[flask.request.sid]
    del usrname[flask.request.sid]
    del usrroom[flask.request.sid]
    emit("user",namesinroom(cr),room=cr,broadcast=True,include_self=True)
    userIDs.discard(flask.request.sid)
    del useraddr[flask.request.sid]

@app.route("/")
def root():
    if flask.request.remote_addr in bannedIPs:
        console.log(f"\x1b[31mBlocked loading from {flask.request.remote_addr}\x1b[0m")
        return "You are banned."
    return flask.send_file("index.html")

@app.route("/<file>")
def file(file):
    return flask.send_from_directory(".",file)

@socket.on("name")
def name(nname):
    console.log(f"\x1b[34mChange name {flask.request.sid} to {nname} ({usrname[flask.request.sid]})\x1b[0m")
    usrname[flask.request.sid] = nname
    emit("user",namesinroom(usrroom[flask.request.sid]),room=usrroom[flask.request.sid],broadcast=True,include_self=True) # update

@socket.on("init")
def init(name):
    userIDs.add(flask.request.sid)
    usrname[flask.request.sid] = name
    usrroom[flask.request.sid] = "main"
    console.log(f"\x1b[32mConnected {name} ({flask.request.sid}) from {flask.request.remote_addr}\x1b[0m")
    useraddr[flask.request.sid] = flask.request.remote_addr
    join_room("main")
    emit("user",namesinroom(usrroom[flask.request.sid]),room=usrroom[flask.request.sid],broadcast=True,include_self=True)
    system_message(f"**{usrname[flask.request.sid]}** connected.")

@socket.on("room")
def room(o):
    r = o["room"]

    oldroom = usrroom[flask.request.sid]
    usrroom[flask.request.sid] = r
    socket.emit("user",namesinroom(oldroom),room=oldroom)
    system_message(f"**{usrname[flask.request.sid]}** left the room.")
    leave_room(oldroom)
    join_room(r)
    socket.emit("user",namesinroom(r),room=r)
    system_message(f"**{usrname[flask.request.sid]}** entered the room.")


@app.after_request
def add_header(r): # best source of confusion
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r

bannedIPs = set()
def command_kick(pid=""):
    for pidi in userIDs.copy():
        if pidi.startswith(pid):
            print(f"kicked {pidi} ({usrname.get(pidi)})")
            socket.server.disconnect(pidi)
console.register_command("kick",command_kick)
def command_kickname(pid=""):
    for pidi in userIDs.copy():
        if usrname[pidi].startswith(pid):
            print(f"kicked {pidi} ({usrname.get(pidi)})")
            socket.server.disconnect(pidi)
console.register_command("kickname",command_kickname)
def command_say(*args):
    system_message(" ".join(args))
console.register_command("say",command_say)
def command_ban(ip):
    if len(ip.split("."))==4:
        bannedIPs.add("::ffff:"+ip)
    else:
        bannedIPs.add(ip)
    for pidi in userIDs.copy():
        if useraddr[pidi] == ip or useraddr[pidi] == "::ffff:"+ip:
            print(f"banned {pidi} ({usrname.get(pidi)})")
            socket.server.disconnect(pidi)
    print("banned",ip)
console.register_command("ban",command_ban)
def command_unban(ip):
    if ip in bannedIPs or "::ffff:"+ip in bannedIPs:
        print(f"unbanned {ip}")
    else:
        print(f"{ip} is not banned")
    bannedIPs.discard(ip)
    bannedIPs.discard("::ffff:"+ip)
console.register_command("unban",command_unban)
def command_exit():
    sys.exit(0)
console.register_command("exit",command_exit)
def command_list():
    for pid in userIDs:
        print(f"{pid}: {usrname.get(pid)} ({useraddr.get(pid)}), in {usrroom.get(pid)}")
console.register_command("list",command_list)

console.log("run")
socket.start_background_task(console.processs_commands)
if HTTPS:
    listener = eventlet.wrap_ssl(eventlet.listen(('0.0.0.0', 443)),certfile='cert.pem',keyfile='key.pem',server_side=True)
    eventlet.wsgi.server(listener, app)
else:
    socket.run(app,host="::",port=80)
