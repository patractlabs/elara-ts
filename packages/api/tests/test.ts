import geo from 'geoip-country'

const ip = geo.lookup('172.30.175.255')
console.log('ip: ', ip)