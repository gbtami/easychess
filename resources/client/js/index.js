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

        this.am(
            this.board = Board({
                id: "mainboard",
                positionchangedcallback: this.positionchanged.bind(this)
            }),
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
