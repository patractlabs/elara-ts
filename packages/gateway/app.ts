import Koa from 'koa'
import http from 'http'
import httpProxy from 'http-proxy'
import {ratelimit} from './src/access/ratelimit'
import router from './src/router/router'
import { accessLogger, getAppLogger } from 'lib'
const app = new Koa()
const log = getAppLogger('gateway', true) //true: console open


// have to inject before router
// TODO: config the router and blakc wihte list
app.use(accessLogger())
app.use(ratelimit())
app.use(router)

const proxy: httpProxy =  httpProxy.createProxyServer({
    target: {
        host: 'localhost',
        port: 7003
    },
    
})

// http proxy
// const proxyServer = http.createServer(app.callback()) 
const httpServer = http.createServer((req, res) => {
    // app.callback()
    log.info('req url: ', req.url)
    if (req.url?.indexOf('/project') !== -1) {
        log.warn('proxy to stat service')
        proxy.web(req, res, {
            target: {
                host: '127.0.0.1',
                port: 7002
            }
        })
    }

}) 


// web socket proxy
httpServer.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head)
})

httpServer.listen(7000, () => {
    log.info('Elara gateway listen on port: ', 7000)
})
