import { db } from '../db';
import { classes } from '../schema';

await db.insert(classes).values([
    {
        id: 401,
        name: 'ICE 1'
    },
    {
        id: 402,
        name: 'ICE 2'
    },
    {
        id: 411,
        name: 'ICE T'
    },
    {
        id: 415,
        name: 'ICE T'
    },
    {
        id: 605,
        name: 'ICE TD'
    },
    {
        id: 403,
        name: 'ICE 3'
    },
    {
        id: 406,
        name: 'ICE 3M'
    },
    {
        id: 407,
        name: 'ICE 3'
    },
    {
        id: 412,
        name: 'ICE 4'
    },
    {
        id: 408,
        name: 'ICE 3neo'
    },
    {
        id: 105,
        name: 'ICE L'
    },
    {
        id: 4011,
        name: 'ICE T'
    }
]);