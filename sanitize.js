function HTMLCopySafe(inelem,outelem){
    // Copies the input element to the output element
    let node_tag = inelem.tagName
    if ("SCRIPT STYLE IFRAME SVG MATH OBJECT EMBED META LINK BASE".split(" ").includes(node_tag)){
        return
    }
    let curelem = document.createElement(node_tag)
    for (let attr of inelem.attributes){
        if (
            attr.name.startsWith("on")||
            "id srcset srcdoc ping".split(" ").includes(attr.name)
        ){
            continue
        }
        if ("href src action formaction xlink:href".split(" ").includes(attr.name)){
            if (!attr.value.startsWith("http")){
                continue
            }
        }
        curelem.setAttribute(attr.name,attr.value)
    }
    outelem.appendChild(curelem)
    for (let child of inelem.childNodes){
        if (child instanceof HTMLElement){
            HTMLCopySafe(child,curelem)
        } else if (child.nodeType == Node.TEXT_NODE){
            curelem.appendChild(document.createTextNode(child.textContent))
        }
    }
}
function sanitizeHTML(html){
    const parsed = new DOMParser().parseFromString(html,"text/html").body
    let output = document.createElement("div")
    HTMLCopySafe(parsed,output)
    let body = output.firstChild
    output.replaceChildren(...body.childNodes)
    return output
}