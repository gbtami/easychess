////////////////////////////////////////////////////////////////////////////////
// config

const STOCKFISH_JS_PATH = "resources/client/cdn/stockfish.wasm.js"
const BACKUP_FETCH_URL = "https://raw.githubusercontent.com/easychessanimations/easychess/master/backup/backup.txt"
const IMAGE_STORE_PATH = "/resources/client/img/imagestore"
const LICHESS_LOGIN_URL = "/auth/lichess"

const POSITION_CHANGED_DELAY = 500
const ALERT_DELAY = 3000
const REBUILD_IMAGES_DELAY = 3000
const STORE_DEFAULT_DELAY = 1000
const HIGHLIGHT_DRAWINGS_DELAY = 250
const PLAY_ANIMATION_DELAY = 1000

const QUERY_INTERVAL = PROPS.QUERY_INTERVAL || 3000

const THUMB_SIZE = 150

const GREEN_BUTTON_COLOR = "#afa"
const BLUE_BUTTON_COLOR = "#aaf"
const CYAN_BUTTON_COLOR = "#aff"
const RED_BUTTON_COLOR = "#faa"
const IDLE_BUTTON_COLOR = "#eee"

const TREE_SEED = 10
const TREE_MAX_DEPTH = 10

const DEFAULT_FRAME_DELAY = 1000

const REMOVE_IMAGE_EXTENSION_REGEXP = /\.JPG$|\.PNG$|\.GIF$/i

const PASSWORD_KEY = "PASSWORD"

const BACKUP_STORAGES = [
    "engine",
    "study"
]

////////////////////////////////////////////////////////////////////////////////

class LocalEngine extends AbstractEngine{
    constructor(sendanalysisinfo){
        super(sendanalysisinfo)
    }

    spawnengineprocess(){
        this.stockfish = new Worker(STOCKFISH_JS_PATH)

        this.stockfish.onmessage = function(message){
            this.processstdoutline(message.data)
        }.bind(this)
    }

    sendcommandtoengine(command){
        this.stockfish.postMessage(command)
    }
}

class App extends SmartDomElement{
    raiok(){
        if(!this.rai) return false
        return this.rai.analysisinfo.analysiskey == this.board.analysiskey()
    }

    showanalysisinfo(){        
        if(this.raiok()){
            this.gametext.setValue(this.rai.asText())        
            this.board.highlightrichanalysisinfo(this.rai)
        }else{
            this.gametext.setValue(`no analysis available`)        
            this.board.clearanalysisinfo()
        }        
    }

    processanalysisinfo(analysisinfo){
        this.rai = new RichAnalysisInfo(analysisinfo).live(true)
        
        this.showanalysisinfo()

        this.gobutton.bc(this.rai.running ? IDLE_BUTTON_COLOR : GREEN_BUTTON_COLOR)
        this.stopbutton.bc(this.rai.running ? RED_BUTTON_COLOR : IDLE_BUTTON_COLOR)

        IDB.put("engine", this.rai.analysisinfo)
    }

    go(){
        this.shouldGo = true

        let payload = {
            multipv: 5,
            fen: this.board.game.fen()
        }

        if(this.settings.uselocalstockfishcheckbox.checked){
            this.engine.setcommand("go", payload)
        }else{
            api("engine:go", payload, response => {
                this.clog(response)
            })
        }
    }

    stop(){
        this.shouldGo = false

        if(this.settings.uselocalstockfishcheckbox.checked){
            this.engine.setcommand("stop")
        }else{
            api("engine:stop", {}, response => {
                this.clog(response)
            })
        }        
    }

    moveClicked(lm){
        this.board.makeMove(lm)
    }

    weightChanged(index, lm, value){        
        this.board.game.makemove(lm)
        this.board.game.getcurrentnode().weights[index] = value
        this.board.game.back()        
        this.positionchanged()
    }

    highlightDrawings(){
        this.board.highlightDrawings()
    }

