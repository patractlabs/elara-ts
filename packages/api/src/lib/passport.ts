import Passport from 'koa-passport'
import Pgit from 'passport-github2'
import Conf from '../../config'

const config = Conf.getAccount()

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
        function (
            accessToken: any,
            refreshToken: any,
            profile: any,
            callback: any
        ) {
            console.log('Passport callback')

            callback(null, { accessToken, refreshToken, profile })
        }
    )
)

export default Passport