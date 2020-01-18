class App extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.am(
            this.board = Board()
        )
    }
}

let app = new App({id: "app"})

document.getElementById('root').appendChild(app.e)
