interface AccountConfig {
    keys: string[]
    port: number
    session: {
        key: string
        signed: boolean
        maxAge: number
        httpOnly: boolean
    }
    isTest: boolean
    github: {
        ClientID: string
        ClientSecret: string
        CallbackURL: string
    }
    login: string
    defaultLevel: number
    apikey: string
    
  
    
}

export const setConfig = (options?: AccountConfig): AccountConfig => {
    options
    return {
        keys: ['account@#^*&'],
        port: 7004,
        session: {
            key: 'sid',
            signed: false,
            maxAge: 2592000000,
            httpOnly: false,
        },
        isTest: true,
        github: {
            ClientID: 'd67ed989933a697a9f9e',
            ClientSecret: '7dadbfa07c43571d9bfedbcca0fe9d59ccc6cf92',
            CallbackURL: 'http://47.111.179.222:8000/account/auth/github/callback',
        },
        // login: 'https://elara.patract.io/login',
        login: 'http://47.111.179.222:8000/account/auth/github/home',
      defaultLevel: 0,
      apikey: "elara",
    }
}
