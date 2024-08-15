import { createClient } from "@libsql/client";

// const db = new Database("http://localhost:8080");

const db = createClient({
  url: "file:local-data.db",
  syncUrl: "http://localhost:5001",
  syncPeriod: 60,
});

const rep = await db.sync();

console.log(rep);

export default function registerLocalFirst(fastify, opts, done) {
  fastify.all("/", async (request, reply) => {
    const id = request.query.id;

    const invoiceData = await db.execute({
      sql: `SELECT 
        InvoiceId as id,
        InvoiceDate as date, 
        BillingAddress as address, 
        BillingCity as city, 
        BillingState as state, 
        BillingCountry as country, 
        BillingPostalCode AS postalCode, 
        Total as total 
      FROM 
        Invoice
      WHERE 
        InvoiceId = ?`,
      args: [id],
    });

    if (invoiceData.rows.length === 0) {
      reply.code(404);
      reply.send({ error: "Not found" });
      return;
    }

    const invoiceRows = keysAndValuesToObject(
      invoiceData.columns,
      invoiceData.rows[0]
    );

    const trackData = await db.execute({
      sql: `SELECT 
            i.UnitPrice AS unitPrice, 
            i.Quantity AS quantity, 
            t.Name AS trackName, 
            a.Title AS albumTitle,
            ar.Name AS artistName
          FROM 
            InvoiceLine i
          JOIN
            Track t ON t.TrackId = i.TrackId
          JOIN
            Album a ON a.AlbumId = t.AlbumId
          JOIN
            Artist ar ON ar.ArtistId = a.ArtistId
          WHERE 
            InvoiceId = ?`,
      args: [id],
    });

    const trackRows = trackData.rows.map((row) =>
      keysAndValuesToObject(trackData.columns, row)
    );

    reply.send({ invoice: invoiceRows, lines: trackRows });
  });
  done();
}

function keysAndValuesToObject(keys, values) {
  return keys.reduce((acc, key, index) => {
    acc[key] = values[index];
    return acc;
  }, {});
}
