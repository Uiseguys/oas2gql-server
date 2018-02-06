import express from 'express'
import { find, takeRight } from 'lodash'
import { vehicle, driver, logBook } from '../fake-db'
const router = express.Router()

router.get('/', (req, res) => {
  res.status(200).json(driver)
})

router.get('/:id', (req, res, next) => {
  const d = driver.filter((v) => req.params.id * 1 === v.id)
  res.status('200').json(d[0] || null)
})

router.get('/:id/associatedVehicles', (req, res, next) => {
  const drv = driver.filter((v) => req.params.id * 1 === v.id)
  if (drv[0] === undefined) {
    res.status('200').json(null)
  } else {
    const d = drv[0]
    const vehicles = d.associatedVehicles.map((id) => find(vehicle, { id }))
    res.status('200').json(vehicles || null)
  }
})

router.get('/:id/logBook', (req, res, next) => {
  const drv = driver.filter((v) => req.params.id * 1 === v.id)
  if (drv[0] === undefined) {
    res.status('200').json(null)
  } else {
    const d = drv[0]
    // const howMany = req.query.last * 1 || 2
    // const lastLogs = takeRight(d.logBook, howMany)
    const lastLogs = d.logBook
    const logs = lastLogs.map((id) => find(logBook, { id }))
    res.status('200').json(logs || null)
  }
})

export default router
