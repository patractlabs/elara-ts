import fs from 'fs'
import { exec } from 'child_process'
import { build } from 'esbuild'
import ArgParse from 'minimist'

interface BuildOptions {
    env: 'pro' | 'dev',
    app: string

}

async function runcmd(cmd: string, cwd: string) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd }, (err, stdout, stderr) => {
            if (err) {
                console.error(stderr)
                reject(err)
                process.exit(1)
            }
            console.log(stdout)
            resolve(stdout)
        })
    })
}

 async function buildApp(options: BuildOptions) {
    const { env, app } = options

    await build({
        entryPoints: [`packages/${app}/app.ts`], // 我们从这个入口点读应用程序
        sourceRoot: `packages/${app}/**/*`,
        outdir: `packages/${app}/dist/src`,

        external: ['koa', 'koa-router', 'koa-passport',
            'winston', 'winston-daily-rotate-file',
            'sequelize', 'sequelize-typescript',
            'reflect-metadata', '@types/validator', '@types/node'
        ],
        platform: 'node',
        target: 'node14.16.1',
        bundle: true,
        minify: env === 'pro',
        sourcemap: env === 'dev',
    })

    await deployApp(app)
    if (app === 'job') {
        deployJob()
    }
    if (app === 'api') {
        await deployApi()
    }
}

async function buildAll() {
    try {
        const args = ArgParse(process.argv.slice(2))
        console.log('arg env: ', args)
        const apps = ['wsrpc', 'suducer', 'api', 'job']
        let papps: Promise<any>[] = []
        for (let app of apps) {
            papps.push(buildApp({ env: args.env || 'pro', app }))
        }
        await Promise.all(papps)
        // buildApi(args.env || 'pro')
    } catch (err) {
        console.error('build error: ', err)
        process.exit(1)
    }
}

function mkdir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
}

function remfileIfExist(file: string) {
    if (fs.existsSync(file)) {
        fs.unlinkSync(file)
    }
}

function copyConfig(app: string) {
    const srcp = `packages/${app}/config/`
    const destp = `packages/${app}/dist/config/`
    const fils = fs.readdirSync(srcp)
    mkdir(destp)
    fils.forEach(f => {
        if (f.endsWith('json')) {
            const destf = destp + f
            remfileIfExist(destf)
            fs.copyFileSync(srcp + f, destf)
        }
    })
}

function writeFile(app: string) {
    remfileIfExist(`packages/${app}/dist/package.json`)
    remfileIfExist(`packages/${app}/dist/package/.env`)
    fs.writeFileSync(`packages/${app}/dist/package.json`, '{}')
    fs.writeFileSync(`packages/${app}/dist/.env`, 'NODE_ENV=pro')
}

async function deployApp(app: string) {
    copyConfig(app)
    writeFile(app)

    await runcmd('yarn add winston winston-daily-rotate-file', `packages/${app}/dist`)
}

function deployJob() {
    const srcp = 'packages/job/data/'
    const destp = 'packages/job/dist/data/'
    mkdir(destp)
    const fils = fs.readdirSync(srcp)
    fils.forEach(f => {
        const destf = destp + f
        remfileIfExist(destf)
        fs.copyFileSync(srcp + f, destf)
    })
}

 async function deployApi() {
    await runcmd('yarn add -D @types/node @types/validator pg pg-hstore', `packages/api/dist`)
    await runcmd('yarn add sequelize sequelize-typescript reflect-metadata koa koa-router koa-passport', `packages/api/dist`)
}

buildAll()