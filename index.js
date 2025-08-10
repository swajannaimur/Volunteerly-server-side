require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@swajan48.9pzqlth.mongodb.net/?retryWrites=true&w=majority&appName=Swajan48`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const volunteerCollections = client.db("volunteerDb").collection("volunteers");
        const requestsCollection = client.db("volunteerDb").collection("volunteerRequests");

        //Volunteer API
        app.get('/volunteers', async (req, res) => {
            const search = req.query.search || '';
            const email = req.query.email;
            
            console.log('hello brother', req.headers);
            let query = {};

            if (search) {
                query.postTitle = { $regex: search, $options: 'i' };
            }

            if (email) {
                query.organizerEmail = email;
            }

            const result = await volunteerCollections.find(query).toArray();
            res.send(result);
        });

        app.get('/volunteers/upcoming', async (req, res) => {
            const currentDate = new Date();
            const result = await volunteerCollections
                .find({ deadline: { $gte: currentDate } })
                .sort({ deadline: 1 })
                .limit(6)
                .toArray();
            res.send(result);
        });

        app.get('/volunteers/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await volunteerCollections.findOne(query)
            res.send(result)
        })

        // my Volunteer need post
        // app.get('/volunteers', async (req, res) => {
        //     const email = req.query.email

        //     console.log('request headersasdasdasdasd');

        //     const query = {
        //         organizerEmail: email
        //     }
        //     const result = await volunteerCollections.find(query).toArray()
        //     res.send(result)
        // });

        app.post('/volunteers', async (req, res) => {
            const data = req.body;
            if (data.deadline) {
                data.deadline = new Date(data.deadline);
            }
            const result = await volunteerCollections.insertOne(data);
            res.send(result);
        });

        app.put('/volunteers/:id', async (req, res) => {
            const id = req.params.id
            const updatedData = req.body;
            if (updatedData.deadline) {
                updatedData.deadline = new Date(updatedData.deadline)
            }
            const result = await volunteerCollections.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData })
            res.send(result)
        })

        app.delete('/volunteers/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await volunteerCollections.deleteOne(query)
            res.send(result)
        })

        // request api
        app.get('/requests', async (req, res) => {
            const result = await requestsCollection.find().toArray()
            res.send(result)
        })

        app.get('/requests/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await requestsCollection.findOne(query)
            res.send(result)
        })

        app.post('/requests', async (req, res) => {
            const data = req.body;
            const insertResult = await requestsCollection.insertOne(data);
            const { volunteerPostId } = data;
            const updateResult = await volunteerCollections.updateOne(
                { _id: new ObjectId(volunteerPostId) },
                { $inc: { volunteersNeeded: -1 } }
            );
            res.send({ insertResult, updateResult });
        });

        app.get('/myRequests', async (req, res) => {
            const email = req.query.email
            const query = {
                volunteerEmail: email
            }
            const result = await requestsCollection.find(query).toArray()
            res.send(result)
        });

        app.delete('/requests/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await requestsCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})


app.listen(port, () => {
    // console.log(`Example app listening on port ${port}`)
})
