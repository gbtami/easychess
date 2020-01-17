const express = require('express')
const path = require('path')

const app = express()

const PORT = process.env.PORT || 3000

const __rootdirname = path.join(__dirname, '../..')

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html lang="en">

    <head>

        <meta charset="utf-8">
        <title>Easy Chess</title>    

    </head>

    <body>    



    </body>

</html>
`))

app.listen(PORT, () => console.log(`easychess server serving from < ${__rootdirname} > listening on port < ${PORT} >!`))
