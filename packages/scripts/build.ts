import { build } from 'esbuild'
import ArgParse from 'minimist'

interface BuildOptions {
    env: 'pro' | 'dev' ,
    app: string

}

export async function buildApp(options: BuildOptions) {
    const { env, app } = options

    await build({
        // entryPoints: [`packages/${app}/app.ts`], // 我们从这个入口点读应用程序
        entryPoints: [`packages/${app}/app.ts`], // 我们从这个入口点读应用程序
        sourceRoot: `packages/${app}/**/*`,
        // outfile: `packages/${app}/dist/app.js`, 
        outdir: `packages/${app}/dist`,
        // define: {
        //     'process.env.NODE_ENV': ``${env}``, // 我们需要定义构建应用程序的 Node.js 环境
        // },
        external: ['koa', 'koa-router', 'koa-passport'],
        platform: 'node',
        target: 'node14.16.1',
        bundle: true,
        minify: env === 'pro',
        sourcemap: env === 'dev',
    })
}

async function buildAll() {
    const args = ArgParse(process.argv.slice(2))
    console.log('arg env: ', args)
    const apps = ['wsrpc', 'suducer', 'node', 'api', 'job']
    let papps: Promise<any>[] = []
    for (let app of apps) {
        papps.push(buildApp({env: args.env || 'pro', app}))
    }
    await Promise.all(papps)
}

buildAll()