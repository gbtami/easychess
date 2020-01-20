const DATABASE_NAME = "rechessdb"

const DB_OK = true
const DB_FAILED = false

const OBJECT_STORES = [
    {name: "engine", keyPath: "analysiskey"},
    {name: "study", keyPath: "title"}
]

const DATABASE_VERSION = OBJECT_STORES.length

function dbResult(ok, content){    
    return {
        ok: ok,
        content: content,
        hasContent: ( !!content ) && ok
    }
}

class IndexedDB{
    put(store, obj){
        let objectStore = this.db.transaction([store], "readwrite").objectStore(store)
        let requestUpdate = objectStore.put(obj)

        return new Promise((resolve, reject)=>{                
            requestUpdate.onsuccess = function(event) {    
                resolve(dbResult(DB_OK, event))
            }

            requestUpdate.onerror = function(event) {
                reject(dbResult(DB_FAILED, event))
            }
        })        
    }

    delete(store, key){
        let objectStore = this.db.transaction([store], "readwrite").objectStore(store)
        let requestUpdate = objectStore.delete(key)

        return new Promise((resolve, reject)=>{                
            requestUpdate.onsuccess = function(event) {    
                resolve(dbResult(DB_OK, event))
            }

            request.onerror = function(event) {
                reject(dbResult(DB_FAILED, event))
            }
        })        
    }

    get(store, key){
        let transaction = this.db.transaction([store])
        let objectStore = transaction.objectStore(store)
        let request = objectStore.get(key)

        return new Promise((resolve, reject)=>{                
            request.onsuccess = function(_) {    
                resolve(dbResult(DB_OK, request.result))
            }

            request.onerror = function(event) {
                reject(dbResult(DB_FAILED, event))
            }
        })        
    }

    getAll(store){
        let objectStore = this.db.transaction(store).objectStore(store)
        let getAll = objectStore.getAll()

        return new Promise((resolve, reject)=>{                
            getAll.onsuccess = function(event) {    
                resolve(dbResult(DB_OK, event.target.result))
            }

            getAll.onerror = function(event) {
                reject(dbResult(DB_FAILED, event))
            }
        })        
    }

    async getAlls(storeList){
        let result = {}

        for(let store of storeList){
            result[store] = await this.getAll(store)
        }

        return result
    }

    init(){
        return new Promise((resolve, reject)=>{
            let req = window.indexedDB.open(this.databaseName, this.databaseVersion)

            req.onerror = (event) => {
                console.log(`error: could not open ${this.databaseName}`, event)

                reject(dbResult(DB_FAILED, event))
            }

            req.onsuccess = (event) => {    
                this.db = event.target.result

                if(IS_DEV()) console.log(`success: opened ${this.databaseName} version ${this.databaseVersion}`)

                resolve(dbResult(DB_OK, event))
            }

            req.onupgradeneeded = (event) => {
                if(IS_DEV()) console.log(`upgrading ${this.databaseName} to version ${this.databaseVersion}`)

                this.db = event.target.result
        
                OBJECT_STORES.forEach(os=>{try{
                    this.db.createObjectStore(os.name, { keyPath: os.keyPath })
                    if(IS_DEV()) console.log(`created object store ${os.name} with key ${os.keyPath}`)
                }catch(err){
                    console.log(`warning: object store ${os.name} could not be created`)
                }})                
            }
        })    
    }

    constructor(databaseName, databaseVersion){
        this.databaseName = databaseName
        this.databaseVersion = databaseVersion
    }
}

var IDB

function initDb(){
    IDB = new IndexedDB(DATABASE_NAME, DATABASE_VERSION)

    return IDB.init()
}
