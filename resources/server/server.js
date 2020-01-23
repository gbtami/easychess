const express = require('express')
var passport = require('passport');
var Strategy = require('passport-lichess').Strategy;
const path = require('path')
const spawn = require('child_process').spawn
const fs = require('fs')
const { getFiles } = require('../utils/fileutils')
const { DAY } = require('../shared/js/commonutils')

passport.use(new Strategy({
        clientID: process.env.LICHESS_CLIENT_ID,
        clientSecret: process.env.LICHESS_CLIENT_SECRET,
        callbackURL: '/auth/lichess/callback'
    },
    function(accessToken, refreshToken, profile, cb) {
    return cb(null, profile)
}))

passport.serializeUser(function(user, cb) {
    cb(null, user)
})
  
passport.deserializeUser(function(obj, cb) {
    cb(null, obj)
})

const app = express()

const { readJson } = require('../utils/rwjson')
const { update } = require('../utils/octokit')
const sse = require('./sse')
const { AbstractEngine } = require('../shared/js/chessboard')
const { fromchunks } = require('../utils/firebase')

const PORT = process.env.PORT || 3000

const MAX_SSE_CONNECTIONS = 100

const QUERY_INTERVAL = 3000

const AUTH_TOPICS = ["bucket:put", "bucket:get", "git:put"]

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

let sacckeypath = path.join(__rootdirname, "firebase/sacckey.json")

fromchunks(sacckeypath)

const admin = require("firebase-admin")

const firebase = admin.initializeApp({
    credential: admin.credential.cert(sacckeypath),
    storageBucket: "pgneditor-1ab96.appspot.com",
    databaseURL: "https://pgneditor-1ab96.firebaseio.com/"
})

bucket = admin.storage().bucket()
db = admin.database()
firestore = firebase.firestore()

bucket.upload(path.join(__rootdirname, "ReadMe.md"), {destination: "ReadMe.md"}, (err, _, apiResponse)=>{
    console.log(err ? "bucket test failed" : `bucket test ok, uploaded ReadMe.md, size ${apiResponse.size}`)
})    
//db.ref("test").set("test")
/*db.ref("test").on("value", function(snapshot) {
    console.log(`db ${snapshot.val()} ok`)
}, function (errorObject) {
    console.log(`db test failed ${errorObject.code}`)
})*/

app.use(require('cookie-parser')())
app.use(require('body-parser').urlencoded({ extended: true }))
const session = require('express-session')
const FirestoreStore = require( 'firestore-store' )(session);
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 1 * DAY
    },
    store: new FirestoreStore({
        database: firestore
    })
}))
app.use(passport.initialize())
app.use(passport.session())

app.get('/auth/lichess',
  passport.authenticate('lichess'))

app.get('/auth/lichess/callback', 
    passport.authenticate('lichess', { failureRedirect: '/login' }),
        function(req, res) {
            res.redirect('/?login=ok')
        }
)

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
    "bucket:put":function(res, payload){    
        let filename = payload.filename || "backup"    
        let content = payload.content
        clog(`put bucket ${filename} content size ${content.length}`)
        fs.writeFile("temp.txt", content, function(err) {
            clog("written file locally")
            bucket.upload("temp.txt", {destination: filename}, (err, _, apiResponse)=>{
                clog(`upload result ${err} ${apiResponse}`)
                apisend({apiResponse: apiResponse}, err, res)
            })    
        })
      },
      "bucket:get":function(res, payload){    
        if(!bucket){
            apisend({}, `Error: No bucket.`, res)          
            return
        }
        let filename = payload.filename || "backup"
        clog("downloading", filename)
        bucket.file(filename).download((err, contents)=>{
            if(err){
                apisend({}, `Error: Not found.`, res)          
            }else{
                apisend({content: contents.toString()}, null, res)
            }            
        })
      },
      "git:put":function(res, payload){    
        let filename = payload.filename || "backup/backup.txt"    
        let content = payload.content
        clog(`git put ${filename} content size ${content.length}`)
        update(filename, content, (result)=>{
          if(result.error) apisend({}, result.status, res)
          else apisend(result.status, null, res)
        })
      }
}  

app.use(express.json({limit: '100MB'}))

app.post('/api', (req, res) => {                
    let body = req.body
  
    let topic = body.topic  
    let payload = body.payload

    clog(topic)
  
    if(AUTH_TOPICS.includes(topic)){
        if(payload.password != process.env.PASSWORD){
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
    IS_DEV: IS_DEV(),
    QUERY_INTERVAL: QUERY_INTERVAL,
    imagestore: getFiles(path.join(__rootdirname, "resources/client/img/imagestore")),
    readme: fs.readFileSync(path.join(__rootdirname, "ReadMe.md")).toString()
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

setInterval(function(){
    ssesend({kind: "tick"})
}, QUERY_INTERVAL)

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html lang="en">

    <head>

        <meta charset="utf-8">
        <title>Easy Chess</title>    

        <link rel="icon" href="/resources/client/favicon.ico" />

        <script>
        const PROPS = ${JSON.stringify({...PROPS, ...{USER: req.user}}, null, 2)}
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

app.get('/gif.worker.js', function(req, res) {  
    res.sendFile(`${__rootdirname}/resources/client/cdn/gif.worker.js`)
})

app.listen(PORT, () => console.log(`easychess server serving from < ${__rootdirname} > listening on port < ${PORT} >!`))
