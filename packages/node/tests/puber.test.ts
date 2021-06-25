import Ws from 'ws'


const pad = (num: number, size: number) => {
    let s = '00000' + num
    return s.substr(s.length - size)
}
describe('puber test suit', () => {
    it('ok', () => {
        for (let i = 0; i < 20000; i++) {
            let s = pad(i, 5)
            console.log(s)
            new Ws(`ws://127.0.0.1:7001/jupiter/12345yuiopasdfghjklzxcvbnm0${s}`)
        }
    })
})