    commentChanged(value){
        this.board.game.getcurrentnode().comment = value
        this.doLater("storeDefault", STORE_DEFAULT_DELAY)
        this.doLater("highlightDrawings", HIGHLIGHT_DRAWINGS_DELAY)
    }

    buildMoves(){
        let lms = this.board.getlms(RICH).sort((a,b) => a.san.localeCompare(b.san))                
        lms.sort((a,b) => ( ( b.gameMove - a.gameMove ) * 100 + ( b.weights[0] - a.weights[0] ) * 10 + ( b.weights[1] - a.weights[1] ) ))
        this.movesDiv.x().ame(div().hh(this.board.boardsize()).df().a(
            div().ovfys().a(
                lms.map(lm => div().ffm().dfc().a(                                
                    div().cp().bc(lm.gameMove ? "#ccf" : "#eee").fw(lm.gameMove ? "bold" : "normal")
                    .pad(1).mar(1).w(60).html(lm.san)
                    .ae("click", this.moveClicked.bind(this, lm)),
                    ([0,1].map(index =>
                        Combo({
                            changeCallback: this.weightChanged.bind(this, index, lm),
                            selected: lm.gameNode ? lm.gameNode.weights[index] : 0,
                            options: Array(11).fill(null).map((_,i) => ({value: i, display: i}))
                        }).mar(1)
                    )),
                ))
            ),
            this.commentTextArea = TextAreaInput({
                text: this.board.game.getcurrentnode().comment,
                changeCallback: this.commentChanged.bind(this)
            }).fs(16).w(300)
        ))

        this.commentTextArea.focus()
    }

    nodeClicked(node){
        this.board.setfromnode(node)
    }

    buildTree(nodeOpt, rgbopt, depth, maxdepth){
        if(depth > maxdepth) return div().html("...")

        let def = this.board.game.getcurrentnode()
        for(let i=0;i<5;i++) if(def.getparent()) def = def.getparent()
        let node = nodeOpt || def
        let current = node.id == node.parentgame.currentnodeid
        let rgb = rgbopt || randrgb()        
        if(node.childids.length > 1) rgb = randrgb()

        return div()
            .ac("unselectable").mar(rgb == rgbopt ? 0 : 3).bc(rgb).dfcc()
            .a(
                div()
                    .w(60).cp().pad(2).bdr("solid", 3, current ? "#0f0" : "#ddd")
                    .mar(1).bc(node.gensan ? node.turn() ? "#000" : "#fff" : "#070")
                    .c(node.turn() ? "#fff" : "#000").tac()
                    .html(node.gensan ? `${node.fullmovenumber()}. ${node.gensan}` : "root")
                    .ae("click", this.nodeClicked.bind(this, node)),
                div()
                    .df()
                    .a(
                        node.sortedchilds().map(child =>
                            this.buildTree(child, rgb, depth + 1, maxdepth)
                    )
            )
        )        
    }

    showTree(){
        seed = TREE_SEED
        this.treeDiv.x().a(this.buildTree(null, null, 0, TREE_MAX_DEPTH))
    }

    storeDefault(){        
        this.storeStudy("Default", this.board.game.serialize())
    }

    positionchanged(){
        this.rai = null
        this.showanalysisinfo()

        if(this.shouldGo){
            this.stop()
            this.go()
        }else{
            IDB.get("engine", this.board.analysiskey()).then(
                (dbResult => {
                    if(dbResult.hasContent){
                        this.rai = new RichAnalysisInfo(dbResult.content)
                        this.showanalysisinfo()
                    }
                })
            )
        }

        this.doLater("buildMoves", POSITION_CHANGED_DELAY)
        this.doLater("showTree", POSITION_CHANGED_DELAY)
        this.doLater("buildAnimsDiv", POSITION_CHANGED_DELAY)

        this.storeDefault()
    }

    clog(msg){
        if(IS_DEV()) console.log(msg)
    }

