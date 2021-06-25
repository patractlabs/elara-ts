import cannon from 'autocannon'
import http from 'http'

function createHandler (serverName) {
  return function (req, res) {
      req
    console.log(serverName + ' received request')
    res.end('hello world')
  }
}

const server1 = http.createServer(createHandler('server1'))
const server2 = http.createServer(createHandler('server2'))

server1.listen(0, startBench)
server2.listen(0, startBench)

function startBench () {
  const url = 
    'http://localhost:7001'
  

  // same with run the follow command in cli
  // autocannon -d 10 -c 2 http://localhost:xxxx http://localhost:yyyy
  cannon({
    url: url,
    // connection number should n times of the number of server
    connections: 2,
    duration: 10,
    requests: [
      {
        method: 'POST',
        path: '/kusuma/1234567890qwertyuiopasdfghjklbnm',
        body: JSON.stringify({id:1,jsonrpc:'2.0',method:'system_health',params:[]})
      }
    ]
  }, finishedBench)

  function finishedBench (err, res) {
    console.log('finished bench', err, res)
    process.exit(1)
  }
}