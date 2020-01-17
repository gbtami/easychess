const express = require('express')

const app = express()

const PORT = process.env.PORT || 3000

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

app.listen(PORT, () => console.log(`easychess server listening on port ${PORT}!`))
