const express = require('express')
const path = require('path')
const spawn = require('child_process').spawn

const { readJson } = require('../utils/rwjson')
const sse = require('./sse')
const { AbstractEngine } = require('../shared/js/chessboard')

const app = express()

const PORT = process.env.PORT || 3000

const MAX_SSE_CONNECTIONS = 100

const AUTH_TOPICS = []

function IS_DEV(){
    return !!process.env.EASYCHESS_DEV
}

function getVer(obj, field){
    if(!obj[field]) return ""
    return `?ver=${obj[field].mtime}`
}

function clog(msg){
    if(IS_DEV()) console.log(msg)
}

const __rootdirname = path.join(__dirname, '../..')

const STOCKFISH_PATH = path.join(__dirname, "bin/stockfish")

let clientScripts = readJson('resources/conf/clientscripts.json')[IS_DEV() ? "dev" : "prod"]
let clientStyleSheets = readJson('resources/conf/clientstylesheets.json')[IS_DEV() ? "dev" : "prod"]

let versionInfo = readJson('resources/conf/versioninfo.json')

let loadScripts = clientScripts.map(script=>
    `<script src="${script}${getVer(versionInfo, script)}"></script>`).join("\n")

let loadStyleSheets = clientStyleSheets.map(stylesheet=>
    `<link href="${stylesheet}${getVer(versionInfo, stylesheet)}" rel="stylesheet" />`).join("\n")

app.use(express.static(__rootdirname))

let sseconnections = []
app.use(sse)

app.get('/stream', function(req, res) {  
    res.sseSetup()  
    sseconnections.push(res)
    while(sseconnections.length > MAX_SSE_CONNECTIONS) sseconnections.shift()
    clog(`new stream ${req.hostname} conns ${sseconnections.length}`)
})

function ssesend(obj){
    for(let i = 0; i < sseconnections.length; i++){
        sseconnections[i].sseSend(obj)
    }
}

function apisend(obj, error, res){
    if(typeof obj == "string") obj = {
        status: obj
    }
    obj.error = error || null
    if(!obj.error) obj.ok = true
    res.send(JSON.stringify(obj))
}

const HANDLERS = {
    "engine:go": function(res, payload){
      engine.setcommand("go", payload)    
      apisend(`engine:go issued`, null, res)
    },
    "engine:stop":function(res, _){
      engine.setcommand("stop", null)
      apisend(`engine:stop issued`, null, res)
    },
}  

app.use(express.json({limit: '100MB'}))

app.post('/api', (req, res) => {                
    let body = req.body

    clog(body)
  
    let topic = body.topic  
    let payload = body.payload
  
    if(AUTH_TOPICS.includes(topic)){
        if(payload.pass != process.env.PASS){
            apisend({}, "Error: Not authorized.", res)
            clog("not authorized")
            return
        }
    }
  
    try{
        HANDLERS[topic](res, payload)    
    }catch(err){
        console.log("api error", err)
        apisend({}, "Error: API error.", res)
    }  
})

const PROPS = {
    IS_DEV: IS_DEV()
}

class ServerEngine extends AbstractEngine{
    constructor(sendanalysisinfo){
        super(sendanalysisinfo)
    }

    processstdout(data){
        data = data.replace(/\r/g, "")
        for(let line of data.split("\n")){
            this.processstdoutline(line)
        }
    }

    spawnengineprocess(){
        this.process = spawn(STOCKFISH_PATH)

        this.process.stdout.on('data', (data)=>{
            this.processstdout(`${data}`)
        })

        this.process.stderr.on('data', (data)=>{
            this.processstdout(`${data}`)
        })
    }

    sendcommandtoengine(command){
        clog(`engine command : ${command}`)
        this.process.stdin.write(command + "\n")     
    }
}

let engine = new ServerEngine(ssesend)

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html lang="en">

    <head>

        <meta charset="utf-8">
        <title>Easy Chess</title>    

        <link rel="icon" href="/resources/client/favicon.ico" />

        <script>
        const PROPS = ${JSON.stringify(PROPS, null, 2)}
        </script>

        ${loadStyleSheets}

        ${loadScripts}

    </head>

    <body>    

        <div id="root"></div>

        <script src='resources/client/js/index.js?ver=${versionInfo['resources/client/js/index.js'].mtime}'></script>

    </body>

</html>
`))

app.listen(PORT, () => console.log(`easychess server serving from < ${__rootdirname} > listening on port < ${PORT} >!`))
