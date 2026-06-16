const express = require('express')
const router  = express.Router()
const checkroles = require('../Middlewares/role.permissions')
const {
  getInstagramAnalytics, updateInstagramCaption,
  getMetaAdsAnalytics,
  getWebsiteAnalytics,
} = require('../Controllers/social.controller')

const adminOnly = checkroles('SuperAdmin', 'Admin')

router.get('/instagram',                       adminOnly, getInstagramAnalytics)
router.patch('/instagram/:mediaId/caption',    adminOnly, updateInstagramCaption)

router.get('/meta',                            adminOnly, getMetaAdsAnalytics)

router.get('/website',                         adminOnly, getWebsiteAnalytics)

module.exports = router
