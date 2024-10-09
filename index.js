const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const mongoDb = require("mongodb-memory-server");

require("dotenv").config();

app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

///////////////////////////////////////////////////////////////////////////////////

async function connect() {
    const mongoServer = await mongoDb.MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, { dbName: "myDb" });
}

const userSchema = new mongoose.Schema({
    username: String,
});
let User = mongoose.model("user", userSchema);

const exerciseSchema = new mongoose.Schema({
    userId: String,
    username: String,
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: Date,
});
let Exercise = mongoose.model("exercise", exerciseSchema);

///////////////////////////////////////////////////////////////////////////////////

app.post("/api/users", (req, res) => {
    const inputUsername = req.body.username;

    let newUser = new User({ username: inputUsername });

    newUser
        .save()
        .then(() => {
            res.json({ username: newUser.username, _id: newUser._id });
        })
        .catch((err) => {
            console.log(err);
            res.json({ message: "User creation failed!" });
        });
});

app.post("/api/users/:_id/exercises", (req, res) => {
    const userId = req.params._id;
    const description = req.body.description;
    const duration = parseInt(req.body.duration);
    let date = new Date(req.body.date);

    if (isNaN(date.getTime())) {
        date = new Date(); 
    }
    
    User.findById(userId)
        .then((userInDb) => {
            if (!userInDb) {
                return res.json({ message: "User not found in the database!" });
            }

            let newExercise = new Exercise({
                userId: userInDb._id,
                username: userInDb.username,
                description: description,
                duration: duration,
                date: date.toDateString(),
            });

            newExercise
                .save()
                .then(() => {
                    res.json({
                        username: userInDb.username,
                        description: newExercise.description,
                        duration: newExercise.duration,
                        date: new Date(newExercise.date).toDateString(),
                        _id: userInDb._id,
                    });
                })
                .catch((err) => {
                    console.log(err);
                    res.json({ message: "Exercise creation failed!" });
                });
        })
        .catch((err) => {
            console.log(err);
            res.json({
                message: "There are no users with that ID in the database!",
            });
        });
});

app.get("/api/users/:_id/logs?", async (req, res) => {
    const userId = req.params._id;
    const from = req.query.from || new Date(0).toISOString().substring(0, 10);
    const to = req.query.to || new Date(Date.now()).toISOString().substring(0, 10);
    const limit = Number(req.query.limit) || 0;

    User.findById(userId)
        .then((userDb) => {

            Exercise.find({
                userId: userId,
                date: { $gte: from, $lte: to },
            })
                .limit(limit)
                .then((exercises) => {
                    const desc = [...exercises].sort(
                        (a, b) => b.date.getTime() - a.date.getTime()
                    );

                    let parsedDatesLog = desc.map((exercise) => {
                        return {
                            description: exercise.description,
                            duration: exercise.duration,
                            date: new Date(exercise.date).toDateString(),
                        };
                    });

                    res.json({
                        _id: userDb._id,
                        username: userDb.username,
                        count: parsedDatesLog.length,
                        log: parsedDatesLog,
                    });
                })
                .catch((err) => {
                    console.log("error fetching exercises");
                });
        })
        .catch((err) => {
            console.log(err);
            res.json({
                message: "There are no users with that ID in the database!",
            });
        });
});

app.get("/api/users", async (req, res) => {
  let users = await User.find().exec();

  let parsedUsers = users.map((user) => {
    return {
      username: user.username,
      _id: user._id
    };
});

  res.json(parsedUsers)
});


app.get("/", async (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
    await User.syncIndexes();
    await Exercise.syncIndexes();
});

connect()
    .then(() => {
        try {
            const listener = app.listen(process.env.PORT || 3000, () => {
                console.log(
                    "Your app is listening on port " + listener.address().port
                );
            });
        } catch (error) {
            console.log("could not connect to server");
        }
    })
    .catch(() => {
        console.log("could not connect to db");
    });
