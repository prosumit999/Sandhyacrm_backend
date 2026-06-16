const MS_PER_DAY = 24 * 60 * 60 * 1000

// Returns number of full days until the given date (negative if already past)
const daysUntil = (date) => {
    const diff = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
    return Math.ceil(diff / MS_PER_DAY)
}

const isExpired = (date) => daysUntil(date) < 0

const addDays = (date, n) => new Date(new Date(date).getTime() + n * MS_PER_DAY)

module.exports = { daysUntil, isExpired, addDays }
