import fs from 'fs'
import path from 'path'
import Router from 'koa-router'

const router = new Router()

//自动加载routers目录下的路由
const addMapping = (router:any, mapping:any) => {
    
    for (var url in mapping) {
        let methodAndPath = url.split(' ')
        // console.log('method: ', methodAndPath)
        if( methodAndPath.length > 1 ) {
            router[methodAndPath[0].toLowerCase()](methodAndPath[1], mapping[url]);
        }
    }
}

const routerCompose: any = () => {
    // __dirname is routerCompose file path
    let pat = path.join(__dirname, 'routers/v1')
    let files = fs.readdirSync(pat);
    var tsFiles = files.filter((f) => { return f.endsWith('ts') });
    // console.log('Path: ', pat, tsFiles)

    for (var f of tsFiles) {
        let fil = path.join(pat, f)
        // let prefix = path.basename(f, '.ts')
        import(fil).then(mapping => {
            // console.log('import result: ', mapping)
            addMapping(router, mapping.default);
        });
        
    }
    return router.routes()
}

export = routerCompose