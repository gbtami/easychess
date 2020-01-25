////////////////////////////////////////////////////////////////////////////////
// config

const STOCKFISH_JS_PATH         = "resources/client/cdn/stockfish.wasm.js"
const BACKUP_FETCH_URL          = "https://raw.githubusercontent.com/easychessanimations/easychess/master/backup/backup.txt"
const IMAGE_STORE_PATH          = "/resources/client/img/imagestore"
const LICHESS_LOGIN_URL         = "/auth/lichess"
const LICHESS_BASE_URL          = "https://lichess.org"
const LICHESS_ANALYSIS_URL      = LICHESS_BASE_URL + "/analysis"
const LICHESS_GAMES_URL         = LICHESS_BASE_URL + "/api/games/user"
const DEFAULT_USERNAME          = "lishadowapps"
const MAX_GAMES                 = IS_DEV() ? 10 : 100

const POSITION_CHANGED_DELAY    = 500
const ALERT_DELAY               = 3000
const REBUILD_IMAGES_DELAY      = 3000
const STORE_DEFAULT_DELAY       = 1000
const HIGHLIGHT_DRAWINGS_DELAY  = 250
const PLAY_ANIMATION_DELAY      = 1000

const QUERY_INTERVAL            = PROPS.QUERY_INTERVAL || 3000

const GAMETEXT_HEIGHT           = 123
const THUMB_SIZE                = 150

const GREEN_BUTTON_COLOR        = "#afa"
const BLUE_BUTTON_COLOR         = "#aaf"
const CYAN_BUTTON_COLOR         = "#aff"
const RED_BUTTON_COLOR          = "#faa"
const YELLOW_BUTTON_COLOR       = "#ffa"
const IDLE_BUTTON_COLOR         = "#eee"

const TREE_SEED                 = 10

const TREE_BACKWARD_DEPTH       = 10
const TREE_MAX_DEPTH            = 10

const DEFAULT_FRAME_DELAY       = 1000

const PASSWORD_KEY              = "PASSWORD"

const DEFAULT_MULTIPV           = 5
const DEFAULT_THREADS           = 2

const REMOVE_IMAGE_EXTENSION_REGEXP = /\.JPG$|\.PNG$|\.GIF$/i

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

        this.stockfish.onmessage = message => {
            this.processstdoutline(message.data)
        }
    }

    sendcommandtoengine(command){
        this.stockfish.postMessage(command)
    }
}

class App extends SmartDomElement{
    raiok(rai){
        if(!rai) return false
        return ( rai.analysisinfo.analysiskey == this.board.analysiskey() )
    }

    showAnalysisinfo(){        
        let text = "--> no analysis available"        

        this.board.analysisinfoDiv = this.analysisinfoDiv
    
        if(this.raiok(this.rai) && this.raiok(this.storedrai)){
            if(this.storeOk()){
                text = this.rai.asText()
                this.board.highlightrichanalysisinfo(this.rai)
            }else{
                text = ( this.shouldGo ? this.rai.asText() + "\n" : "" ) + this.storedrai.asText()
                this.board.highlightrichanalysisinfo(this.storedrai)
            }
        }else if(this.raiok(this.storedrai)){
            text = this.storedrai.asText()
            this.board.highlightrichanalysisinfo(this.storedrai)
        }else if(this.raiok(this.rai)){
            text = this.rai.asText()
            this.board.highlightrichanalysisinfo(this.rai)             
        }

        this.gametext.setValue(text)                
    }

    storeOk(){
        if(!this.raiok(this.rai)) return false        
        if(!this.raiok(this.storedrai)) return true
        return (this.storedrai.analysisinfo.lastcompleteddepth <= this.rai.analysisinfo.lastcompleteddepth)
    }

