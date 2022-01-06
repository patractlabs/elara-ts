### 分库

按业务模块进行分库，提高查询和数据管理；应对业务增长；

| 模块          | index | 描述                                           |
| ------------- | ----- | ---------------------------------------------- |
| Account       | 0     | 账户相关信息，黑白名单，`vip`                  |
| Project       | 1     | project相关数据，增删改查                      |
| Stat统计数据  | 2     | 统计相关，project请求统计，`elara`服务数据统计 |
| Chain配置     | 3     | 链相关数据，链名，`url`，端口，网络，等        |
| Cache缓存数据 | 4     | 周期数据，优化数据等                           |

### 字段设计原则

- 表明相关业务
- 表明数据类型
- 易于筛选分类查询

#### 服务原则

分为`Elara`和用户，`Elara`项目方的数据，以及基于`UID`的用户数据

#### 数据类型前缀

遵从`redis`数据操作命令格式

| 类型   | 前缀 |
| ------ | ---- |
| List   | L_   |
| Hash   | H_   |
| Set    | S_   |
| `ZSet` | Z_   |
| String | none |

#### 统一字段

module	表明当前分库的业务模块。

可选值： ['Account', 'Project', 'Stat', 'Chain', 'Cache']

### `Elara` `Redis`数据设计

##### 表名

`Type_Module_Item_[Chain]`

#### stat

##### 需求

1. 项目的统计信息
2. `elara`总体项目统计信息



|      |      |
| ---- | ---- |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |



#### project

1. ##### 需求

   - 列表是否要有序
   - 统计
   - 筛选 

   | 查询                         | 命令                                                    |
   | ---------------------------- | ------------------------------------------------------- |
   | 所有项目数                   | get Project_Num                                         |
   | 某条链项目数                 | keys Z_Project_list\_*_[CHAIN] ; zcard                  |
   | 用户的项目数                 | keys Z_Project_list\_[UID]_*; zcard                     |
   | 用户某条链的项目数           | zcard Z_Project_list\_[UID]_[CHAIN]                     |
   | 某条链的项目列表             | keys H_Project\_[CHAIN]_* ;  hgetall                    |
   | 用户的项目列表               | keys Z_Project\_list_[UID]*; hgetall                    |
   | 用户某条链的项目列表         | zrange Z_Project_list\_[UID]_[CHIAN] 0 -1;  hgetall     |
   | 列表按创建时间排序(链维度)   | zrangebyscore                                           |
   | / 列表按更新时间排序(链维度) | 暂不支持                                                |
   | - 某段时间内的项目数         | zcount Z_Project_list\_[UID]_[CHIAN]  starttime endtime |
   | - 某段时间内的项目列表       | zrange Z_Project_list\_[UID]_[CHIAN]  starttime endtime |

   

2. ##### 数据结构

    `UID | chain | PID | createtime | lasttime |` 

   `UID` 用户筛选
   `chain` 链筛选
   `createtime / lasttime` 创建和更新时间排序

3. #####  实现

```js
// Chain名小写，防止不匹配
module  'Project'
Project_Num					0	// 所有项目数量

H_Project_[CHAIN]_[PID]			// project详情记录，原先project_info_[PID]
Z_Project_list_[UID]_[CHAIN]	// project列表，按UID-CHAIN分类，原先projects_[UID]

// 有序集合
- 以craetetime为score
- key值为pid
```



​                      

