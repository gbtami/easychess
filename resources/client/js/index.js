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
    processanalysisinfo(analysisinfo){
        this.rai = new RichAnalysisInfo(analysisinfo)
        this.gametext.setValue(this.rai.asText())
        this.board.highlightrichanalysisinfo(this.rai)

        this.gobutton.bc(this.rai.running ? "#eee" : "#afa")
        this.stopbutton.bc(this.rai.running ? "#faa" : "#eee")
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
        if(this.shouldGo){
            this.stop()
            this.go()
        }
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
                Button("Flip", this.board.doflip.bind(this.board)),
                Button("<", this.board.back.bind(this.board)),
                Button(">", this.board.forward.bind(this.board)),
                Button("X", this.board.del.bind(this.board)),
                this.gobutton = Button("Go", this.go.bind(this)).bc("#afa"),
                this.stopbutton = Button("Stop", this.stop.bind(this)).bc("#eee")
            ),
            this.gametext = TextAreaInput().w(this.board.boardsize() - 6).h(120)
        )
    }
}

let app = new App({id: "app"})

document.getElementById('root').appendChild(app.e)