    processanalysisinfo(analysisinfo){
        this.rai = new RichAnalysisInfo(analysisinfo).live(true)

        IDB.get("engine", this.board.analysiskey()).then(result => {
            this.storedrai = result.hasContent ? new RichAnalysisInfo(result.content) : null

            this.showAnalysisinfo()

            this.gobutton.bc(this.rai && this.rai.running ? IDLE_BUTTON_COLOR : GREEN_BUTTON_COLOR)
            this.stopbutton.bc(this.rai && this.rai.running ? RED_BUTTON_COLOR : IDLE_BUTTON_COLOR)

            if(this.storeOk()) IDB.put("engine", this.rai.analysisinfo)
        })
    }

    go(){
        this.shouldGo = true

        let payload = {
            multipv: parseInt(this.settings.multipvCombo.selected) || DEFAULT_MULTIPV,
            fen: this.board.game.fen()
        }

        if(this.settings.uselocalstockfishCheckbox.checked){
            this.engine.setcommand("go", payload)
        }else{
            payload.threads = parseInt(this.settings.threadsCombo.selected) || DEFAULT_THREADS,
            api("engine:go", payload, response => {
                this.clog(response)
            })
        }
    }

    stop(){
        this.shouldGo = false

        if(this.settings.uselocalstockfishCheckbox.checked){
            this.engine.setcommand("stop")
        }else{
            api("engine:stop", {}, response => {
                this.clog(response)
            })
        }        
    }

    deleteAnalysis(){        
        IDB.delete("engine", this.board.analysiskey()).then(result => {                        
            this.board.positionchanged()
        })
    }

    moveClicked(lm, ev){
        this.board.makeMove(lm)
        if(ev.button) this.board.back()
    }

    weightChanged(index, lm, value){        
        this.board.game.makemove(lm)
        this.getcurrentnode().weights[index] = parseInt(value)
        this.board.game.back()        
        this.positionchanged()
    }

    highlightDrawings(){
        this.board.highlightDrawings()
    }

    commentChanged(value){
        this.getcurrentnode().comment = value
        this.doLater("storeDefault", STORE_DEFAULT_DELAY)
        this.doLater("highlightDrawings", HIGHLIGHT_DRAWINGS_DELAY)
    }

    gameClicked(game, ev){        
        if(ev.button){
            window.open(LICHESS_BASE_URL + "/" + game.id)
        }
        this.mergeMoveList(game.moves)
        this.tabs.selectTab("moves")
    }

    buildGames(){        
        let i = 0
        this.gamesDiv.x().a(div().miw(4000).mih(4000).pad(2).bc("#add").a(
            div().a(
                Button("Reload", this.fetchGames.bind(this)),
                div().fs(12).marl(20).dib().html(`load time ${Math.round(this.gamesLoadTime / 1000)} sec(s)`).show(this.gamesLoadTime)
            ),
            this.games.map(game => div().mart(3).bc(i++ % 2 ? "#dfdff0" : "#e0efe0").c("#00f").a(
                div()
                    .pad(1)
                    .html(game.summarypadded),
                div().marl(60).fs(12).c("#000")
                    .html(game.moves.join(" "))
            ).cp().ae("mousedown", this.gameClicked.bind(this, game)))
        ))
    }

    USER(){
        return PROPS.USER || {}
    }

    username(){
        return this.USER().id || DEFAULT_USERNAME
    }

    fetchGames(){
        this.games = []
        this.gamesLoadTime = null
        this.buildGames()
        let headers = {
            Accept: "application/x-ndjson"
        }
        let fetchStarted = performance.now()
        if(this.USER().accessToken){
            headers.Authorization = "Bearer " + this.USER().accessToken
        }        
        simpleFetch(`${LICHESS_GAMES_URL}/${this.username()}?max=${MAX_GAMES}`, {
            asNdjson: true,
            headers: headers
        }, result => {
            if(result.ok){        
                this.gamesLoadTime = performance.now() - fetchStarted
                this.games = result.content.map(game => LichessGame(game, this.username()))
                this.buildGames()
            }
        })
    }

    deleteLegalMove(lm){        
        this.board.makeMove(lm)
        this.board.del()
    }

