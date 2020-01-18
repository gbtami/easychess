let app = div({id: "app"}).am(
    div().w(200).h(200).bc("#afa").a(
        div({id: "content"}).html("content")
    )
)

for(let entry of Object.entries(allNodes)){
    console.log(entry[1].path(ALLOW_NON_ID))
}

console.log(app.allChilds())

document.getElementById('root').appendChild(app.e)
