// import Trace from 'trace_events'
import { PerformanceObserver } from 'perf_hooks'
import { getAppLogger } from '@elara/lib'

const log = getAppLogger('tracer')

const Pobs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        log.info(entry)
    })
})

Pobs.observe({
    entryTypes: ['measure'],
    // buffered: true
})