    addLegalMove(lm, i, ev){        
        ev.preventDefault()
        this.board.makeMove(lm)
        if(i < 0) this.getcurrentnode().weights = [0, 0]
        else{
            this.getcurrentnode().weights[i] = 5        
            this.getcurrentnode().weights[1 - i] = 0
        }
        if(ev.button) this.board.back()
    }

    createNodeForLegalMove(lm){
        let priority = lm.gameNode ? lm.gameNode.priority : 0
        return div()            
            .ac(priority ? "blink_me" : "dummy")
            .ffm().dfc().a(                                
            div()
                .cp().bc(lm.gameMove ? movecolor(lm.gameNode.weights) : "#eee")
                .fw(lm.gameMove ? "bold" : "normal")
                .pad(1).mar(1).w(60).html(lm.san)
                .ae("click", this.moveClicked.bind(this, lm)),
            [0,1].map(index =>
                Combo({
                    changeCallback: this.weightChanged.bind(this, index, lm),
                    selected: lm.gameNode ? lm.gameNode.weights[index] : 0,
                    options: Array(11).fill(null).map((_,i) => ({value: i, display: i}))
                }).mar(1)
            ),
            Button("me", this.addLegalMove.bind(this, lm, 0)).bc(GREEN_BUTTON_COLOR).fs(10),
            Button("opp", this.addLegalMove.bind(this, lm, 1)).bc(YELLOW_BUTTON_COLOR).fs(10),
            Button("n", this.addLegalMove.bind(this, lm, -1)).bc(IDLE_BUTTON_COLOR).fs(10),
            Button("X", this.deleteLegalMove.bind(this, lm)).bc(RED_BUTTON_COLOR).fs(10)
        )
    }

    buildMoves(){
        let lms = this.board.getlms(RICH).sort((a,b) => a.san.localeCompare(b.san))                
        lms.sort((a,b) => (b.sortweight - a.sortweight))

        this.movesDiv.x().ame(
            div().hh(this.board.boardsize() - 5).df().a(
                div().ovfys().a(
                    lms.map(lm => this.createNodeForLegalMove(lm))
                ),
                this.analysisinfoDiv,
                this.commentTextArea = TextAreaInput({
                    text: this.getcurrentnode().comment,
                    changeCallback: this.commentChanged.bind(this)
                })
                    .fs(16).w(300),            
            ),
            this.pgnText = TextAreaInput()
                .mart(4).w(838).h(GAMETEXT_HEIGHT)
                .ae("paste", this.pgnPasted.bind(this))
            )

        this.pgnText.setValue(this.board.game.pgn())

        this.commentTextArea.focus()
    }

    mergeMoveList(moves){
        let game = Game().fromsans(moves)
        this.alert(this.board.game.merge(game))                
        this.board.positionchanged()
    }

    mergeMoveListStr(content){
        let moves = content.split(/ |\./).filter(item=>item.match(/^[a-zA-Z]/))        
        this.mergeMoveList(moves)
    }

    pgnPasted(ev){
        ev.preventDefault()
        let content = ev.clipboardData.getData('Text')        
        this.mergeMoveListStr(content)
    }

    nodeClicked(node){
        this.board.setfromnode(node)
    }

    buildTree(nodeOpt, rgbopt, depth, maxdepth){
        if(depth > maxdepth) return div().html("...")

        let def = this.getcurrentnode()
        for(let i = 0; i <  parseInt(this.settings.treeBackwardDepthCombo.selected); i++) if(def.getparent()) def = def.getparent()
        let node = nodeOpt || def
        let current = node.id == node.parentgame.currentnodeid
        let rgb = rgbopt || randrgb()        
        if(node.childids.length > 1) rgb = randrgb()

        let nodeDiv = div()
            .dfcc().mar(rgb == rgbopt ? 0 : 3)
            .ac("unselectable").bc(rgb)
            .miw(depth ? 0 : 20000)            
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

        if(current){
            this.currentNodeTreeDiv = nodeDiv
        }

        return nodeDiv
    }

