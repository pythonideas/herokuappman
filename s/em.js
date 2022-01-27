const fs = require("fs")

const argv = require("minimist")(process.argv.slice(2));

const { config } = require("nodemon");
const APP_CONF = require("./../appconf.json")
const CONFIG = APP_CONF.config

function saveAppConfig(){
    fs.writeFileSync("appconf.json", JSON.stringify(APP_CONF, null, 2))
}

function interpreter(argv){
    const command = argv._[0]

    return new Promise(resolve => {
        if(command === "addconfig"){
            const key = argv._[1]
            if(!key){
                resolve({error: "No Key"})
                return
            }
            if(CONFIG.find(testKey => testKey === key)){
                resolve({error: "Key Already Added"})
                return
            }
            CONFIG.push(key)
            saveAppConfig()
            resolve({CONFIG})
            return
        }

        if(command === "listconfig"){
            const keyValues = {}
            CONFIG.forEach(key => keyValues[key] = process.env[key])
            resolve(keyValues)
        }

        resolve({error: "Unknwon Command"})
    })
}

if(require.main === module){
    interpreter(argv).then(result =>{
        console.log(result)
    })
}
