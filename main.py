import flask
from flask_socketio import SocketIO,emit, join_room, leave_room
from collections import defaultdict
import eventlet
import eventlet.wsgi
import ssl

app = flask.Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
sock = SocketIO(app)

HTTPS = False
if HTTPS:
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
    context.load_cert_chain('cert.pem', 'key.pem')

def kw(**kw):
    return kw

usrroom = {} # sid -> room
usrname = {} # sid -> name

@sock.on("smessage")
def msg(o):
    content = o['message']
    user = o['user']
    img = []
    if 'images' in o:
        img = o['images']
    print(f"{user} ({flask.request.sid}) in {usrroom[flask.request.sid]}:")
    print("\x1b[2m",end=content)
    print("\x1b[0m")
    emit("message",kw(user=user,content=content,images=img),broadcast=True,include_self=True,room=usrroom[flask.request.sid])

def namesinroom(room)->list:
    return list(map(usrname.__getitem__,filter(lambda x:usrroom[x] == room,usrroom)))

@sock.on("disconnect")
def disconnect():
    emit("message",kw(user="SYSTEM",content=f"**{usrname[flask.request.sid]}** disconnected.",images=[],room=usrroom[flask.request.sid]),broadcast=True,room=usrroom[flask.request.sid])
    curroom = list(filter(lambda x:usrroom[x] == usrroom[flask.request.sid],usrroom))
    emit("user",curroom,room=usrroom[flask.request.sid],broadcast=True,include_self=True)
    del usrname[flask.request.sid]
    del usrroom[flask.request.sid]

@app.route("/")
def root():
    return flask.send_file("index.html")

@app.route("/<file>")
def file(file):
    return flask.send_from_directory(".",file)

@sock.on("name")
def name(nname):
    usrname[flask.request.sid] = nname
    emit("user",namesinroom(usrroom[flask.request.sid]),room=usrroom[flask.request.sid],broadcast=True,include_self=True) # update
    print(usrname)

@sock.on("init")
def init(name):
    usrname[flask.request.sid] = name
    usrroom[flask.request.sid] = "main"
    join_room("main")
    emit("user",namesinroom(usrroom[flask.request.sid]),room=usrroom[flask.request.sid],broadcast=True,include_self=True)

@sock.on("room")
def room(o):
    r = o["room"]

    oldroom = usrroom[flask.request.sid]
    usrroom[flask.request.sid] = r
    emit("user",namesinroom(oldroom),room=oldroom,broadcast=True,include_self=True)
    leave_room(oldroom)
    join_room(r)
    emit("user",namesinroom(usrroom[flask.request.sid]),room=usrroom[flask.request.sid],broadcast=True,include_self=True)
    print(usrroom)

@app.after_request
def add_header(r): # best source of confusion
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r    

print("run")
if HTTPS:
    listener = eventlet.wrap_ssl(eventlet.listen(('0.0.0.0', 443)),certfile='cert.pem',keyfile='key.pem',server_side=True)
    eventlet.wsgi.server(listener, app)
else:
    sock.run(app,host="0.0.0.0",port=80)
