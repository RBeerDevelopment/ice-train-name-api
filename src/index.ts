import { Hono } from 'hono'
import { db } from './db/db'
import { trains, classes } from './db/schema'
import { eq, like, or } from 'drizzle-orm'

const app = new Hono().basePath('/api/v1')

// Get train by tz
app.get('/trains/:tz', async (c) => {
  const tz = parseInt(c.req.param('tz'))
  
  if (isNaN(tz)) {
    return c.json({ error: 'Invalid tz parameter' }, 400)
  }
  
  const result = await db
    .select()
    .from(trains)
    .leftJoin(classes, eq(trains.classId, classes.id))
    .where(eq(trains.tz, tz))
    .limit(1)
  
  if (result.length === 0) {
    return c.json({ error: 'Train not found' }, 404)
  }
  
  const row = result[0];
  const train = {
    ...row.trains,
    className: row.classes?.id ? row.classes.name : null
  }
  
  return c.json(train)
})

// Get list of trains by partial query (name or tz)
app.get('/trains', async (c) => {
  const query = c.req.query('query')
  
  let results;
  
  if (!query) {
    // If no query, return all trains
    results = await db
      .select()
      .from(trains)
      .leftJoin(classes, eq(trains.classId, classes.id))
      .limit(100)
  } else {
    // Try to parse as number for tz search
    const tzNumber = parseInt(query)
    const isTzSearch = !isNaN(tzNumber)
    
    // Build search conditions
    const conditions = isTzSearch
      ? or(
          eq(trains.tz, tzNumber),
          like(trains.name, `%${query}%`)
        )
      : like(trains.name, `%${query}%`)
    
    results = await db
      .select()
      .from(trains)
      .leftJoin(classes, eq(trains.classId, classes.id))
      .where(conditions)
      .limit(50)
  }
  
  // Format results to match expected structure
  const formattedResults = results.map(row => ({
    ...row.trains,
    className: row.classes?.id ? row.classes.name : null
  }))
  
  return c.json(formattedResults)
})

// Get list of trains by classId
app.get('/classes/:classId/trains', async (c) => {
  if(!c.req.param('classId')) {
    return c.json({ error: 'classId parameter is required' }, 400)
  }
  const classId = parseInt(c.req.param('classId'))
  
  if (isNaN(classId)) {
    return c.json({ error: 'Invalid classId parameter' }, 400)
  }
  
  const results = await db
    .select()
    .from(trains)
    .leftJoin(classes, eq(trains.classId, classes.id))
    .where(eq(trains.classId, classId))
  
  // Format results to match expected structure
  const formattedResults = results.map(row => ({
    ...row.trains,
    className: row.classes?.id ? row.classes.name : null
  }))
  
  return c.json(formattedResults)
})

export default app