    checksource(){
        let elapsed = performance.now() - this.lasttick

        if(elapsed > 2 * QUERY_INTERVAL){
            this.clog(`event source timed out, setting up new`)

            this.lasttick = performance.now()

            this.setupsource()
        }
        else{
            
        }
    }

    setupsource(){
        this.clog(`setting up event source with interval ${QUERY_INTERVAL} ms`)        

        this.source = new EventSource('/stream')

        this.source.addEventListener('message', function(e){
            let analysisinfo = JSON.parse(e.data)
            if(analysisinfo.kind == "tick"){
                this.lasttick = performance.now()
            }else{
                this.processanalysisinfo(analysisinfo)
            }            
        }.bind(this), false)

        this.source.addEventListener('open', function(e){            
            this.clog("connection opened")
        }.bind(this), false)

        this.source.addEventListener('error', function(e){
            if (e.readyState == EventSource.CLOSED) {                
                this.clog("connection closed")
            }
        }.bind(this), false)

        this.lasttick = performance.now()
    }

    loadStudy(study){
        IDB.get("study", study).then(result => {            
            if(result.hasContent){                
                this.board.setgame(Game().fromblob(result.content.game))
            }
        })
    }

    storeStudy(title, game){
        IDB.put("study", {
            title: title,
            game: game
        })
    }

    alert(msg){
        this.alertDiv.show(true).html(msg)

        setTimeout(() => {this.alertDiv.show(false)}, ALERT_DELAY)
    }

    deleteImage(name){
        IDB.delete("image", name).then(_ => this.showImages())
    }

    showImages(){
        this.imageDiv
            .x().a(div().marl(10).mart(6)
            .html("Images loading ..."))

        IDB.getAll("image").then(result => {
            if(result.ok){
                this.imageDiv.x().a(
                    result.content.map(item =>
                        div().mar(3).dib().pad(3).bc("#aff").a(
                            div().dfcc().a(
                                div().html(item.name),
                                Button(`Delete ${item.name}`, this.deleteImage.bind(this, item.name)).mar(5),
                                Img({src: item.imgsrc, width: THUMB_SIZE, height: THUMB_SIZE})
                            )
                        )
                    )
                )
            }
        })
    }

    uploadimage(content, nameorig){
        let canvas = this.board.getCanvasByName("dragpiece")

        canvas.drawImageFromSrc(content, Vect(0,0)).then(() => {                    
            let offername = nameorig.replace(REMOVE_IMAGE_EXTENSION_REGEXP, "")
            let name = window.prompt("Image name :", offername)
            IDB.put("image", {
                name: name,
                imgsrc: content
            }).then(result => {
                if(result.ok){
                    this.alert(`Image ${name} stored.`)
                    this.showImages()
                    setTimeout(function(){canvas.clear()}.bind(this), REBUILD_IMAGES_DELAY)
                }else{
                    this.alert(`Storing image ${name} failed.`)
                }
            })  
        })
    }

    dropImages(files){
        let file = files[0]
        let reader = new FileReader()

        reader.onload = event => {          
            let content = event.target.result            
            this.uploadimage(content, file.name)
        }

        reader.readAsDataURL(file)                
    }

    imageDropped(ev){
        this.dropImages(ev.dataTransfer.files)
    }

    addAnimationCallback(){                
        let [ value, display ] = [ this.board.game.currentnodeid + "_" + UID() , "Animation " + this.board.game.line() ]
        display = window.prompt("Animation name : ", display)
        this.alert(`Added animation ${display} under id ${value}.`)
        return [ value, display ]
    }

    animsChanged(selected, options){        
        let g = this.board.game
        g.animations = options
        g.selectedAnimation = selected
        this.buildAnimsDiv()
        this.doLater("storeDefault", STORE_DEFAULT_DELAY)
    }

    addSelAnimationCallback(){
        return [ this.board.game.currentnodeid, "root " + this.board.game.line() ]
    }

