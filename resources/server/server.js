const express = require('express')
const path = require('path')

const { readJson } = require('../utils/rwjson')

const app = express()

const PORT = process.env.PORT || 3000

function IS_DEV(){
    return !!process.env.EASYCHESS_DEV
}

const __rootdirname = path.join(__dirname, '../..')

let clientScripts = readJson('resources/conf/clientscripts.json')[IS_DEV() ? "dev" : "prod"]
let versionInfo = readJson('resources/conf/versioninfo.json')

let loadScripts = clientScripts.map(script=>`<script src='${script}?ver=${versionInfo[script].mtime}'></script>`).join("\n")

app.use(express.static(__rootdirname))

const PROPS = {
    IS_DEV: IS_DEV()
}

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html lang="en">

    <head>

        <meta charset="utf-8">
        <title>Easy Chess</title>    

        <script>
        const PROPS = ${JSON.stringify(PROPS, null, 2)}
        </script>

        ${loadScripts}

    </head>

    <body>    

        <div id="root"></div>

        <script src='resources/client/js/index.js?ver=${versionInfo['resources/client/js/index.js'].mtime}'></script>

    </body>

</html>
`))

app.listen(PORT, () => console.log(`easychess server serving from < ${__rootdirname} > listening on port < ${PORT} >!`))
