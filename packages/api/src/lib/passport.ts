import Passport from 'koa-passport'
import Pgit from 'passport-github2'
import Conf from '../../config'

const config = Conf.getAccount()

const log = console

log.info('github config: ', config)
const GitStrategy = Pgit.Strategy
Passport.serializeUser((user, done) => {
    done(null, user)
})

Passport.deserializeUser((user: any, done) => {
    done(null, user)
})

Passport.use(
    new GitStrategy(
        {
            clientID: config.github.clientID,
            clientSecret: config.github.clientSecret,
            callbackURL: config.github.callbackUrl,
        },
        (
            accessToken: any,
            refreshToken: any,
            profile: any,
            done: any
        ) => {
            log.info('passport callback: ', accessToken, refreshToken, profile)
            process.nextTick(() => {
                return done(null, profile)
            })
        }
    )
)

export default Passport