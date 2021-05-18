import Passport from 'koa-passport'
// import Pgit from 'passport-github2'

// const GitStrategy = Pgit.Strategy
Passport.serializeUser((user, done) => {
    done(null, user)
})

Passport.deserializeUser((user: any, done) => {
    done(null, user)
})

export = Passport