    selAnimChanged(selected, options){
        let g = this.board.game
        g.animationDescriptors[g.selectedAnimation.value] = {
            selected: selected,
            list: options
        }                                
        try{
            this.board.setfromnode(g.gamenodes[selected.value])
        }catch(err){
            this.positionchanged()
        }
    }

    playAnimation(task){
        if(this.recordAnimation){
            if(this.recordAnimationCycle > 1){
                this.recordAnimation = false
                task = stop
                this.render()
            }
        }

        if(task == "record"){            
            this.moveAnimationForward({task: "toend"})            
            this.recordAnimation = true            
            this.initgif()
            this.recordAnimationCycle = 0
            task = "play"
        }

        let stopfunc = function(){
            if(this.playtimeout){
                clearTimeout(this.playtimeout)
                this.playtimeout = null
            }
            this.recordAnimation = false
        }.bind(this)

        if(task == "play"){            
            let contfunc = function(maf){
                if(maf){                
                    this.playtimeout = setTimeout(this.playAnimation.bind(this, "play"), PLAY_ANIMATION_DELAY)
                }                
                else{
                    stopfunc()
                }
            }.bind(this)   

            let maf = this.moveAnimationForward()

            if(typeof maf == "boolean"){
                contfunc(maf)
            }else{                
                maf.then(maf => contfunc(maf))
            }
        }

        if(task == "stop") stopfunc()
    }

    buildAnimsDiv(){
        let g = this.board.game

        let selanim = g.selectedAnimation
        let anims = g.animations

        this.animsEditableList = EditableList({
            id: "animseditablelist",
            changeCallback: this.animsChanged.bind(this),
            addOptionCallback: this.addAnimationCallback.bind(this),
            forceSelected: selanim,
            forceOptions: anims,
            width: 500,
            forceZIndex: 20
        }).mar(5)

        this.animsDiv.x().a(            
            div().a(
                Button("Step", this.moveAnimationForward.bind(this)).mar(5),
                Button("Play", this.playAnimation.bind(this, "play")).mar(5),
                Button("Stop", this.playAnimation.bind(this, "stop")).mar(5),
                Button("Record", this.playAnimation.bind(this, "record")).mar(5)
            ),
            this.animsEditableList
        )

        if(selanim){
            let animdesc = this.board.game.animationDescriptors[selanim.value]            

            this.selAnimEditableList = EditableList({
                id: "selanimeditablelist",
                changeCallback: this.selAnimChanged.bind(this),
                addOptionCallback: this.addSelAnimationCallback.bind(this),
                forceSelected: animdesc ? animdesc.selected : null,
                forceOptions: animdesc ? animdesc.list : [],
                width: 500,
                forceZIndex: 10,
                dontRollOnSelect: true
            }).mar(10)

            this.animsDiv.a(
                this.selAnimEditableList
            )
        }

        this.animsDiv.ame()
    }

    record(){return P(resolve => {
        let bs = this.board.boardsize()
        let props = this.board.game.getcurrentnode().props()

        let canvas = Canvas({width: 2 * bs, height: bs})

        canvas.fillStyle("#FFFFFF")
        canvas.fillRect(Vect(0,0), Vect(2*bs,bs))
        
        canvas.ctx.drawImage(this.board.getCanvasByName("background").e, 0, 0)
        canvas.ctx.globalAlpha = 0.3
        canvas.ctx.drawImage(this.board.getCanvasByName("square").e, 0, 0)
        canvas.ctx.globalAlpha = 1
        canvas.ctx.drawImage(this.board.getCanvasByName("piece").e, 0, 0)
        canvas.ctx.drawImage(this.board.getCanvasByName("drawings").e, 0, 0)

        let finalizefunc = function(){
            canvas.ctx.drawImage(this.board.commentcanvas.e, bs, 0)

            this.gif.addFrame(canvas.e, {delay: props.delay || DEFAULT_FRAME_DELAY})

            resolve(true)
        }.bind(this)            

        let drawings = this.board.game.getcurrentnode().drawings()

        let imageName = null
        let drawing = null
        for(let drw of drawings){
            if(drw.kind == "image"){                    
                imageName = drw.name
                drawing = drw                    
                break
            }
        }

        if(imageName){
            IDB.get("image", imageName).then(
                result => {
                    if(result.hasContent){
                        canvas.ctx.globalAlpha = drawing.opacity / 9

                        let ds = bs * drawing.thickness / 9
                        let dm = ( bs - ds ) / 2

                        canvas.drawImageFromSrc(result.content.imgsrc, Vect(bs + dm, dm), Vect(ds, ds)).then(_ => {
                            canvas.ctx.globalAlpha = 1
                            finalizefunc()
                        })                            
                    }else{
                        finalizefunc()
                    }
                },
                _ => finalizefunc()
            )
        }else{
            finalizefunc()
        }
    })}

