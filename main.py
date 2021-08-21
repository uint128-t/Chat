import flask
from flask_cors import CORS
from flask_socketio import SocketIO,send,emit, join_room, leave_room

app = flask.Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
sock = SocketIO(app)
CORS(app)

def kw(**kw):
    return kw

@sock.on("smessage")
def msg(o):
    content = o['message']
    user = o['user']
    room = o["room"]
    print(f"Message {content} by {user} from {room}")
    emit("message",kw(user=user,content=content,room=room),broadcast=True,include_self=True,room=room)

@app.route("/")
def root():
    return flask.send_file("main.html")

@app.route("/<file>")
def file(file):
    return flask.send_file(file)

@sock.on("room")
def room(o):
    r = o["room"]
    print(f"{r}")
    join_room(r)

sock.run(app,host="0.0.0.0",port=80)