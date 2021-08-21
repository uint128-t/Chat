import flask
from flask_cors import CORS
from flask_socketio import SocketIO,send,emit, join_room, leave_room
import replit
import os
import hashlib # HASH PASSWORDS! 

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
    pswd = o['pswd']
    room = o["room"]
    if _auth(user,pswd)["verified"]:
        print(f"Message {content} by {user} from {room}")
        emit("message",kw(user=user,content=content,room=room),broadcast=True,include_self=True,room=room)

@app.route("/")
def root():
    return flask.send_file("main.html")

@app.route("/<file>")
def file(file):
    if os.path.exists(file):
        return flask.send_file(file)
    else:
        flask.abort(404)

def _auth(username,password):
    if username and password:
            hash = hashlib.md5(password.encode()).hexdigest()
            usac = replit.db.get("USR_"+username)
            if usac:
                if usac["password"] == hash:
                    return {"verified":True,"message":"Authentication Successfull"}
    return {"verified":False,"message":"The username or password is incorrect."}

@app.route("/auth")
def auth():
    username = flask.request.args.get("usr")
    password = flask.request.args.get("pswd")
    return _auth(username,password)
    

@app.route("/mkacc")
def make_acc():
    username = flask.request.args.get("usr")
    password = flask.request.args.get("pswd")
    if username and password:
        if replit.db.get("USR_"+username):
            return {"status":"Failed","message":"An account with that username already exists."}
        hash = hashlib.md5(password.encode()).hexdigest()
        replit.db["USR_"+username] = {"password":hash}
        return {"status":"Success"}
    return {"status":"Failed","message":"Invalid username or password"}


@sock.on("room")
def room(o):
    r = o["room"]
    print(f"{r}")
    join_room(r)

sock.run(app,host="0.0.0.0",port=80)