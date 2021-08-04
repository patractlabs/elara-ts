import { Err, getAppLogger, Ok, PResultT } from '@elara/lib'
import lModel, { LimitAttr } from '../models/limit'
import { UserLevel } from '../models/user'
import { errMsg } from '../util'

const log = getAppLogger('limit')

class Limit {
    static async add(attr: LimitAttr) {
        try {
            const re = await lModel.create(attr)
            log.debug('create limit result: %o', re)
            return Ok(re)
        } catch (err) {
            log.error('add new limit error: %o', err)
            return Err(errMsg(err, 'add fail'))
        }
    }

    static async update(attr: LimitAttr): PResultT<[number, Limit[]]> {
        try {
            if (attr.level) {
                if (!Object.values(UserLevel).includes(attr.level)) {
                    return Err('invalid level')
                }
            }
            const re = await lModel.update(attr, {
                where: {
                    id: attr.id
                }
            })
            return Ok(re)
        } catch (err) {
            log.error('udpate error: %o', err)
            return Err(errMsg(err, 'udpate error'))
        }
    }

    static async findById(id: number): PResultT<LimitAttr> {
        try {
            const re = await lModel.findOne({
                where: {
                    id
                }
            })
            if (re === null) {
                return Err('no this item')
            }
            return Ok(re)
        } catch (err) {
            log.error(`find limit of id ${id} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async findByLevel(level: UserLevel): PResultT<LimitAttr> {
        try {
            const re = await lModel.findOne({
                where: {
                    level
                }
            })
            if (re === null) {
                return Err('no this item')
            }
            return Ok(re)
        } catch (err) {
            log.error(`find limit of level ${level} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async delete(id: number, force: boolean = false): PResultT<boolean> {
        try {
            const re = await lModel.destroy({
                where: {
                    id
                },
                force
            })
            return Ok(re === 1)
        } catch (err) {
            log.error(`destroy limit of ${id} error: %o`, err)
            return Err(errMsg(err, 'destroy error'))
        }
    }

}

export default Limit