    showTree(){
        seed = TREE_SEED

        this.treeDiv.x().a(
            this.buildTree(null, null, 0, this.getcurrentnode().depth + parseInt(this.settings.treeMaxDepthCombo.selected))
        )

        this.treeDiv.resize()
    }

    storeDefault(){        
        this.storeStudy("Default", this.board.game)
    }

    positionchanged(){
        this.rai = null
        this.storedrai = null
        this.board.clearanalysisinfo()
        this.showAnalysisinfo()

        if(this.shouldGo){            
            this.go()
        }else{
            IDB.get("engine", this.board.analysiskey()).then(dbResult => {
                if(dbResult.hasContent){                    
                    this.storedrai = new RichAnalysisInfo(dbResult.content)
                    this.showAnalysisinfo()
                }
            })
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

        if(elapsed > ( 2 * QUERY_INTERVAL ) ){
            this.clog(`event source timed out, setting up new`)

            this.lasttick = performance.now()

            this.setupsource()
        }
    }

    setupsource(){
        this.clog(`setting up event source with interval ${QUERY_INTERVAL} ms`)        

        this.source = new EventSource('/stream')

        this.source.addEventListener('message', e => {
            let analysisinfo = JSON.parse(e.data)
            if(analysisinfo.kind == "tick"){
                this.lasttick = performance.now()
            }else{
                this.processanalysisinfo(analysisinfo)
            }            
        }, false)

        this.source.addEventListener('open', _ => {            
            this.clog("connection opened")
        }, false)

        this.source.addEventListener('error', e => {
            if (e.readyState == EventSource.CLOSED) {                
                this.clog("connection closed")
            }
        }, false)

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
            game: game.serialize()
        })
    }

    alert(msg){
        this.alertDiv.show(true).html(msg)

        setTimeout(() => {
            this.alertDiv.show(false)
        }, ALERT_DELAY)
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
                                Button(`Add to frame`, this.addImageToFrame.bind(this, item.name)).bc(GREEN_BUTTON_COLOR),
                                Button(`Delete ${item.name}`, this.deleteImage.bind(this, item.name)).bc(RED_BUTTON_COLOR),
                                Img({src: item.imgsrc, width: THUMB_SIZE, height: THUMB_SIZE})
                            )
                        )
                    )
                )
            }
        })
    }

    getcurrentnode(){
        return this.board.getcurrentnode()
    }

    addImageToFrame(name){
        this.getcurrentnode().addImageToComment(name, 10000)
        this.positionchanged()
    }

    uploadImage(content, nameorig){
        let canvas = this.board.getCanvasByName("dragpiece")

        canvas.drawImageFromSrc(content, Vect(80, 120)).then(() => {                    
            let offername = nameorig.replace(REMOVE_IMAGE_EXTENSION_REGEXP, "")
            let name = window.prompt("Image name : ", offername)

            IDB.put("image", {
                name: name,
                imgsrc: content
            }).then(result => {
                if(result.ok){
                    this.alert(`Image ${name} stored.`)
                    this.showImages()
                    setTimeout(function(){canvas.clear()}.bind(this), ALERT_DELAY)
                }else{
                    this.alert(`Storing image ${name} failed.`)
                }
            })  
        })
    }

    dropImages(files){
        let file = files[0]

        readFile(file, "readAsDataURL").then(event => {
            let content = event.target.result            
            this.uploadImage(content, file.name)
        })  
    }

    imageDropped(ev){
        this.dropImages(ev.dataTransfer.files)
    }

    addAnimationCallback(){                
        let [ value, display ] = [
            this.board.game.currentnodeid + "_" + UID(),
            "Animation " + this.board.game.line()
        ]

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
        return [
            this.board.game.currentnodeid,
            "root " + this.board.game.line()
        ]
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
        let props = this.getcurrentnode().props()

        let canvas = Canvas({width: 2 * bs, height: bs})

        canvas.fillStyle("#FFFFFF")
        canvas.fillRect(Vect(0,0), Vect(2*bs,bs))
        
        canvas.ctx.drawImage(this.board.getCanvasByName("background").e, 0, 0)
        canvas.ctx.globalAlpha = 0.3
        canvas.ctx.drawImage(this.board.getCanvasByName("square").e, 0, 0)
        canvas.ctx.globalAlpha = 1
        if(this.settings.highlightanimationmovesCheckbox.checked)
            canvas.ctx.drawImage(this.board.getCanvasByName("highlight").e, 0, 0)
        canvas.ctx.drawImage(this.board.getCanvasByName("piece").e, 0, 0)
        canvas.ctx.drawImage(this.board.getCanvasByName("drawings").e, 0, 0)

        let finalizefunc = _ => {
            canvas.ctx.drawImage(this.board.commentcanvas.e, bs, 0)

            canvas.ctx.textBaseline = "top"            
            this.commentfontsize = bs / 12
            this.commentmargin = this.commentfontsize / 3            
            canvas.ctx.font = `${this.commentfontsize / 1.5}px serif`
            canvas.ctx.fillStyle = "#00FF00"                

            canvas.renderText("animation created by", bs - 2 * this.commentmargin, this.commentfontsize * 1.1, bs + this.commentmargin, bs - 2 * this.commentfontsize/1.1)

            canvas.ctx.font = `${this.commentfontsize / 1.3}px serif`
            canvas.ctx.fillStyle = "#0000FF"                

            canvas.renderText("https://easychess.herokuapp.com", bs - 2 * this.commentmargin, this.commentfontsize * 1.1, bs + this.commentmargin, bs - this.commentfontsize)

            this.gif.addFrame(canvas.e, {delay: props.delay || DEFAULT_FRAME_DELAY})

            resolve(true)
        }

        let drawings = this.getcurrentnode().drawings()

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
        this.createBackupBlob().then(blob => {
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
        
        readFile(file, "readAsText").then(event => {
            let content = event.target.result            
            this.setFromBackup(content)
        })
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

    lichess(){
        let url = `${LICHESS_ANALYSIS_URL}/${this.board.game.variant}/${this.board.game.fen()}`
        window.open(url)
    }

    constructor(props){
        super("div", props)

        this.settings = {}

        this.engine = new LocalEngine(this.processanalysisinfo.bind(this))

        this.board = Board({
            id: "mainboard",            
            squaresize: parseInt(getLocal("app/maintabpane/squaresizeCombo", {selected: DEFAULT_SQUARESIZE}).selected),
            positionchangedcallback: this.positionchanged.bind(this)
        })

        this.mainPane = SplitPane({row: true, fitViewPort: true, headsize: this.board.boardsize()}).por(),            

        this.alertDiv = div()
            .poa().t(50).l(50).show(false).bc("#ffa")
            .bdr("solid", 5, "#777", 10).w(600).pad(10).zi(1000).tac()

        this.mainPane.a(this.alertDiv)

        this.movesDiv = div()

        this.analysisinfoDiv = div().w(260).ovfs()

        this.treeDiv = div()

        this.treeDiv.resize = function(width, height){                        
            if(this.currentNodeTreeDiv) setTimeout(() => this.currentNodeTreeDiv.siv({block: "center", inline: "center"}), 0)
        }.bind(this)

        this.imageDiv = div()
            .dfca().flww().ac("unselectable")
            .dropLogic(this.imageDropped.bind(this))

        this.authDiv = div().a(
            div().mar(5).a(                
                Button("Login with lichess", this.loginWithLichess.bind(this)),
                Button("Set Password", this.setPassword.bind(this))                
            )            
        )

        if(PROPS.USER){
            this.authDiv.a(
                table().marl(5).sa("cellpadding", 10).sa("border", 1).a(
                    Object.entries(PROPS.USER._json.perfs).map(perf => tr().a(
                        td().html(perf[0]).c("#00f"),
                        td().html(perf[1].games).c("#707").fwb(),
                        td().html(perf[1].rating).c("#070").fwb(),
                        td().html(perf[1].rd).c("#770").fwb()
                )))
            )
        }

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
            div()
                .mar(5)
                .a(
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

        this.settingsDiv = div().a(FormTable({
            options: [
                CheckBoxInput({
                    id: "uselocalstockfishCheckbox",                    
                    display: "Use local Stockfish",                                        
                    settings: this.settings
                }),
                Combo({                    
                    id: "multipvCombo",                    
                    display: "MultiPV",                                        
                    options: Array(20).fill(null).map((_, i) => ({value: i+1, display: i+1})),
                    selected: DEFAULT_MULTIPV,
                    settings: this.settings
                }),
                Combo({                    
                    id: "threadsCombo",                    
                    display: "Threads",                    
                    options: Array(10).fill(null).map((_, i) => ({value: i+1, display: i+1})),
                    selected: DEFAULT_THREADS,
                    settings: this.settings
                }),
                CheckBoxInput({
                    id: "highlightanimationmovesCheckbox",                    
                    display: "Highlight animation moves",                                        
                    settings: this.settings
                }),
                Combo({                    
                    id: "squaresizeCombo",                    
                    display: "Square size",                    
                    options: Array(11).fill(null).map((_, i) => ({value: 30 + i*5, display: 30 + i*5})),
                    selected: DEFAULT_SQUARESIZE,
                    settings: this.settings
                }),
                Combo({                    
                    id: "treeMaxDepthCombo",                    
                    display: "Tree max depth",                    
                    options: Array(20).fill(null).map((_, i) => ({value: i+1, display: i+1})),
                    selected: TREE_MAX_DEPTH,
                    settings: this.settings
                }),
                Combo({                    
                    id: "treeBackwardDepthCombo",                    
                    display: "Tree backward depth",                    
                    options: Array(20).fill(null).map((_, i) => ({value: i+1, display: i+1})),
                    selected: TREE_BACKWARD_DEPTH,
                    settings: this.settings
                }),
            ]
        }))

        this.aboutDiv = div().a(div(), div().marl(20).html(md2html(PROPS.readme)))

        this.gamesDiv = div().fs(16).ffm()

        this.gamesTabPane = TabPane({id: "gamestabpane"}).setTabs([
            Tab({id: "games", caption: "Fresh games", content: this.gamesDiv}),
        ])

        this.gamesTabPane.headDiv.bc("#eee")

        this.tabs = TabPane({id: "maintabpane"}).setTabs([
            Tab({id: "moves", caption: "Moves", content: this.movesDiv}),            
            Tab({id: "tree", caption: "Tree", content: this.treeDiv}),
            Tab({id: "games", caption: "Games", content: this.gamesTabPane}),
            Tab({id: "images", caption: "Images", content: this.imageDiv}),
            Tab({id: "anims", caption: "Animations", content: this.animsDiv}),
            Tab({id: "backup", caption: "Backup", content: this.backupDiv}),            
            Tab({id: "settings", caption: "Settings", content: this.settingsDiv}),
            Tab({id: "about", caption: "About", content: this.aboutDiv}),
            Tab({id: "auth", caption: username, content: this.authDiv}),            
        ])

        this.mainPane.headDiv.jc("flex-start").a(div().dfcc().a(
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
                    this.gobutton = Button("Go", this.go.bind(this)).bc(GREEN_BUTTON_COLOR),
                    this.stopbutton = Button("Stop", this.stop.bind(this)).bc(IDLE_BUTTON_COLOR),
                    this.lichessbutton = Button("L", this.lichess.bind(this)).bc(YELLOW_BUTTON_COLOR),
                    this.commandInput = TextInput().w(60).ae("keyup", this.commandChanged.bind(this),
                )
            ),
            this.gametext = TextAreaInput()
                .w(this.board.boardsize() - 12)
                .h(GAMETEXT_HEIGHT + scrollBarSize())
        ))

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

        this.fetchGames()
    }

    initgif(){
        this.gif = new GIF({
            workers: 2,
            quality: 10
        })
    
        this.gif.on('finished', function(blob) {
            window.open(URL.createObjectURL(blob))
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
