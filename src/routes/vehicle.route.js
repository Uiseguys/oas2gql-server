import express from 'express'
import { find } from 'lodash'
import { vehicle, driver } from '../fake-db'
const router = express.Router()

router.get('/', (req, res) => {
  res.status(200).json(vehicle)
})

router.get('/:id', (req, res, next) => {
  const veh = vehicle.filter((v) => req.params.id * 1 === v.id)
  res.status('200').json(veh[0] || null)
})

router.get('/:id/associatedDrivers', (req, res, next) => {
  const veh = vehicle.filter((v) => req.params.id * 1 === v.id)
  if (veh[0] === undefined) {
    res.status('200').json(null)
  } else {
    const v = veh[0]
    const drivers = v.associatedDrivers.map((id) => find(driver, {id}))
    res.status('200').json(drivers || null)
  }
})

export default router
