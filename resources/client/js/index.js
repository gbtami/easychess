let app = div({id: "app"}).a(
    div({id:"greendiv"}).w(200).h(200).bc("#afa").a(
        div({id: "content"}).html("content")
    )
)

document.getElementById('root').appendChild(app.e)

console.log(allNodes)