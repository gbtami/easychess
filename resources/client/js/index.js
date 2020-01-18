class App extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.am(
            this.board = Board({id: "mainboard"}),
            this.controlPanel = div().mar(3).marl(0).w(this.board.boardsize() - 6).pad(3).bc("#cca").a(
                Button("Flip", this.board.doflip.bind(this.board)),
                Button("<", this.board.back.bind(this.board)),
                Button(">", this.board.forward.bind(this.board)),
                Button("X", this.board.del.bind(this.board))
            )
        )
    }
}

let app = new App({id: "app"})

document.getElementById('root').appendChild(app.e)
