var socket = io();
var ID = document.getElementById.bind(document)
var room = "main"
var reader = new commonmark.Parser();
var writer = new commonmark.HtmlRenderer({ safe: true });
var guestid = ""
var unread = 0
var images = []
var sendID = Date.now()
var editing = document.getElementById("editing")
editing.style.visibility = "hidden";
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

function editmsg(id){
    sendID=id;
    editing.style.visibility = "visible";
}

send = () => {
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 1
    let n = ID("chatmsg").value.trim()
    if (!n && !images.length) {
        return
    }
    if (n == "/clear") {
        ID("chat").innerHTML = "<i>Chat was cleared</i><br><br>"
        ID("chatmsg").value = ""
        lastUser = null
        updateTextbox()
        return
    }
    if (n.startsWith("/join ")) {
        socket.emit('room', { room: n.substring(6) })
        room = n.substring(6)
        ID("room").innerText = room
        ID("chatmsg").value = ""
        updateTextbox()
        return
    }
    socket.emit("smessage", { message: n, images:images, id: sendID })
    editing.style.visibility = "hidden";
    sendID = Date.now()
    images.length = 0
    updateImageList()
    ID("chatmsg").value = ""
    updateTextbox()
    if (isbottom){
        ID("chat").scrollTop = ID("chat").scrollHeight
    }
}

socket.on('connect', () => {
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 1
    guestid = "Guest " + socket.io.engine.id.substring(0, 5);
    ID("chat").appendChild(document.createElement("div")).textContent = "Connected to server!"
    socket.emit("init", ID("dname").value || guestid)
    if (isbottom) {
        ID("chat").scrollTop = ID("chat").scrollHeight
    }
})
socket.on("disconnect", () => {
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 1
    ID("chat").appendChild(document.createElement("div")).textContent = "Connection lost."
    if (isbottom) {
        ID("chat").scrollTop = ID("chat").scrollHeight
    }
})
socket.on("user", (us) => {
    ID("userlist").replaceChildren()
    for (let u of us){
        let elem = ID("userlist").appendChild(document.createElement("div"))
        elem.appendChild(document.createElement("b")).textContent = u[0]
        let uif=elem.appendChild(document.createElement("span"))
        uif.textContent = `\xa0(${u[1].substring(0,8)} ${u[2]})`;
        uif.classList.add("small")
    }
})
var lastUser = "";
var favicon = ID("favicon");
var favcanvas=document.createElement("canvas");
favcanvas.width=64;
favcanvas.height=64;
var ctx=favcanvas.getContext("2d");
var newMessages = false;
function updateIcon(){
    ctx.clearRect(0,0,64,64);
    ctx.fillStyle=unread?"#ff0000":"#00aaff";
    ctx.beginPath();
    ctx.ellipse(32,32,32,32,0,0,2*Math.PI);
    ctx.fill();
    if (newMessages){
        ctx.beginPath();
        ctx.fillStyle="#ffffff";
        ctx.ellipse(55,55,10,10,0,0,2*Math.PI);
        ctx.fill();
    }
    if (1){
        ctx.fillStyle="#ffffff";
        ctx.font="40px Arial";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(unread,32,35);
    }
    favicon.href=favcanvas.toDataURL("image/png");
}
updateIcon();

function editclose(){
    editing.style.visibility = "hidden";
    sendID = Date.now()
}

socket.on("message", (m) => {
    let content = m.content
    let messageid = m.id
    let isbottom = ID("chat").scrollHeight - ID("chat").scrollTop - ID("chat").clientHeight < 100
    var parsed = writer.render(reader.parse((content.replace(/\n/g,"\n\n"))))
    let user = m.user
    let edit = document.getElementById("message-"+messageid)!=null
    let msgelem
    if (!edit){
        msgelem = document.createElement("div")
        msgelem.id = "message-"+messageid
        if (m.userid != lastUser) {
            msgelem.appendChild(document.createElement("b")).textContent = user + ":"
            let uif=msgelem.appendChild(document.createElement("span"))
            uif.textContent = `\xa0(${(m.userid||"SYSTEM").substring(0,8)} ${m.address||"SERVER"})`;
            uif.classList.add("small")
        } else{
            msgelem.classList.add("message-cont");
        }
        lastUser = m.userid;
        msgelem.appendChild(document.createElement("div")).innerHTML = parsed;
        msgelem.classList.add("message")
        if (m.userid == socket.id){
            msgelem.oncontextmenu=()=>{editmsg(messageid);return false}
        }
        ID("chat").appendChild(msgelem)
        msgelem.setAttribute("data-sender", m.userid)
    } else{
        msgelem = document.getElementById("message-"+messageid)
        msgelem.classList.add("edited")
        if (msgelem.getAttribute("data-sender") != m.userid){
            return console.log("edit mismatch");
        }
        let brk = msgelem.firstChild.nodeName=="B";
        msgelem.children[msgelem.children.length-1].remove()
        if (!brk) {
            msgelem.classList.add("message-cont");
        }
        msgelem.appendChild(document.createElement("div")).innerHTML = parsed;
    }
    let reusr = new RegExp(`\@${escapeRegExp(ID("dname").value || guestid)}(\\W|$)`, "mi")
    if (reusr.test(content) || /\@everyone(\W|$)/.test(content)){
        msgelem.classList.add("mention")
        if (document.visibilityState != "visible" && Notification.permission == "granted" && isSecureContext) {
            new Notification(`${user} mentioned you`, { body: content })
        }
        if (document.visibilityState != "visible") {
            unread++
            updateIcon();
        }
    }
    if (document.visibilityState != "visible") {
        newMessages = true;
    }
    updateIcon();
    for (let img of m.images){
        let type = "iframe";
        if (img.startsWith("image")) {
            type = "img";
        }
        let x = msgelem.appendChild(document.createElement(type))
        x.src = "data:"+img
        x.classList.add("upload")
    }
    if (isbottom){
        ID("chat").scrollTop = 999999999;
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
        unread = 0;
        newMessages = false;
        updateIcon();
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
        ID("notif").close()
    })
}
function updateImageList(){
    if (images.length){
        ID("attachments").style.visibility = "visible"
        ID("attachments").innerHTML = ""
        let i = 0
        for (let img of images){
            let type="iframe";
            if (img.startsWith("image")){
                type="img";
            }
            let x = ID("attachments").appendChild(document.createElement(type))
            x.src = "data:"+img
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
        images.push(event.target.result.substring(5));
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
