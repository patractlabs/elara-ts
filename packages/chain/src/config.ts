interface ChainConfOptions {
    name: string
    url: string
    rpcport: string
    wsport: string
    excludes: []        // exclude of basic rpc method list
    extends: []         // specify rpc method for chain
}

class ChainConf {
    
    constructor(options?: ChainConfOptions) {}
}

export = ChainConf