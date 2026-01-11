import { db } from '../db';
import { trains } from '../schema';
import trainsData from './trains.json';

// Parse date from DD.MM.YYYY format to Date object
function parseDate(dateString: string): Date {
  const parts = dateString.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateString}. Expected DD.MM.YYYY`);
  }
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date values: ${dateString}`);
  }
  
  // Create date (month is 0-indexed in JavaScript Date)
  const date = new Date(year, month - 1, day);
  
  // Validate the date (check if it's a valid date)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  
  return date;
}

async function seedTrains() {
  
  // Prepare trains for insertion
  const trainsToInsert = trainsData
    .map((train) => {
      let nameSince: Date;
      let nameUntil: Date | null = null;
    
      try {
        nameSince = parseDate(train.nameSince);
      } catch (error) {
        console.error(`Invalid nameSince: ${train.nameSince}`, error);
        return null;
      }

      if (train.nameUntil) {
        try {
          nameUntil = parseDate(train.nameUntil);
        } catch (error) {
          console.error(`Invalid nameUntil: ${train.nameUntil}`, error);
          return null;
        }
      }
      
      // Determine if train is active (no nameUntil or nameUntil is in the future)
      const isActive = !nameUntil;
      
      const trainTz = parseInt(train.tz);

      if(isNaN(trainTz)) {
        console.error(`Invalid train tz: ${train.tz}`);
        return null;
      }
      return {
        tz: parseInt(train.tz),
        name: train.name,
        classId: parseInt(train.classId),
        comment: train.comment || null,
        isActive,
        nameSince,
        nameUntil,
      };
    

    })
    .filter((train): train is NonNullable<typeof train> => train !== null);
  
  console.log(`Prepared ${trainsToInsert.length} trains for insertion (${trainsData.length - trainsToInsert.length} skipped)`);
  
  if (trainsToInsert.length === 0) {
    console.error('No trains to insert. Please check your classId mapping.');
    return;
  }
  
  await db.delete(trains);
  try {
    // Insert in batches to avoid overwhelming the database
    const batchSize = 1;
    let insertedCount = 0;
    
    for (let i = 0; i < trainsToInsert.length; i += batchSize) {
      const batch = trainsToInsert.slice(i, i + batchSize);
      await db.insert(trains).values(batch);
      insertedCount += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${insertedCount}/${trainsToInsert.length} trains)`);
    }
    
    console.log(`Successfully seeded ${insertedCount} trains!`);
  } catch (error) {
    console.error('Error seeding trains:', error);
    throw error;
  }
}

// Run the seed function
seedTrains().catch(console.error);
