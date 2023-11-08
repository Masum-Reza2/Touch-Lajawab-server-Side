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

// custom middleware for token verification
const verifyToken = async (req, res, next) => {
    const token = req?.cookies?.token;

    // case 1
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }

    // case 2 verifying it
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        //  error
        if (err) {
            return res.status(401).send({ message: 'not authorized' })
        }

        // case 3 (proceed)
        req.user = decoded;
        next();
    });

}

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

        // // ***************jwt auth related API's*******************
        app.post('/jwt', async (req, res) => {
            try {
                const jwtUser = req.body;
                // generate token
                const token = jwt.sign(jwtUser, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

                // set token in browser cookie

                res
                    .cookie('token', token, {
                        httpOnly: true,
                        secure: false,
                        // sameSite: 'none', 
                    })
                    .send()
            } catch (error) {
                console.log(error)
            }
        })

        // clear the cookie after logout
        app.post('/logout', async (req, res) => {
            try {
                // const user = req.body;
                // console.log('logged out user', user);
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        httpOnly: true,
                        secure: false,
                        // sameSite: 'none',
                    })
                    .send({ success: true })
            } catch (error) {
                console.log(error)
            }
        })
        // ***************jwt auth related API's*******************



        // CRUD operation Endpoints here
        // create operation
        app.post('/allFoods', verifyToken, async (req, res) => {
            try {
                const newFoodItem = req.body;
                const result = await allFoodCollection.insertOne(newFoodItem);
                res.send(result);
            } catch (error) {
                console.log(error);
            }
        })

        // user specific food items
        // read operaion
        app.get('/userSpecific', verifyToken, async (req, res) => {
            try {
                //  validating user
                if (req.query?.email !== req?.user.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                let query = { ownerEmail: req.query?.email };
                const result = await allFoodCollection.find(query).toArray();
                return res.send(result);
            } catch (error) {
                console.log(error)
            }
        })


        // single food
        app.get('/allFoods/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await allFoodCollection.findOne(query);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // delete operation
        app.delete('/allFoods/:id', verifyToken, async (req, res) => {
            try {
                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
                const id = req?.params?.id;

                const query = { _id: new ObjectId(id) };
                const result = await allFoodCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })


        // update operation
        app.put('/allFoods/:id', verifyToken, async (req, res) => {
            try {

                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const id = req.params.id;
                const newFood = req.body;
                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        ...newFood
                    },
                };
                const result = await allFoodCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // >>>>>>>>>>>>>>Paginations Endpoints<<<<<<<<<<<<<<<<<<<
        app.get('/foodCount', async (req, res) => {
            try {
                const count = await allFoodCollection.estimatedDocumentCount();
                res.send({ count }) // sending total food number in client side.
            } catch (error) {
                console.log(error)
            }
        })

        // all food items as per page open route
        // most important endpoit i lean a lot operator of mongodb while working on it
        app.get('/allFoods', async (req, res) => {
            try {
                const searchText = req?.query?.searchText;

                const page = Number.parseFloat(req?.query?.page) || 0;
                const size = Number.parseFloat(req?.query?.size) || 9;
                const skip = (page - 1) * size;

                let cursor = allFoodCollection.find();

                if (searchText) {
                    const query = {
                        $or: [
                            { foodName: { $regex: searchText, $options: 'i' } },
                            { foodCategory: { $regex: searchText, $options: 'i' } },
                            { ownerName: { $regex: searchText, $options: 'i' } }
                        ]
                    };
                    cursor = allFoodCollection.find(query);
                    const result = await cursor.skip(skip).limit(size).toArray();
                    return res.send(result);
                }

                const result = await cursor.skip(skip).limit(size).toArray();
                res.send(result)
            } catch (error) {
                console.log(error)
            }
        })

        // testing endpoint >>>>>im not clearing this comment for learning purpose
        // app.get('/searchFoodItem', async (req, res) => {
        //     try {
        //         const searchText = req?.query?.searchText;
        //         console.log(searchText);

        //         // For an exact match search
        //         // const query = { foodName: searchText };
        //         // For text-based search using a regular expression (case-insensitive)
        //         // const query = { foodName: { $regex: searchText, $options: 'i' } };

        //         const query = {
        //             $or: [
        //                 { foodName: { $regex: searchText, $options: 'i' } },
        //                 { foodCategory: { $regex: searchText, $options: 'i' } },
        //                 { ownerName: { $regex: searchText, $options: 'i' } }
        //             ]
        //         };

        //         const cursor = allFoodCollection.find(query);
        //         const result = await cursor.toArray();
        //         res.send(result);
        //     } catch (error) {
        //         console.log(error);
        //         res.status(500).send({ error: 'An error occurred while searching for the food item.' });
        //     }
        // });
        // >>>>>>>>>>>>>>Paginations Endpoints<<<<<<<<<<<<<<<<<<<


        // >>>>>>>>>>>>>>User Bookings/Orders Endpoints<<<<<<<<<<<<<<<<<<<
        const bookingCollection = database.collection("bookings");
        app.post('/bookings', verifyToken, async (req, res) => {
            try {

                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const bookingFoodItem = req.body;
                const result = await bookingCollection.insertOne(bookingFoodItem);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // getting user specific booking
        app.get('/bookings', verifyToken, async (req, res) => {
            try {
                //  validating user
                if (req.query?.email !== req?.user.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                let query = { buyerEmail: req.query?.email };
                const result = await bookingCollection.find(query).toArray();
                return res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // delete operation
        app.delete('/bookings/:id', verifyToken, async (req, res) => {
            try {

                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const id = req?.params?.id;

                const query = { _id: new ObjectId(id) };
                const result = await bookingCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // update operation for quantity after user place a order >>>>extra feature<<<<
        app.put('/quantity/:id', verifyToken, async (req, res) => {
            try {

                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const id = req.params.id;
                const newQuantity = req.body;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        quantity: newQuantity?.newQuantity
                    },
                };
                const result = await allFoodCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // update operation for soldCount after user place a order >>>>extra feature<<<<
        app.put('/updateSoldCount/:id', verifyToken, async (req, res) => {
            try {

                //  validating user
                if (req.query?.email !== req?.user?.email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const id = req.params.id;
                const newSoldCount = req.body;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        soldCount: newSoldCount?.newSoldCount
                    },
                };
                const result = await allFoodCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })
        // >>>>>>>>>>>>>>User Bookings/Orders Endpoints<<<<<<<<<<<<<<<<<<<


        // >>>>>>>>>>>>>>6 top selling foods Endpoint<<<<<<<<<<<<<<<<<<<
        app.get('/topFoods', async (req, res) => {
            try {
                const options = {
                    sort: { soldCount: -1 },
                };
                const cursor = allFoodCollection.find({}, options).limit(6);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.log(error);
            }
        });

        // >>>>>>>>>>>>>>6 top selling foods Endpoints<<<<<<<<<<<<<<<<<<<


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