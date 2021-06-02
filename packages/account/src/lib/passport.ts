import Passport from 'koa-passport'
import Pgit from 'passport-github2'
import { setConfig } from '../../config'

const config = setConfig()
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
            clientID: config.github.ClientID,
            clientSecret: config.github.ClientSecret,
            callbackURL: config.github.CallbackURL,
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

export = Passport
