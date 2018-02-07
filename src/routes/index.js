import express from 'express'

const router = express.Router()

router.get('/status', (req, res) => {
  res.status(200).json({
    env: process.env.NODE_ENV,
    status: 'running',
    version: '1.0'
  })
})

export default router