    render(){
        this.gif.render()
    }

    moveAnimationForward(argOpt){
        let arg = argOpt || {}
        let g = this.board.game

        let selanim = g.selectedAnimation

        if(selanim){
            let animdesc = g.animationDescriptors[selanim.value]

            if(animdesc) if(animdesc.selected) if(animdesc.list) if(animdesc.list.length){
                let selnodeid = animdesc.selected.value
                let i = animdesc.list.findIndex(opt => opt.value == selnodeid)
                if((i>=0)){
                    if(arg.task == "toend"){                        
                        i = animdesc.list.length - 1
                    }else{
                        i++
                        if(i >= animdesc.list.length) i = 0                                        
                    }                   

                    animdesc.selected = animdesc.list[i]
                    selnodeid = animdesc.list[i].value                    
                    this.board.setfromnode(g.gamenodes[selnodeid])                    

                    if(this.recordAnimation){
                        if(i==0) this.recordAnimationCycle++
                        if(this.recordAnimationCycle < 2){
                            return this.record()
                        }
                    }

                    return true
                }
            }
        }        

        return false
    }

    loginWithLichess(){
        document.location.href = LICHESS_LOGIN_URL
    }

    createBackupBlob(){return P(resolve => {
        let obj = {
            localStorageEntries: Object.entries(localStorage)
                .filter(entry => entry[0] != PASSWORD_KEY)
        }
        IDB.getAlls(BACKUP_STORAGES).then(result => {
            obj.indexedDB = result
            resolve(obj)
        })
    })}

    createZippedBackup(){return P(resolve => {
            this.createBackupBlob().then(blob=>{
                resolve(createZip(JSON.stringify(blob)))
            })
    })}

    askPass(){
        let storedPass = localStorage.getItem(PASSWORD_KEY)
        if(storedPass) return storedPass
        let password = window.prompt("Password : ")
        localStorage.setItem(PASSWORD_KEY, password)
        return password
    }

    showBackup(){
        this.createZippedBackup().then(
            content => this.backupTextArea.setCopy(content)
        )
    }

    setFromBackup(content){
        unZip(content).then(blobstr => {
            let blob = JSON.parse(blobstr)
            let i = 0
            for(let entry of blob.localStorageEntries){
                localStorage.setItem(entry[0], entry[1])
                i++
            }
            let si = 0
            let ki = 0                
            for(let store in blob.indexedDB){                                
                for(let obj of blob.indexedDB[store].content){                    
                    console.log(store, obj);
                    (async function(){
                        await IDB.put(store, obj)
                    })()
                    ki++
                }
                si ++
            }
            this.alert(`Restored ${i} localStorage item(s), ${si} indexedDB store(s), ${ki} indexedDB object(s).`)
            setTimeout(() => document.location.reload(), ALERT_DELAY)
        })
    }

    backupPasted(ev){
        let content = ev.clipboardData.getData('Text')        
        this.backupTextArea.setCopy(content)
        this.setFromBackup(content)
    }

