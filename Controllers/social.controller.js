const axios  = require('axios')
const crypto = require('crypto')

// ── Helpers ───────────────────────────────────────────────────────────────────

const isPlaceholder = (v) => !v || v.startsWith('REPLACE_')

const periodToUnix = (period) => {
  const now  = Math.floor(Date.now() / 1000)
  const days = { yesterday: 1, '7days': 7, '28days': 28, '1month': 30, '3months': 90 }
  return { since: now - (days[period] || 28) * 86400, until: now }
}

// ══════════════════════════════════════════════════════════════════════════════
//  INSTAGRAM
// ==============================================================================

const IG_BASE = 'https://graph.instagram.com/v18.0'

// GET /api/v1/social/instagram?period=28days
const getInstagramAnalytics = async (req, res) => {
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const userId = process.env.INSTAGRAM_USER_ID

  if (isPlaceholder(token) || isPlaceholder(userId)) {
    return res.json({ success: true, configured: false })
  }

  try {
    const period = req.query.period || '28days'
    const { since, until } = periodToUnix(period)

    // 1. Profile basics
    const profileRes = await axios.get(`${IG_BASE}/${userId}`, {
      params: {
        fields: 'followers_count,media_count,name,username,biography,profile_picture_url',
        access_token: token,
      },
    })

    // 2. Profile insights (impressions, reach, profile_views per day summed over period)
    let insights = {}
    try {
      const ir = await axios.get(`${IG_BASE}/${userId}/insights`, {
        params: { metric: 'impressions,reach,profile_views', period: 'day', since, until, access_token: token },
      })
      ;(ir.data.data || []).forEach(m => {
        insights[m.name] = (m.values || []).reduce((s, v) => s + (v.value || 0), 0)
      })
    } catch (_) {}

    // 3. All media (last 30 posts)
    const mediaRes = await axios.get(`${IG_BASE}/${userId}/media`, {
      params: {
        fields: 'id,caption,like_count,comments_count,timestamp,permalink,media_type,thumbnail_url,media_url',
        limit: 30,
        access_token: token,
      },
    })
    const allMedia = mediaRes.data.data || []

    // 4. Per-post insights for top 12 — parallel with Promise.allSettled
    const insightResults = await Promise.allSettled(
      allMedia.slice(0, 12).map(post =>
        axios.get(`${IG_BASE}/${post.id}/insights`, {
          params: { metric: 'impressions,reach,saved,video_views', access_token: token },
        })
      )
    )

    const topPosts = allMedia.slice(0, 12).map((post, i) => {
      const ins = {}
      if (insightResults[i].status === 'fulfilled') {
        ;(insightResults[i].value.data.data || []).forEach(m => { ins[m.name] = m.values?.[0]?.value || 0 })
      }
      return { ...post, insights: ins }
    })

    topPosts.sort((a, b) => (b.insights.impressions || 0) - (a.insights.impressions || 0))

    res.json({ success: true, configured: true, data: { profile: profileRes.data, insights, topPosts, allMedia } })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    res.status(500).json({ success: false, message: msg })
  }
}

