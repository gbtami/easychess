class Board_ extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.squaresize = this.props.squaresize || 60        

        this.game = Game({variant: this.props.variant || DEFAULT_VARIANT}).setfromfen()        

        this.canvasnames = [
            "background",
            "square",
            "highlight",
            "weights",
            "analysis",
            "drawings",
            "piece",
            "dragpiece",
            "gif"
        ]
    }

    init(){
        this.x()

        this.canvases = this.canvasnames.map(cn=>
            Canvas({width: this.boardsize(), height: this.boardsize()}).poa()
        )

        this.a(
            div().por().a(
                this.canvases
            )            
        )

        this.draw()
    }

    positionchanged(){

    }

    doflip(){
        this.game.flip = !this.game.flip        
        this.positionchanged()
    }

    fasq(sq){
        if(this.game.flip) return Square(LAST_SQUARE - sq.file, LAST_SQUARE - sq.rank)
        return sq
    }

    boardsize(){
        return this.squaresize * NUM_SQUARES
    }

    setgame(game){
        this.game = game        
        this.positionchanged()
        return this
    }

    squarelight(sq){return ( ( sq.file + sq.rank ) % 2 ) == 0}

    piecemargin(){return ( this.squaresize - this.piecesize() ) / 2}

    squarecoords(sq){
        return Vect(sq.file * this.squaresize, sq.rank * this.squaresize)
    }

    piececoords(sq){
        let sc = this.squarecoords(this.fasq(sq))
        return Vect(sc.x + this.piecemargin(), sc.y + this.piecemargin())
    }

    getCanvasByName(name){
        return this.canvases[this.canvasnames.findIndex(canvasName=>name == canvasName)]
    }

    drawSquares(){        
        let squarecanvas = this.getCanvasByName("square")
        
        for(let sq of ALL_SQUARES){
            squarecanvas.fillStyle(this.squarelight(sq) ? "#eed" : "#aab")
            let sqcoords = this.squarecoords(sq)
            squarecanvas.fillRect(sqcoords, Vect(this.squaresize, this.squaresize))
        }        
    }

    draw(){
        this.drawSquares()
    }
}
function Board(props){return new Board_(props)}