    setPassword(){
        localStorage.removeItem(PASSWORD_KEY)
        this.askPass()
    }

    backupRemote(){
        this.createZippedBackup().then(content =>
            api("bucket:put", {
                content: content,
                password: this.askPass()
            }, response => {
                if(response.ok){
                    this.alert(`Backup done. Size ${response.apiResponse.size}`)
                }else{
                    this.alert(`Backup failed. ${response.error}`)
                }
            })
        )
    }

    restoreRemote(){
        api("bucket:get", {
            password: this.askPass()
        }, response => {
            if(response.ok){
                this.setFromBackup(response.content)
            }
        })
    }

    backupLocal(){
        this.createZippedBackup().then(content => {
            downloadcontent(content)
        })
    }

    backupGit(){
        this.createZippedBackup().then(content => {
            api("git:put", {
                content: content,
                password: this.askPass()
            }, response => {
                if(response.ok){
                    this.alert(`Uploaded to git.`)
                }else{
                    this.alert(`${response.error}`)
                }
            })
        })
    }

    backupDropped(ev){
        let file = ev.dataTransfer.files[0]
        let reader = new FileReader()

        reader.onload = event => {          
            let content = event.target.result            
            this.setFromBackup(content)
        }

        reader.readAsText(file)
    }

    restoreGit(){
        fetch(BACKUP_FETCH_URL).then(
            response => response.text().then(
                content => {
                    this.setFromBackup(content)
                },
                _ => {                                        
                    this.alert("Error: Response content could not be obtained.")
                }
            ),
            _ => {                
                this.alert("Error: Fetch failed.")
            }
        )
    }

    loadImagestore(){
        PROPS.imagestore.forEach(name => IDB.get("image", name.split(".")[0]).then(result => {
            if(!result.hasContent){
                fetch(`${IMAGE_STORE_PATH}/${name}`)
                    .then(response => response.blob())
                    .then(blob => blobToDataURL(blob))                    
                    .then(dataUrl => {
                        this.clog(`storing fetched image ${name}`)
                        IDB.put("image", {
                            name: name.split(".")[0],
                            imgsrc: dataUrl
                        })
                        this.doLater("showImages", REBUILD_IMAGES_DELAY)
                    })
            }
        }))
    }

    clean(){
        localStorage.clear()
        indexedDB.deleteDatabase(DATABASE_NAME)
        this.alert("Cleared localStorage and indexedDB.")
        setTimeout(() => document.location.reload(), ALERT_DELAY)
    }

    commandChanged(ev){
        if( (ev.type == "keyup") && (ev.keyCode == 13) ){
            let command = ev.target.value
            this.commandInput.setValue("")
            switch(command){
                case "clean":
                    this.clean()
                    break
            }
        }
    }