// PATCH /api/v1/social/instagram/:mediaId/caption
const updateInstagramCaption = async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (isPlaceholder(token)) return res.status(400).json({ success: false, message: 'Instagram not configured.' })

  try {
    const { mediaId } = req.params
    const { caption } = req.body
    await axios.post(`${IG_BASE}/${mediaId}`, null, {
      params: { caption, access_token: token },
    })
    res.json({ success: true, message: 'Caption updated successfully.' })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    res.status(500).json({ success: false, message: msg })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  META ADS
// ==============================================================================

const FB_BASE = 'https://graph.facebook.com/v18.0'

// GET /api/v1/social/meta?preset=last_30d
const getMetaAdsAnalytics = async (req, res) => {
  const token     = process.env.META_ADS_ACCESS_TOKEN
  const accountId = process.env.META_ADS_ACCOUNT_ID

  if (isPlaceholder(token) || isPlaceholder(accountId)) {
    return res.json({ success: true, configured: false })
  }

  try {
    const preset = req.query.preset || 'last_30d'

    // Account info
    const accountRes = await axios.get(`${FB_BASE}/${accountId}`, {
      params: { fields: 'name,currency,account_status,balance,spend_cap', access_token: token },
    })

    // Account-level insights (summary)
    const insightsRes = await axios.get(`${FB_BASE}/${accountId}/insights`, {
      params: {
        fields: 'spend,impressions,reach,clicks,unique_clicks,cpm,cpc,ctr,frequency,actions',
        date_preset: preset,
        access_token: token,
      },
    })

    // Daily spend trend
    let dailySpend = []
    try {
      const dr = await axios.get(`${FB_BASE}/${accountId}/insights`, {
        params: {
          fields: 'spend,impressions,clicks,reach',
          date_preset: preset,
          time_increment: 1,
          access_token: token,
        },
      })
      dailySpend = dr.data.data || []
    } catch (_) {}

    // Active + paused campaigns
    const campRes = await axios.get(`${FB_BASE}/${accountId}/campaigns`, {
      params: {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
        limit: 15,
        access_token: token,
      },
    })
    const campaigns = campRes.data.data || []

    // Per-campaign insights — parallel
    const campInsightResults = await Promise.allSettled(
      campaigns.slice(0, 10).map(c =>
        axios.get(`${FB_BASE}/${c.id}/insights`, {
          params: { fields: 'spend,impressions,clicks,ctr,reach,cpm,actions', date_preset: preset, access_token: token },
        })
      )
    )

    const campaignsWithInsights = campaigns.slice(0, 10).map((c, i) => ({
      ...c,
      insights: campInsightResults[i].status === 'fulfilled'
        ? campInsightResults[i].value.data.data?.[0] || {}
        : {},
    }))

    // Extract conversion actions from overview
    const overviewRaw = insightsRes.data.data?.[0] || {}
    const actionMap = {}
    ;(overviewRaw.actions || []).forEach(a => { actionMap[a.action_type] = parseFloat(a.value) || 0 })

    res.json({
      success: true, configured: true,
      data: {
        account: accountRes.data,
        overview: { ...overviewRaw, actionMap },
        campaigns: campaignsWithInsights,
        dailySpend,
      },
    })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    res.status(500).json({ success: false, message: msg })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  WEBSITE  — Google Analytics 4 Data API
// ==============================================================================

function makeGA4JWT(clientEmail, rawKey) {
  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now        = Math.floor(Date.now() / 1000)
  const header     = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload    = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url')
  const toSign = `${header}.${payload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(toSign)
  return `${toSign}.${signer.sign(privateKey, 'base64url')}`
}

async function getGA4AccessToken(email, key) {
  const jwt = makeGA4JWT(email, key)
  const res = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
  })
  return res.data.access_token
}

const parseGA4Report = (data) => {
  const dimHdrs = (data.dimensionHeaders || []).map(h => h.name)
  const metHdrs = (data.metricHeaders   || []).map(h => h.name)
  return (data.rows || []).map(row => {
    const obj = {}
    dimHdrs.forEach((h, i) => { obj[h] = row.dimensionValues?.[i]?.value || '' })
    metHdrs.forEach((h, i) => { obj[h] = parseFloat(row.metricValues?.[i]?.value) || 0 })
    return obj
  })
}

// GET /api/v1/social/website?range=28daysAgo
const getWebsiteAnalytics = async (req, res) => {
  const propertyId  = process.env.GA4_PROPERTY_ID
  const clientEmail = process.env.GA4_CLIENT_EMAIL
  const privateKey  = process.env.GA4_PRIVATE_KEY

  if (isPlaceholder(propertyId) || isPlaceholder(clientEmail) || isPlaceholder(privateKey)) {
    return res.json({ success: true, configured: false })
  }

  try {
    const accessToken = await getGA4AccessToken(clientEmail, privateKey)
    const range = req.query.range || '28daysAgo'
    const dateRanges = [{ startDate: range, endDate: 'yesterday' }]
    const GA4_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
    const headers = { Authorization: `Bearer ${accessToken}` }

    const [overviewRes, pagesRes, sourcesRes, deviceRes, trendRes] = await Promise.all([
      // Overall metrics
      axios.post(GA4_URL, {
        dateRanges,
        metrics: [
          { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
          { name: 'screenPageViews' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
        ],
      }, { headers }),

      // Top pages
      axios.post(GA4_URL, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      }, { headers }),

      // Traffic sources
      axios.post(GA4_URL, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }, { headers }),

      // Device category
      axios.post(GA4_URL, {
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }, { headers }),

      // Daily trend
      axios.post(GA4_URL, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }, { headers }),
    ])

    // Parse overview row
    const metHdrs  = (overviewRes.data.metricHeaders || []).map(h => h.name)
    const firstRow = overviewRes.data.rows?.[0]
    const overview = {}
    metHdrs.forEach((h, i) => { overview[h] = parseFloat(firstRow?.metricValues?.[i]?.value) || 0 })

    res.json({
      success: true, configured: true,
      data: {
        overview,
        topPages: parseGA4Report(pagesRes.data),
        sources:  parseGA4Report(sourcesRes.data),
        devices:  parseGA4Report(deviceRes.data),
        dailyTrend: parseGA4Report(trendRes.data),
      },
    })
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    res.status(500).json({ success: false, message: msg })
  }
}

module.exports = { getInstagramAnalytics, updateInstagramCaption, getMetaAdsAnalytics, getWebsiteAnalytics }
