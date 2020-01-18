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
        this.gametext.setValue(`depth ${analysisinfo.lastcompleteddepth} nps ${analysisinfo.nps || "0"}\n\n${analysisinfo.summary.map(item=>item.pvsans[0].padEnd(8, " ") + " " + item.scorenumerical.toString().padEnd(8, " ") + "-> " + item.pvsans.slice(1, Math.min(item.pvsans.length, 6)).join(" ")).join("\n")}`)
    }

    go(){
        this.engine.setcommand("go", {
            multipv: 5,
            fen: this.board.game.fen()
        })
    }

    stop(){
        this.engine.setcommand("stop")
    }

    constructor(props){
        super("div", props)

        this.engine = new LocalEngine(this.processanalysisinfo.bind(this))

        this.am(
            this.board = Board({id: "mainboard"}),
            this.controlPanel = div().mar(3).marl(0).w(this.board.boardsize() - 6).pad(3).bc("#cca").a(
                Button("Flip", this.board.doflip.bind(this.board)),
                Button("<", this.board.back.bind(this.board)),
                Button(">", this.board.forward.bind(this.board)),
                Button("X", this.board.del.bind(this.board)),
                Button("Go", this.go.bind(this)),
                Button("Stop", this.stop.bind(this))
            ),
            this.gametext = TextAreaInput().w(this.board.boardsize() - 6).h(120)
        )
    }
}

let app = new App({id: "app"})

document.getElementById('root').appendChild(app.e)
