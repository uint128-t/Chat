var HTMLClean;
function HTMLCopySafe(inelem,outelem){
    // Copies the input element to the output element
    let node_tag = inelem.tagName
    if (!("HTML HEAD A B BLOCKQUOTE I U P BR HR H1 H2 H3 H4 H5 H6 CODE DEL STRONG INS EM SPAN DIV TABLE TR TD TH TBODY BODY LI UL OL S WBR".split(" ").includes(node_tag))){
        HTMLClean = false
        console.log(node_tag)
    }
    let curelem = document.createElement(node_tag)
    for (let attr of inelem.attributes){
        curelem.setAttribute(attr.name,attr.value)
        if (!("href src colspan rowspan".split(" ").includes(attr.name))){
            HTMLClean = false
            console.log(attr.name)
        }
        if (attr.name="href" && attr.value.startsWith("javascript:")){
            HTMLClean = false
            console.log("javascript: in href")
        }
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
    HTMLClean = true;
    const parsed = new DOMParser().parseFromString(html,"text/html").documentElement
    let output = document.createElement("div")
    HTMLCopySafe(parsed,output)
    return output
}