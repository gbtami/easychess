const STOCKFISH_JS_PATH = "resources/client/cdn/stockfish.wasm.js"

const QUERY_INTERVAL = PROPS.QUERY_INTERVAL || 3000

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

        this.gobutton.bc(this.rai.running ? "#eee" : "#afa")
        this.stopbutton.bc(this.rai.running ? "#faa" : "#eee")

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
            api("engine:go", payload, (response)=>{
                this.clog(response)
            })
        }
    }

    stop(){
        this.shouldGo = false

        if(this.settings.uselocalstockfishcheckbox.checked){
            this.engine.setcommand("stop")
        }else{
            api("engine:stop", {}, (response)=>{
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
        this.doLater("storeDefault", 1000)
        this.doLater("highlightDrawings", 250)
    }

    buildMoves(){
        let lms = this.board.getlms(RICH).sort((a,b)=>a.san.localeCompare(b.san))                
        lms.sort((a,b)=>( ( b.gameMove - a.gameMove ) * 100 + ( b.weights[0] - a.weights[0] ) * 10 + ( b.weights[1] - a.weights[1] ) ))
        this.movesDiv.x().ame(div().hh(this.board.boardsize()).df().a(
            div().ovfys().a(
                lms.map(lm=>div().ffm().dfc().a(                                
                    div().cp().bc(lm.gameMove ? "#ccf" : "#eee").fw(lm.gameMove ? "bold" : "normal")
                    .pad(1).mar(1).w(60).html(lm.san)
                    .ae("click", this.moveClicked.bind(this, lm)),
                    ([0,1].map(index=>
                        Combo({
                            changeCallback: this.weightChanged.bind(this, index, lm),
                            selected: lm.gameNode ? lm.gameNode.weights[index] : 0,
                            options: Array(11).fill(null).map((_,i)=>({value: i, display: i}))
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
        return div().ac("unselectable").mar(rgb == rgbopt ? 0 : 3).bc(rgb).dfcc().a(
            div().w(60).cp().pad(2).bdr("solid", 3, current ? "#0f0" : "#ddd")
            .mar(1).bc(node.gensan ? node.turn() ? "#000" : "#fff" : "#070")
            .c(node.turn() ? "#fff" : "#000").tac()
            .html(node.gensan ? `${node.fullmovenumber()}. ${node.gensan}` : "root").
            ae("click", this.nodeClicked.bind(this, node)),
            div().df().a(
                node.sortedchilds().map((child)=>
                    this.buildTree(child, rgb, depth + 1, maxdepth)
                )
            )
        )        
    }

    showTree(){
        seed = 10
        this.treeDiv.x().a(this.buildTree(null, null, 0, 10))
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
                (dbResult=>{
                    if(dbResult.hasContent){
                        this.rai = new RichAnalysisInfo(dbResult.content)
                        this.showanalysisinfo()
                    }
                })
            )
        }

        this.doLater("buildMoves", 500)
        this.doLater("showTree", 500)
        this.doLater("buildAnimsDiv", 500)

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
        IDB.get("study", study).then(result=>{            
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
        setTimeout(()=>{this.alertDiv.show(false)}, 3000)
    }

    deleteImage(name){
        IDB.delete("image", name).then(_=>this.showImages())
    }

    showImages(){
        this.imageDiv.x().a(div().marl(10).mart(6).html("Images loading ..."))
        IDB.getAll("image").then(result=>{
            if(result.ok){
                this.imageDiv.x().a(
                    result.content.map(item=>
                        div().mar(3).dib().pad(3).bc("#aff").a(
                            div().dfcc().a(
                                div().html(item.name),
                                Button(`Delete ${item.name}`, this.deleteImage.bind(this, item.name)).mar(5),
                                Img({src: item.imgsrc, width: 150, height: 150})
                            )
                        )
                    )
                )
            }
        })
    }

    uploadimage(content, nameorig){
        let canvas = this.board.getCanvasByName("dragpiece")
        let img = Img()                
        img.e.onload = ()=>{                    
            canvas.ctx.drawImage(img.e, 0, 0)        
            let offername = nameorig.replace(/\.JPG$|\.PNG$|\.GIF$/i, "")
            let name = window.prompt("Image name :", offername)
            IDB.put("image", {
                name: name,
                imgsrc: content
            }).then(result => {
                if(result.ok){
                    this.alert(`Image ${name} stored.`)
                    this.showImages()
                    setTimeout(function(){canvas.clear()}.bind(this), 3000)
                }else{
                    this.alert(`Storing image ${name} failed.`)
                }
            })  
        }
        img.src = content                
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

    handleEvent(sev){
        if(sev.do == "dragimage"){
            switch(sev.kind){
                case "dragenter":
                case "dragover":
                    sev.ev.preventDefault()
                    this.imageDiv.dfca().flww().bc("#777")
                    break
                case "dragleave":
                    this.imageDiv.bc("#777")
                    break
                case "drop":
                    sev.ev.preventDefault()                    
                    this.imageDiv.bc("#777")
                    this.dropImages(sev.ev.dataTransfer.files)
                    break
            }
        }
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
        this.doLater("storeDefault", 1000)
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
                forceZIndex: 10
            }).mar(10)

            this.animsDiv.a(
                this.selAnimEditableList
            )
        }

        this.animsDiv.ame()
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

        this.alertDiv = div().poa().t(50).l(50).show(false).bc("#ffa")
        .bdr("solid", 5, "#777", 10).w(600).pad(10).zi(1000).tac()

        this.mainPane.a(this.alertDiv)

        this.movesDiv = div()
        this.treeDiv = div()
        this.imageDiv = div({ev: "dragenter dragover dragleave drop", do: "dragimage"}).bc("#999")

        this.imageDiv.resize = function(width, height){                        
            this.w(width - 20).mih(height - 20)
        }.bind(this.imageDiv)

        this.movesDiv.resize = function(width, height){                        
            this.buildMoves()
        }.bind(this)

        this.animsDiv = div()

        this.tabs = TabPane({id: "maintabpane"}).setTabs([
            Tab({id: "moves", caption: "Moves", content: this.movesDiv}),
            Tab({id: "tree", caption: "Tree", content: this.treeDiv}),
            Tab({id: "images", caption: "Images", content: this.imageDiv}),
            Tab({id: "anims", caption: "Animations", content: this.animsDiv})
        ])

        this.mainPane.headDiv.a(
            this.board,
            this.controlPanel = div().mar(3).marl(0).w(this.board.boardsize() - 6).pad(3).bc("#cca").a(
                Button("i", this.board.reset.bind(this.board)).ff("lichess").bc("#faa"),
                Button("B", this.board.doflip.bind(this.board)).ff("lichess").bc("#aff"),
                Button("W", this.board.tobegin.bind(this.board)).ff("lichess").bc("#aaf"),                
                Button("Y", this.board.back.bind(this.board)).ff("lichess").bc("#afa"),
                Button("X", this.board.forward.bind(this.board)).ff("lichess").bc("#afa"),
                Button("V", this.board.toend.bind(this.board)).ff("lichess").bc("#aaf"),
                Button("L", this.board.del.bind(this.board)).ff("lichess").bc("#faa"),
                CheckBoxInput({id: "uselocalstockfishcheckbox", settings: this.settings}),
                this.gobutton = Button("Go", this.go.bind(this)).bc("#afa"),
                this.stopbutton = Button("Stop", this.stop.bind(this)).bc("#eee")
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
    }
}

initDb().then(
    _ => {
        let app = new App({id: "app"})

        document.getElementById('root').appendChild(app.e)

        app.clog(app)
    },
    err => {
        console.log(err.content)
    }
)
