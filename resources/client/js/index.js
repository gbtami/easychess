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

    buildMoves(){
        let lms = this.board.getlms(RICH).sort((a,b)=>a.san.localeCompare(b.san))                
        lms.sort((a,b)=>( ( b.gameMove - a.gameMove ) * 100 + ( b.weights[0] - a.weights[0] ) * 10 + ( b.weights[1] - a.weights[1] ) ))
        this.movesDiv.x().ame(
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
        )
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

        this.storeStudy("Default", this.board.game.serialize())
    }

    clog(msg){
        if(IS_DEV()) console.log(msg)
    }

    setupsource(){
        this.clog(`setting up event source with interval ${QUERY_INTERVAL} ms`)        

        this.source = new EventSource('/stream')

        this.source.addEventListener('message', function(e){
            let analysisinfo = JSON.parse(e.data)
            if(analysisinfo == "tick"){
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

    constructor(props){
        super("div", props)

        this.settings = {}

        this.engine = new LocalEngine(this.processanalysisinfo.bind(this))

        this.board = Board({
            id: "mainboard",            
            positionchangedcallback: this.positionchanged.bind(this)
        })

        this.mainPane = SplitPane({row: true, fitViewPort: true, headsize: this.board.boardsize()}),            

        this.movesDiv = div()
        this.treeDiv = div()

        this.tabs = TabPane({id: "maintabpane"}).setTabs([
            Tab({id: "moves", caption: "Moves", content: this.movesDiv}),
            Tab({id: "tree", caption: "Tree", content: this.treeDiv}),
            Tab({id: "anims", caption: "Animations", content: div().html("ANIMATIONS")})
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

        this.mainPane.setContent(
            this.tabs
        )

        this.am(
            this.mainPane
        )

        this.setupsource()        

        this.loadStudy("Default")

        this.positionchanged()
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
