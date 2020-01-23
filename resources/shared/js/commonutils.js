const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

if(typeof module != "undefined") if(typeof module.exports != "undefined"){
    module.exports.SECOND = SECOND
    module.exports.MINUTE = MINUTE
    module.exports.HOUR = HOUR
    module.exports.DAY = DAY
}
