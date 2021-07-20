export const formateDate = (date: Date): string => {
    let yyyy = date.getFullYear()
    let MM = (date.getMonth() + 1) >= 10 
        ? (date.getMonth() + 1) : ("0" + (date.getMonth() + 1))
    let dd = date.getDate() < 10 ? ("0" + date.getDate()) : date.getDate()
    return yyyy + '' + MM + '' + dd
}

export const now = (): number =>  {
    const dateTime = Date.now()
    const timestamp = Math.floor(dateTime / 1000)
    return timestamp
}