class LocalEngine extends AbstractEngine{
    constructor(sendanalysisinfo){
        super(sendanalysisinfo)
    }

    spawnengineprocess(){
        this.stockfish = new Worker("resources/client/cdn/stockfish.js")

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
        this.rai = new RichAnalysisInfo(analysisinfo)
        
        this.showanalysisinfo()

        this.gobutton.bc(this.rai.running ? "#eee" : "#afa")
        this.stopbutton.bc(this.rai.running ? "#faa" : "#eee")

        IDB.put("engine", this.rai.analysisinfo)
    }

    go(){
        this.shouldGo = true

        this.engine.setcommand("go", {
            multipv: 5,
            fen: this.board.game.fen()
        })
    }

    stop(){
        this.shouldGo = false

        this.engine.setcommand("stop")
    }

    positionchanged(){
        this.board.clearanalysisinfo()

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

        IDB.put("study", {
            title: "Default",
            game: this.board.game.serialize()
        })
    }

    constructor(props){
        super("div", props)

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
                this.gobutton = Button("Go", this.go.bind(this)).bc("#afa"),
                this.stopbutton = Button("Stop", this.stop.bind(this)).bc("#eee")
            ),
            this.gametext = TextAreaInput().w(this.board.boardsize() - 6).h(120)
        )
    }
}

initDb().then(
    _ => {
        let app = new App({id: "app"})

        document.getElementById('root').appendChild(app.e)

        IDB.getAlls(["engine", "study"]).then(
            dbResult=>{
                console.log(dbResult)
            }
        )
    },
    err => {
        console.log(err.content)
    }
)
