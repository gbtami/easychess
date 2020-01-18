class App extends SmartDomElement{
    constructor(props){
        super("div", props)

        this.am(
            EditableList({id: "templates", width: 800, isContainer: true})
        )
    }
}

let app = new App({id: "app"})

document.getElementById('root').appendChild(app.e)
