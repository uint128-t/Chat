var socket = io();
var ID = document.getElementById.bind(document)
var room = "main"
var reader = new commonmark.Parser();
var writer = new commonmark.HtmlRenderer({ safe: true });
var guestid = ""
var unread = 0
var images = []
ID("dname").value = localStorage.getItem("name")
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

send = () => {
    let n = ID("chatmsg").value.trim()
    let u = ID("dname").value.trim() || guestid
    if (!n && !images.length) {
        return
    }
    if (n == "/clear") {
        ID("chat").innerHTML = "<i>Chat was cleared</i><br><br>"
        ID("chatmsg").value = ""
        updateTextbox()
        return
    }
    if (u == "SYSTEM") {
        ID("chat").appendChild(document.createElement("div")).innerText = "You cannot send messages as SYSTEM"
        ID("chatmsg").value = ""
        updateTextbox()
        return
    }
    if (n.startsWith("/join ")) {
        socket.emit("smessage", { message: `**${u}** left the room.`, user: "SYSTEM"})
        socket.emit('room', { room: n.substring(6), name: u })
        room = n.substring(6)
        ID("room").innerText = room
        socket.emit("smessage", { message: `**${u}** entered the room.`, user: "SYSTEM"})
        ID("chatmsg").value = ""
        updateTextbox()
        return
    }
    socket.emit("smessage", { message: n, user: u, images:images })
    images.length = 0
    updateImageList()
    ID("chatmsg").value = ""
    updateTextbox()
}

socket.on('connect', () => {
    guestid = "Guest " + socket.io.engine.id.substring(0, 5);
    ID("chat").appendChild(document.createElement("div")).innerText = "Connected to server!"
    socket.emit("init", ID("dname").value || guestid)
    socket.emit("smessage", { message: `**${ID("dname").value || guestid}** connected.`, user: "SYSTEM"})
})
socket.on("disconnect", () => {
    ID("chat").appendChild(document.createElement("div")).innerText = "Connection lost."
})
socket.on("user", (us) => {
    ID("userlist").innerText = us.join(", ")
})

socket.on("message", (m) => {
    console.log("msg")
    let content = m.content
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 1
    var parsed = writer.render(reader.parse(escapeHtml(content.replace("\n","\n\n"))))
    let user = m.user
    let msgelem = document.createElement("div")
    msgelem.appendChild(document.createElement("b")).innerText = user + ":"
    msgelem.innerHTML += parsed // sorry
    msgelem.classList.add("message")
    ID("chat").appendChild(msgelem)
    let reusr = new RegExp(`\@${escapeRegExp(ID("dname").value || guestid)}(\\W|$)`, "mi")
    if (reusr.test(content)) {
        msgelem.classList.add("mention")
        if (document.visibilityState != "visible" && Notification.permission == "granted" && isSecureContext) {
            new Notification(`${user} mentioned you`, { body: content })
        }
        if (document.visibilityState != "visible") {
            unread++
            document.title = `Chat (${unread})`
            if (navigator.setAppBadge) {
                navigator.setAppBadge(unread)
            }
        }
    }
    for (let img of m.images){
        let x = msgelem.appendChild(document.createElement("img"))
        x.src = "data:image/"+img
        x.classList.add("upload")
    }
    if (isbottom){
        ID("chat").scrollTop = ID("chat").scrollHeight
    }
})

ID("send").onclick = send

ID("chatmsg").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        send()
    }
})

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == "visible") {
        unread = 0
        document.title = "Chat"
        if (navigator.setAppBadge) {
            navigator.clearAppBadge(unread)
        }
    }
})

ID("dname").addEventListener("focusout", () => {
    socket.emit("name", ID("dname").value || guestid)
    localStorage.setItem("name", ID("dname").value)
})

// desktop push notifications on mentions

if (Notification.permission == "default" && isSecureContext) {
    ID("notif").showModal()
}
function allowNotifications() {
    Notification.requestPermission().then((act) => {
        ID("notif").removeAttribute("open")
    })
}
function updateImageList(){
    if (images.length){
        ID("attachments").style.visibility = "visible"
        ID("attachments").innerHTML = ""
        let i = 0
        for (let img of images){
            let x = ID("attachments").appendChild(document.createElement("img"))
            x.src = "data:image/"+img
            x.setAttribute("data-index",i)
            x.onclick=(e)=>{
                let index = parseInt(e.target.getAttribute("data-index"))
                images.splice(index,1)
                updateImageList()
            }
            x.classList.add("attachment")
            i++
        }
    } else{
        ID("attachments").style.visibility = "hidden"
    }
}

function addfile(blob){
    let reader = new FileReader();
    reader.onload = (event) => {
        images.push(event.target.result.substring(11));
        updateImageList()
    };
    reader.readAsDataURL(blob);
}

document.onpaste = (e) => {
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i of items) {
        if (i.type.startsWith("image")) {
            addfile(i.getAsFile())
        }
    }
}

function updateTextbox() {
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 1
    ID("chatmsg").style.height = '40px'; // Reset the height
    ID("chatmsg").style.height = `min(${ID("chatmsg").scrollHeight}px,10lh)`; // Adjust height based on content
    if (isbottom){
        ID("chat").scrollTop = ID("chat").scrollHeight
    }
}

ID("chatmsg").addEventListener("input",updateTextbox)
ID("upload").onchange=(e)=>{
    for (let file of e.target.files){
        addfile(file)
    }
}
document.body.ondrop = (e) => {
    e.preventDefault();
    for (let file of e.dataTransfer.files){
        addfile(file)
    }
}
document.body.ondragover = (e) => {
    e.preventDefault();
}
