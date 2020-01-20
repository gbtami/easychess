const RICH = true

class Board_ extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.squaresize = this.props.squaresize || 60        

        this.squareopacity = this.props.squareopacity || 0.3

        this.positionchangedcallback = this.props.positionchangedcallback

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
            div().w(this.boardsize()).h(this.boardsize()).por().a(
                this.canvases,
                div({ev: "dragstart mousemove mouseup", do: "dragpiece"}).w(this.boardsize()).h(this.boardsize()).poa().drgb()
            )            
        )

        this.draw()
    }

    reset(){
        this.game.reset()
        this.positionchanged()
    }

    coordstosq(coords){return this.fasq(Square(Math.floor(coords.x / this.squaresize), Math.floor(coords.y / this.squaresize)))}

    clearPiece(sq){                    
        this.getCanvasByName("piece").clearRect(this.piececoords(sq), Vect(this.piecesize(), this.piecesize()))        
    }

    getlms(RICH){
        let lms = this.game.board.legalmovesforallpieces()
        if(RICH) lms.forEach(lm=>{
            lm.san = this.game.board.movetosan(lm)
            lm.gameNode = this.game.getcurrentnode().sortedchilds().find(child=>child.gensan == lm.san)
            lm.gameMove = lm.gameNode ? 1 : 0
            lm.weights = lm.gameNode ? lm.gameNode.weights : [0,0]
        })
        return lms
    }

    makeMove(move){
        this.game.makemove(move)
        this.positionchanged()
    }

    handleEvent(sev){
        if(sev.do == "dragpiece"){
            switch(sev.kind){
                case "dragstart":
                    sev.ev.preventDefault()                        
                    let bcr = this.getCanvasByName("dragpiece").e.getBoundingClientRect()
                    this.piecedragorig = Vect(sev.ev.clientX - bcr.x, sev.ev.clientY - bcr.y)        
                    this.draggedsq = this.coordstosq(this.piecedragorig)        
                    this.draggedpiece = this.game.board.pieceatsquare(this.draggedsq)
                    if(!this.draggedpiece.isempty()){
                        this.draggedpiececoords = this.piececoords(this.draggedsq)        
                        this.clearPiece(this.draggedsq)
                        this.piecedragon = true            
                    }        
                    break
                case "mousemove":
                    if(this.piecedragon){
                        let bcr = this.getCanvasByName("dragpiece").e.getBoundingClientRect()
                        this.piecedragvect = Vect(sev.ev.clientX - bcr.x, sev.ev.clientY - bcr.y)
                        this.piecedragdiff = this.piecedragvect.m(this.piecedragorig)
                        this.dragtargetsq = this.coordstosq(this.piecedragvect)            
                        
                        let dragpiececanvas = this.getCanvasByName("dragpiece")
                        dragpiececanvas.clear()
                        this.drawPiece(dragpiececanvas, this.draggedpiececoords.p(this.piecedragdiff), this.draggedpiece)
                    }
                    break
                case "mouseup":
                    if(this.piecedragon){
                        let dragpiececanvas = this.getCanvasByName("dragpiece")

                        dragpiececanvas.clear()            

                        this.drawPiece(dragpiececanvas, this.piececoords(this.fasq(this.dragtargetsq)), this.draggedpiece)
            
                        let move = Move(this.draggedsq, this.dragtargetsq)
                        
                        let valid = this.getlms().find((testmove)=>testmove.roughlyequalto(move))

                        if(valid){
                            this.makeMove(valid)
                        }else{
                            this.draw()
                        }

                        this.piecedragon = false
                    }
                    break
            }
        }
    }

    positionchanged(){
        this.draw()

        if(this.positionchangedcallback) this.positionchangedcallback()
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

    arrowscalefactor(){
        return this.boardsize() / 560
    }

    drawmovearrow(canvas, move, argsopt){
        canvas.arrow(
            this.squaremiddlecoords(move.fromsq),
            this.squaremiddlecoords(move.tosq),
            argsopt
        )
    }

    clearanalysisinfo(){
        let analysiscanvas = this.getCanvasByName("analysis")
        analysiscanvas.clear()
        return analysiscanvas
    }

    squaremiddlecoords(sq){
        return Vect(this.fasq(sq).file, this.fasq(sq).rank).s(this.squaresize).p(Vect(this.squaresize/2, this.squaresize/2))
    }

    analysiskey(){        
        return `analysis/${this.game.variant}/${strippedfen(this.game.getcurrentnode().fen)}`
    }

    highlightrichanalysisinfo(richanalysisinfo){        
        let analysisinfo = richanalysisinfo.analysisinfo
        let analysiscanvas = this.clearanalysisinfo()
        if(analysisinfo.analysiskey != this.analysiskey()) return
        let i = analysisinfo.summary.length        
        for(let item of analysisinfo.summary.slice().reverse()){
            this.drawmovearrow(analysiscanvas, item.move, {
                scalefactor: this.arrowscalefactor(),
                auxscalefactor: 1/i--,
                color: scoretorgb(item.scorenumerical)
            })      
        }
    }

    draw(){
        this.getCanvasByName("dragpiece").clear()

        this.drawSquares()

        this.drawPieces()
    }

    tobegin(){
        this.game.tobegin()
        this.positionchanged()
    }

    back(){
        this.game.back()
        this.positionchanged()
    }

    forward(){
        this.game.forward()
        this.positionchanged()
    }

    toend(){
        this.game.toend()
        this.positionchanged()
    }

    del(){
        this.game.del()
        this.positionchanged()
    }
}
function Board(props){return new Board_(props)}
