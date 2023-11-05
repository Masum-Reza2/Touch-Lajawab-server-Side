const express = require('express')
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middlewares
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mf3nl9y.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();
        const database = client.db("touchLajawab");
        const allFoodCollection = database.collection("allFoods");

        // >>>>>>JWT Auth related api<<<<<<
        app.post('/jwt', async (req, res) => {
            try {
                const jwtUser = req.body;
                // generate token
                const token = jwt.sign(jwtUser, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

                // set token in browser cookie

                res
                    .cookie('token', token, {
                        httpOnly: true,
                        secure: false, //http://localhost:5000/
                        // sameSite: 'none', //is server and client deployed in same site?
                        // maxAge
                    })
                    .send()
            } catch (error) {
                console.log(error)
            }
        })

        // CRUD operation starts here
        app.post('/allFoods', async (req, res) => {
            try {
                const newFoodItem = req.body;
                const result = await allFoodCollection.insertOne(newFoodItem);
                res.send(result);
            } catch (error) {
                console.log(error);
            }
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Restaurant server running!')
})

app.listen(port, () => {
    console.log(`Restaurant app listening on port ${port}`)
})