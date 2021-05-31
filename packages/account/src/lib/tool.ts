import crypto from 'crypto'
export const now = () => {
    const dateTime = Date.now()
    const timestamp = Math.floor(dateTime / 1000)
    return timestamp
}

export const getID = function (length: number) {
    return crypto.randomBytes(length).toString('hex')
}
