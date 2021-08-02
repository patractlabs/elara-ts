define({ "api": [
  {
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "optional": false,
            "field": "varname1",
            "description": "<p>No type.</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "varname2",
            "description": "<p>With type.</p>"
          }
        ]
      }
    },
    "type": "",
    "url": "",
    "version": "0.0.0",
    "filename": "packages/api/doc/main.js",
    "group": "/Users/yvan/Patract/elara/elara-api-doc/elara-ts/packages/api/doc/main.js",
    "groupTitle": "/Users/yvan/Patract/elara/elara-api-doc/elara-ts/packages/api/doc/main.js",
    "name": ""
  },
  {
    "type": "get",
    "url": "/stat/total/:chain",
    "title": "chain",
    "name": "chain",
    "description": "<p>根据链的名称，查询该链的所有请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "chain",
            "description": "<p>链的名称</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "get",
    "url": "/stat/daily",
    "title": "daily",
    "name": "daily",
    "description": "<p>查询当天的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/days/",
    "title": "days",
    "name": "days",
    "description": "<p>以天为单位，查询最近的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "count",
            "description": "<p>天数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/latest/error/",
    "title": "error",
    "name": "error",
    "description": "<p>以小时为单位，查询最近错误的请求流量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "count",
            "description": "<p>小时数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/hours/",
    "title": "hours",
    "name": "hours",
    "description": "<p>以小时为单位，查询最近的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "count",
            "description": "<p>小时数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/latest",
    "title": "latest",
    "description": "<p>以小时为单位，查询最近的请求数量</p>",
    "name": "latest",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "count",
            "description": "<p>小时数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/most:type/",
    "title": "most",
    "name": "most",
    "description": "<p>查询请求数、流量最多的10个方法</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "count",
            "description": "<p>小时数</p>"
          },
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "days",
            "description": "<p>天数</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "size": "\"bandwidth\",\"request\"",
            "optional": false,
            "field": "type",
            "description": "<p>查询类型</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/project/daily",
    "title": "project-daily",
    "name": "project-daily",
    "description": "<p>根据项目id、链的名称，查询该链的当天请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "chain",
            "description": "<p>链的名称</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "pid",
            "description": "<p>项目的id</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/project/days",
    "title": "project-days",
    "name": "project-days",
    "description": "<p>以天为单位，根据项目id、链的名称、天数，查询该链的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "chain",
            "description": "<p>链的名称</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "pid",
            "description": "<p>项目的id</p>"
          },
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "days",
            "description": "<p>天数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "post",
    "url": "/stat/project/hours",
    "title": "project-hours",
    "name": "project-hours",
    "description": "<p>以小时为单位，根据项目id、链的名称、天数，查询该链的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "chain",
            "description": "<p>链的名称</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "pid",
            "description": "<p>项目的id</p>"
          },
          {
            "group": "Parameter",
            "type": "Integer",
            "size": ">=1",
            "optional": false,
            "field": "hours",
            "description": "<p>小时数</p>"
          }
        ]
      }
    },
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  },
  {
    "type": "get",
    "url": "/stat/total",
    "title": "total",
    "name": "total",
    "description": "<p>查询总的请求数量</p>",
    "group": "stat",
    "version": "0.0.1",
    "filename": "packages/api/src/routers/stat.ts",
    "groupTitle": "stat"
  }
] });
