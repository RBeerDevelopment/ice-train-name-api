import * as schema from "./schema"
import { defineRelations } from "drizzle-orm"
export const relations = defineRelations(schema, (r) => ({
    trains: {
        class: r.one.classes({
            from: r.trains.classId,
            to: r.classes.id,
        })
    },
    classes: {
        trains: r.many.trains()
    }
}));