import express from 'express'
import vehicleRoute from './vehicle.route'
import driverRoute from './driver.route'
import logBookRoute from './logBook.route'

const router = express.Router()

router.use('/vehicle', vehicleRoute)
router.use('/driver', driverRoute)
router.use('/logbook', logBookRoute)

router.get('/status', (req, res) => {
  res.status(200).json({
    env: process.env.NODE_ENV,
    status: 'running',
    version: '1.0'
  })
})

export default router
