<a name="top"></a>
# @elara/api v0.1.0

elara api service

# Table of contents

- [auth](#auth)
  - [github](#github)
  - [login](#login)
  - [logout](#logout)
- [chain](#chain)
  - [list](#list)
- [NonAuth](#NonAuth)
  - [dayilyStatis](#dayilyStatis)
  - [lastDaysOfAll](#lastDaysOfAll)
  - [totalStatis](#totalStatis)
- [project](#project)
  - [countOfChain](#countOfChain)
  - [countOfUser](#countOfUser)
  - [create](#create)
  - [delete](#delete)
  - [list](#list)
  - [projectByChainPid](#projectByChainPid)
  - [projectById](#projectById)
  - [updateLimit](#updateLimit)
  - [updateName](#updateName)
- [stat](#stat)
  - [countryRequestMap](#countryRequestMap)
  - [dayilyOfProject](#dayilyOfProject)
  - [lastDaysOfProject](#lastDaysOfProject)
  - [lastHoursOfProject](#lastHoursOfProject)
  - [latestError](#latestError)
  - [requestRank](#requestRank)
- [user](#user)
  - [detail](#detail)
  - [userDailyStatistic](#userDailyStatistic)

___


# <a name='auth'></a> auth

## <a name='github'></a> github
[Back to top](#top)

<p>clientID，clientSecret，access GitHub</p>

```
GET /auth/github
```

## <a name='login'></a> login
[Back to top](#top)

```
GET /auth/login
```

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| User | `Object` | <p>user obeject with limit resource and project count</p> |

### Success response example

#### Success response example - `Success`

```json
{
     code: 0,
     msg: 'ok',
     data: {
         user: {
             id: 1,
             name: 'Bruce',
             githubId: 'TestUID',
             limit: {
                 projectNum: 10, // max prject count
                 bwDayLimit,
                 reqDayLimit,
                 ...
             }
         },
         projectNum: 7
     }
}
```

## <a name='logout'></a> logout
[Back to top](#top)

```
GET /auth/logout
```

# <a name='chain'></a> chain

## <a name='list'></a> list
[Back to top](#top)

```
POST /chain/list
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Integer` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Record | `Object` | <p>chain list map by network,Record&lt;String, ChainInfo[]&gt;</p> |

### Success response example

#### Success response example - `Success:`

```json
{
    code: 0,
    msg: 'ok',
    data: { 
        'live': [{
            id: 1,
            name: 'polkadot',
            team: 'parity',
            network: 'Polkadot',
            status: 'active',   'active' | 'inactive' | 'empty'
            count: 1    // project count

        }, {}],
        'test': []
    }
}
```

# <a name='NonAuth'></a> NonAuth

## <a name='dayilyStatis'></a> dayilyStatis
[Back to top](#top)

<p>today statistic</p>

```
GET /public/daily
```

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `StatT` | <p>totay statistic record</p> |
| Stat.reqCnt | `Integer` | <p>total request count</p> |
| Stat.wsConn | `Integer` | <p>ws connection count</p> |
| Stat.subCnt | `Integer` | <p>ws subscribe count</p> |
| Stat.subResCnt | `Integer` | <p>ws response count in subscription</p> |
| Stat.bw | `Integer` | <p>total bandwidth</p> |
| Stat.delay | `Integer` | <p>average delay ms</p> |
| Stat.inReqCnt | `Integer` | <p>invalid request count</p> |
| Stat.timeoutDelay | `Integer` | <p>average timeout ms</p> |
| Stat.timeoutCnt | `Integer` | <p>timeout count</p> |
| Stat.ctMap | `Integer` | <p>request country map {'US': 3, 'CZ': 100 , 'unknow': 1}</p> |

## <a name='lastDaysOfAll'></a> lastDaysOfAll
[Back to top](#top)

<p>last days statistic record of elara</p>

```
POST /public/days
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| days | `Integer` | <p>how many days to view</p>_Size range: >=1, <=30_<br> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `Object` | <p>stat day duration info</p> |
| Stat.timeline | `String[]` |  |
| Stat.stats | `StatInfoT[]` |  |
| Stat.stats.request | `Integer` | <p>request count</p> |
| Stat.stats.bandwidth | `Integer` | <p>bandwidth in bytes</p> |

## <a name='totalStatis'></a> totalStatis
[Back to top](#top)

<p>total statistic</p>

```
GET /public/stat
```

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `StatInfoT` | <p>total statistic record with request &amp; bandwidth</p> |
| Stat.request | `Integer` | <p>total request count</p> |
| Stat.bandwidth | `Integer` | <p>total request bandwidth in byte</p> |

# <a name='project'></a> project

## <a name='countOfChain'></a> countOfChain
[Back to top](#top)

```
POST /project/count/chain
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| chain | `String` | <p>chain name</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `Number` | <p>count of chain</p> |

## <a name='countOfUser'></a> countOfUser
[Back to top](#top)

```
POST /project/count/user
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Number` | <p>user id</p> |
| byChain | `Boolean` | <p>by chain or not</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `Number` | <p>count of user</p> |
| Counts | `Object[]` | <p>count list of user &amp; chain</p> |
| Counts.chain | `String` | <p>chain</p> |
| Counts.count | `String` | <p>count of chain</p> |

### Success response example

#### Success response example - `SuccessByChain:`

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "chain": "Kusuma",
      "count": "2"
    },
    {
      "chain": "jupiter",
      "count": "2"
    }
  ]
}
```

#### Success response example - `Success:`

```json
{
     code: 0,
     msg: 'ok',
     data: 4
}
```

## <a name='create'></a> create
[Back to top](#top)

```
POST /project/create
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Number` | <p>user id</p> |
| chain | `String` | <p>chain</p> |
| team | `String` | <p>team name</p> |
| name | `String` | <p>project name to create [0-9a-zA-Z]{4,32}</p> |
| reqSecLimit | `Number` | **optional** <p>request second limit</p> |
| reqDayLimit | `Number` | **optional** <p>request day limit</p> |
| bwDayLimit | `Number` | **optional** <p>bandwidth day limit</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `ProAttr` | <p>project created</p> |

## <a name='delete'></a> delete
[Back to top](#top)

<p>logic delete</p>

```
POST /project/delete
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| id | `Number` | <p>project id</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `Boolean` | <p>delte result, success or not</p> |

## <a name='list'></a> list
[Back to top](#top)

<p>get project list according to [userId, chain], if both, list of userId &amp; chain</p>

```
POST /project/list
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Number` | **optional** <p>integer userId, list of userId</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| project | `ProAttr[]` | <p>list of project</p> |
| project.id | `Number` | <p>project id, integer</p> |
| project.pid | `String` | <p>project pid, 16 bytes hex string</p> |
| project.name | `String` | <p>project name</p> |
| project.status | `String` | <p>project status ['active', 'stop', 'suspend']</p> |
| project.chain | `String` | <p>chain name</p> |
| project.team | `String` | <p>team name</p> |
| project.secret | `String` | <p>project secret, reserved field</p> |
| project.userId | `Number` | <p>association user id</p> |
| project.reqSecLimit | `Number` | <p>request count of second limit</p> |
| project.reqDayLimit | `Number` | <p>request count of day limit</p> |
| project.bwDayLimit | `Number` | <p>bandwidth of day limit</p> |

### Success response example

#### Success response example - `Success:`

```json
{
    code: 0,
    msg: 'ok',
    data: ProAttr[]
}
```

### Error response example

#### Error response example - `Error:`

```json
{
     code: 400,  // non 0 code
     msg: error message,
     data: {}
}
```

## <a name='projectByChainPid'></a> projectByChainPid
[Back to top](#top)

```
POST /project/detail/chainpid
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| chain | `String` |  |
| pid | `String` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| project | `ProAttr` |  |

## <a name='projectById'></a> projectById
[Back to top](#top)

```
POST /project/detail/id
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| id | `Number` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| project | `ProAttr` |  |

## <a name='updateLimit'></a> updateLimit
[Back to top](#top)

<p>udpate project resource limit, reqSecLimit/reqDayLimit/bwDayLimit</p>

```
POST /project/update/limit/
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| id | `Number` | <p>project id</p> |
| reqSecLimit | `Number` | **optional** <p>request second limit</p> |
| reqDayLimit | `Number` | **optional** <p>request day limit</p> |
| bwDayLimit | `Number` | **optional** <p>bandwidth day limit</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `null` |  |

## <a name='updateName'></a> updateName
[Back to top](#top)

```
POST /project/update/name
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Number` |  |
| chain | `String` | <p>which chain belongs to</p> |
| id | `Number` | <p>project id</p> |
| name | `String` | <p>new project name</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| none | `String` | <p>new name</p> |

# <a name='stat'></a> stat

## <a name='countryRequestMap'></a> countryRequestMap
[Back to top](#top)

```
POST /stat/project/country
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| size | `Integer` | <p>size of page</p>_Size range: >=1_<br> |
| page | `Integer` | <p>page offset</p> |
| chain | `String` |  |
| pid | `String` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Object | `Object` | <p>page object</p> |
| Object.total | `Integer` | <p>total records</p> |
| Object.size | `Integer` | <p>page size</p> |
| Object.page | `Integer` | <p>page offset</p> |
| Object.pages | `Integer` | <p>total pages</p> |
| Object.list | `Object[]` | <p>record list</p> |
| Object.list.country | `String` |  |
| Object.list.percentage | `String` | <p>request count ratio</p> |

## <a name='dayilyOfProject'></a> dayilyOfProject
[Back to top](#top)

<p>today statistic record of project</p>

```
POST /stat/project/daily
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| chain | `String` | <p>chain name</p> |
| pid | `String` | <p>project pid</p> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `StatT` | <p>statistic record</p> |

## <a name='lastDaysOfProject'></a> lastDaysOfProject
[Back to top](#top)

<p>last days statistic record of project</p>

```
POST /stat/project/days
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| chain | `String` | <p>chain name</p> |
| pid | `String` | <p>project pid</p> |
| days | `Integer` | <p>how many days to view</p>_Size range: >=1, <=30_<br> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `Object` | <p>stat day duration info</p> |
| Stat.timeline | `String[]` |  |
| Stat.stats | `StatInfoT[]` |  |
| Stat.stats.request | `Integer` | <p>request count</p> |
| Stat.stats.bandwidth | `Integer` | <p>bandwidth in bytes</p> |

## <a name='lastHoursOfProject'></a> lastHoursOfProject
[Back to top](#top)

<p>last hours statistic record of project</p>

```
POST /stat/project/hours
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| pid | `String` | <p>project pid</p> |
| hours | `Integer` | <p>how many hours to view</p>_Size range: >=1, <=24_<br> |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `Object` | <p>stat hour duration info</p> |
| Stat.timeline | `String[]` |  |
| Stat.stats | `StatInfoT[]` |  |
| Stat.stats.request | `Integer` | <p>request count</p> |
| Stat.stats.bandwidth | `Integer` | <p>bandwidth in bytes</p> |

## <a name='latestError'></a> latestError
[Back to top](#top)

<p>latest error record of all</p>

```
POST /stat/latest/error
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| size | `Integer` | <p>size of page</p>_Size range: >=1_<br> |
| page | `Integer` | <p>page offset</p> |
| chain | `String` |  |
| pid | `String` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Object | `Object` | <p>page object</p> |
| Object.total | `Integer` | <p>total records</p> |
| Object.size | `Integer` | <p>page size</p> |
| Object.page | `Integer` | <p>page offset</p> |
| Object.pages | `Integer` | <p>total pages</p> |
| Object.list | `Object[]` | <p>record list</p> |
| Object.list.proto | `String` | <p>http | ws</p> |
| Object.list.mehtod | `String` |  |
| Object.list.delay | `String` |  |
| Object.list.code | `String` |  |
| Object.list.time | `String` | <p>timestamp string YYYY-MM-DD HH:mm</p> |

## <a name='requestRank'></a> requestRank
[Back to top](#top)

<p>today statistic record of project</p>

```
POST /stat/project/rank
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| chain | `String` |  |
| pid | `String` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Rank | `Object` | <p>resource rank info</p> |

### Success response example

#### Success response example - `Success:`

```json
{
 code: 0,
 msg: 'ok',
 data: {
     bandwidth: {
         total: 1000     // bandwidth bytes,
         list: [{ method: 'systen_health', value: 100 }]
     },
     request: {
         total: 1024    // request count,
         list: [{ method: 'systen_health', value: 10 }]
     }
 }
}
```

# <a name='user'></a> user

## <a name='detail'></a> detail
[Back to top](#top)

<p>user detail info</p>

```
GET /user/detail
```

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| User | `UserAttr` |  |
| User.id | `Integer` | <p>user id</p> |
| User.name | `String` | <p>user ame</p> |
| User.status | `String` | _Size range: 'active','suspend','barred'_<br> |
| User.level | `String` | _Size range: 'normal', 'bronzer','silver','gold'_<br> |
| User.loginType | `String` | <p>now is github</p> |
| User.githubId | `String` | <p>origin uid</p> |
| User.phone | `String` | **optional** |
| User.mail | `String` | **optional** |

## <a name='userDailyStatistic'></a> userDailyStatistic
[Back to top](#top)

<p>user detail info</p>

```
POST /user/detail/statistic
```

### Parameters - `Parameter`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| userId | `Integer` |  |

### Success response

#### Success response - `Success 200`

| Name     | Type       | Description                           |
|----------|------------|---------------------------------------|
| Stat | `StatT` | <p>user statistic of all project</p> |

