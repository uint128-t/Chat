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

usrroom = {}
roomnames = defaultdict(dict) # room name -> users (sid -> name)

@sock.on("smessage")
def msg(o):
    content = o['message']
    user = o['user']
    room = o["room"]
    print(f"{user} ({flask.request.sid}) in {room}:")
    print("\x1b[2m",end=content)
    print("\x1b[0m")
    emit("message",kw(user=user,content=content,room=room),broadcast=True,include_self=True,room=room)

@sock.on("disconnect")
def disconnect():
    del roomnames[usrroom[flask.request.sid]][flask.request.sid]
    emit("user",list(roomnames[usrroom[flask.request.sid]].values()),room=usrroom[flask.request.sid],broadcast=True,include_self=True)
    if len(roomnames[usrroom[flask.request.sid]]) == 0:
        del roomnames[usrroom[flask.request.sid]]
    del usrroom[flask.request.sid]

@app.route("/")
def root():
    return flask.send_file("index.html")

@app.route("/<file>")
def file(file):
    return flask.send_from_directory(".",file)

@sock.on("name")
def name(nname):
    roomnames[usrroom[flask.request.sid]][flask.request.sid] = nname
    emit("user",list(roomnames[usrroom[flask.request.sid]].values()),room=usrroom[flask.request.sid],broadcast=True,include_self=True) # update

@sock.on("room")
def room(o):
    r = o["room"]
    print(f"{r}")
    if flask.request.sid in usrroom:
        del roomnames[usrroom[flask.request.sid]][flask.request.sid]
        emit("user",list(roomnames[usrroom[flask.request.sid]].values()),room=usrroom[flask.request.sid],broadcast=True,include_self=True) # leave previous
        if len(roomnames[usrroom[flask.request.sid]]) == 0:
            del roomnames[usrroom[flask.request.sid]]
        leave_room(usrroom[flask.request.sid])
    join_room(r)
    roomnames[r][flask.request.sid] = o["name"]
    usrroom[flask.request.sid] = r
    emit("user",list(roomnames[usrroom[flask.request.sid]].values()),room=usrroom[flask.request.sid],broadcast=True,include_self=True) # join new

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
