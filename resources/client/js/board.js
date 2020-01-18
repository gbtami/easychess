class Board_ extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.squaresize = this.props.squaresize || 60        

        this.squareopacity = this.props.squareopacity || 0.3

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
        let backgroundcanvas = this.getCanvasByName("background")

        backgroundcanvas.loadBackgroundImage('resources/client/img/backgrounds/wood.jpg')

        let squarecanvas = this.getCanvasByName("square").op(this.squareopacity)
        
        for(let sq of ALL_SQUARES){
            squarecanvas.fillStyle(this.squarelight(sq) ? "#eed" : "#aab")
            let sqcoords = this.squarecoords(sq)
            squarecanvas.fillRect(sqcoords, Vect(this.squaresize, this.squaresize))
        }        
    }

    piecesize(){return this.squaresize * 0.85}

    drawPiece(canvas, coords, p){                
        const klasssel = "." + getclassforpiece(p, this.piecestyle)                                                    
        let img
        if(!this.imgcache) this.imgcache = {}
        if(this.imgcache[klasssel]){
            img = this.imgcache[klasssel]
            canvas.ctx.drawImage(img.e, coords.x, coords.y, this.piecesize(), this.piecesize())
        }else{
            let style = getStyle(klasssel)            
            let imgurl = style.match(/url\("(.*?)"/)[1]                
            let imgurlparts = imgurl.split(",")
            let svgb64 = imgurlparts[1]
            let svg = atob(svgb64)
            let newsvg = svg.replace(/^<svg/, `<svg width="${this.piecesize()}" height="${this.piecesize()}"`)
            let newsvgb64 = btoa(newsvg)
            let newimgurl = imgurlparts[0] + "," + newsvgb64            
            let img = Img({width: this.piecesize(), height: this.piecesize()})                            
            let fen = this.game.fen()
            img.e.onload = ()=>{
                if(this.game.fen() == fen){
                    canvas.ctx.drawImage(img.e, coords.x, coords.y, this.piecesize(), this.piecesize())
                }                
                this.imgcache[klasssel] = img                
            }
            img.e.src = newimgurl                                                        
        }   
    }

    drawPieces(){                        
        let piececanvas = this.getCanvasByName("piece")
        piececanvas.clear()
        for(let sq of ALL_SQUARES){
            let p = this.game.board.pieceatsquare(sq)
            if(!p.isempty()){                
                let pc = this.piececoords(sq)
                this.drawPiece(piececanvas, pc, p)
            }
        }
    }

    draw(){
        this.drawSquares()

        this.drawPieces()
    }
}
function Board(props){return new Board_(props)}