    constructor(props){
        super("div", props)

        this.settings = {}

        this.engine = new LocalEngine(this.processanalysisinfo.bind(this))

        this.board = Board({
            id: "mainboard",            
            positionchangedcallback: this.positionchanged.bind(this)
        })

        this.mainPane = SplitPane({row: true, fitViewPort: true, headsize: this.board.boardsize()}).por(),            

        this.alertDiv = div()
            .poa().t(50).l(50).show(false).bc("#ffa")
            .bdr("solid", 5, "#777", 10).w(600).pad(10).zi(1000).tac()

        this.mainPane.a(this.alertDiv)

        this.movesDiv = div()
        this.treeDiv = div()

        this.imageDiv = div()
            .dfca().flww().dropLogic(this.imageDropped.bind(this))

        this.authDiv = div().a(
            div().mar(5).a(                
                Button("Login with lichess", this.loginWithLichess.bind(this)),
                Button("Set Password", this.setPassword.bind(this))                
            )
        )

        this.imageDiv.resize = function(width, height){                        
            this.w(width - 20).mih(height - 20)
        }.bind(this.imageDiv)

        this.movesDiv.resize = function(){                        
            this.buildMoves()
        }.bind(this)

        this.animsDiv = div()

        let username = "_ Auth _"

        if(PROPS.USER){
            username = PROPS.USER.username
        }

        this.backupDiv = div().a(
            div().mar(5).a(
                Button("Show", this.showBackup.bind(this)),
                Button("Backup Remote", this.backupRemote.bind(this)),
                Button("Restore Remote", this.restoreRemote.bind(this)),
                Button("Backup Local", this.backupLocal.bind(this)),
                Button("Backup Git", this.backupGit.bind(this)),
                Button("Restore Git", this.restoreGit.bind(this)),
            ),            
            this.backupTextArea = TextAreaInput().mar(10).w(this.board.boardsize()).h(this.board.boardsize())
                .ae("paste", this.backupPasted.bind(this)).dropLogic(this.backupDropped.bind(this))
        )

        this.tabs = TabPane({id: "maintabpane"}).setTabs([
            Tab({id: "moves", caption: "Moves", content: this.movesDiv}),
            Tab({id: "tree", caption: "Tree", content: this.treeDiv}),
            Tab({id: "images", caption: "Images", content: this.imageDiv}),
            Tab({id: "anims", caption: "Animations", content: this.animsDiv}),
            Tab({id: "backup", caption: "Backup", content: this.backupDiv}),            
            Tab({id: "about", caption: "About", content: div().mar(5).marl(20).a(div().html(md2html(PROPS.readme)))}),
            Tab({id: "auth", caption: username, content: this.authDiv}),
        ])

        this.mainPane.headDiv.a(
            this.board,
            this.controlPanel = div()
                .dfc().flww().w(this.board.boardsize() - 6)
                .mar(3).marl(0).pad(3).bc("#cca")
                .a(
                Button("i", this.board.reset.bind(this.board)).ff("lichess").bc(RED_BUTTON_COLOR),
                Button("B", this.board.doflip.bind(this.board)).ff("lichess").bc(CYAN_BUTTON_COLOR),
                Button("W", this.board.tobegin.bind(this.board)).ff("lichess").bc(BLUE_BUTTON_COLOR),                
                Button("Y", this.board.back.bind(this.board)).ff("lichess").bc(GREEN_BUTTON_COLOR),
                Button("X", this.board.forward.bind(this.board)).ff("lichess").bc(GREEN_BUTTON_COLOR),
                Button("V", this.board.toend.bind(this.board)).ff("lichess").bc(BLUE_BUTTON_COLOR),
                Button("L", this.board.del.bind(this.board)).ff("lichess").bc(RED_BUTTON_COLOR),
                CheckBoxInput({id: "uselocalstockfishcheckbox", settings: this.settings}),
                this.gobutton = Button("Go", this.go.bind(this)).bc(GREEN_BUTTON_COLOR),
                this.stopbutton = Button("Stop", this.stop.bind(this)).bc(IDLE_BUTTON_COLOR),
                this.commandInput = TextInput().w(80).ae("keyup", this.commandChanged.bind(this),
                )
            ),
            this.gametext = TextAreaInput().w(this.board.boardsize() - 6).h(120)
        )

        this.mainPane.setContent(this.tabs)

        this.am(
            this.mainPane
        )

        this.setupsource()        

        setInterval(this.checksource.bind(this), QUERY_INTERVAL)

        this.loadStudy("Default")

        this.positionchanged()

        this.showImages()

        this.loadImagestore()
    }

    initgif(){
        this.gif = new GIF({
            workers: 2,
            quality: 10
        })
    
        this.gif.on('finished', function(blob) {
            window.open(URL.createObjectURL(blob));
        })
    }
}

initDb().then(
    _ => {
        let app = new App({id: "app"})

        document.getElementById('root').appendChild(app.e)

        app.clog(app)
        app.clog(PROPS)
    },
    err => {
        console.log(err.content)
    }
)