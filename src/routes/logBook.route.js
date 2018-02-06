import express from 'express'
import { logBook } from '../fake-db'
const router = express.Router()

router.get('/', (req, res) => {
  res.status(200).json(logBook)
})

router.get('/:id', (req, res, next) => {
  const l = logBook.filter((v) => req.params.id * 1 === v.id)
  res.status('200').json(l[0] || null)
})

export default router
