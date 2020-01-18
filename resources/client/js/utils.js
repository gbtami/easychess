function IS_DEV(){
    if(typeof PROPS != "undefined") return PROPS.IS_DEV
    return !!document.location.host.match(/localhost/)
}

Array.prototype.itoj = function(i, j){    
    while(i != j){
        const n = j > i ? i + 1 : i - 1;
        [ this[i], this[n] ] = [ this[n], this[i] ]
        i = n
    }
}

function UID(){
    return "uid_" + Math.random().toString(36).substring(2,12)
}

function cloneObject(obj){
    return JSON.parse(JSON.stringify(obj))
}

function simpleFetch(url, params, callback){
    fetch(url, params).then(
        (response)=>response.text().then(
            (text)=>{                
                callback({ok: true, content: text})
            },
            (err)=>{
                console.log("get response text error", err)
                callback({ok: false, status: "Error: failed to get response text."})
            }
        ),
        (err)=>{
            console.log("fetch error", err)
            callback({ok: false, status: "Error: failed to fetch."})
        }
    )
}

function storeLocal(key, obj){
    localStorage.setItem(key, JSON.stringify(obj))
}

function getLocal(key, def){
    let stored = localStorage.getItem(key)
    if(stored) return JSON.parse(stored)
    return def
}

class NdjsonReader{
    constructor(url, processLineFunc){
        this.url = url
        this.processLineFunc = processLineFunc
    }

    read(){
        this.reader.read().then(
            (chunk)=>{
                if(chunk.done){
                    return
                }
                let content = this.pendingChunk + new TextDecoder("utf-8").decode(chunk.value)
                let closed = content.match(/\n$/)
                let hasline = content.match(/\n/)
                let lines = content.split("\n")                
                if(hasline){
                    if(!closed){
                        this.pendingChunk = lines.pop()
                    }
                    for(let line of lines){
                        if(line != "") this.processLineFunc(JSON.parse(line))
                    }
                    this.read()
                }else{
                    this.pendingChunk += content
                }
            },
            err=>{
                console.log(err)
            }
        )
    }

    stream(){        
        fetch(this.url, {
            headers: {
                "Accept": "application/x-ndjson"
            }            
        }).then(
            response=>{        
                this.pendingChunk = ""
                this.reader = response.body.getReader()
                this.read()        
            },
            err=>{
                console.log(err)
            }
        )
    }
}

function strippedfen(fen){
    return fen.split(" ").slice(0, 4).join(" ")
}

function stripsan(san){
    let strippedsan = san.replace(new RegExp(`[\+#]*`, "g"), "")
    return strippedsan
}

function getclassforpiece(p, style){
    let kind = p.kind
    if(p.color == WHITE) kind = "w" + kind
    return ( style || "alpha" ) + "piece" + kind
}

class Vect_{
    constructor(x, y){
        this.x = x
        this.y = y
    }

    p(v){
        return Vect(this.x + v.x, this.y + v.y)
    }

    m(v){
        return Vect(this.x - v.x, this.y - v.y)
    }

    l(){
        return Math.sqrt(this.x*this.x + this.y*this.y)
    }

    s(s){
        return Vect(s*this.x, s*this.y)
    }
}
function Vect(x,y){return new Vect_(x,y)}

function getStyle(className) {
    let cssText = ""
    for(let si=0;si<document.styleSheets.length;si++){
        let classes = document.styleSheets[si].rules || document.styleSheets[0].cssRules
        for (let x = 0; x < classes.length; x++) {                            
            if (classes[x].selectorText == className) {
                cssText += classes[x].cssText || classes[x].style.cssText
            }         
        }
    }    
    return cssText
}
