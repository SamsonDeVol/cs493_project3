const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');
const bcrypt = require("bcryptjs")
const {generateAuthToken } = require('../lib/auth')
exports.router = router;

const { businesses } = require('./businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

const userSchema = {
  name: { required: true },
  email: { require: true },
  password: {required: true },
  admin: { required: false }
}

async function createUsersTable() {
  console.log("creating users table")
  const [result] = await mysqlPool.query(`
    CREATE TABLE users(
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      admin BOOLEAN NOT NULL DEFAULT (false),
      PRIMARY KEY (id)
    )`
  )

  console.log("res: ", result)
}

async function insertNewUser(user) {
  const validatedUser = extractValidFields(
    user,
    userSchema
  )

  // hash/salt password
  const hash = await bcrypt.hash(validatedUser.password, 8)
  console.log("hash", hash);
  validatedUser.password = hash

  console.log("inserting user", user)
  const [ result ] = await mysqlPool.query(
    'INSERT INTO users SET ?',
    validatedUser
  );
  console.log("res", result)
  return result.insertId
}

async function getUserById(userID, includePassword) {
  console.log("user id", userID)
  const [ result ] = await mysqlPool.query(
    `SELECT * FROM users WHERE id=${userID};`
  )
  // protect password
  if (!includePassword){
    result[0].password = 0;
  }
  return result
}

async function validateUser(userID, password){
  console.log("id", userID, "pass", password)
  
  const [ user ] = await getUserById(userID, true)
  console.log("user", user)
  const authenticated = user && await bcrypt.compare(password, user.password);
  console.log("auth", authenticated)
  return authenticated;
}

router.post('/createUsersTable', async (req, res) => {
  try {
    await createUsersTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating users table"
    })
  }
});

router.post('/', async (req,res) => {
  if (validateAgainstSchema(req.body, userSchema)) {
    try {
      const id = await insertNewUser(req.body);
      res.status(201).json({
        id: id
      });
    } catch (err) {
      console.log("err", err)
      res.status(500).json({
        error: `Error inserting user into database ${err}`
      });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid user object"
    });
  }
})

router.get('/:userid', async (req, res) => {
  const userid = parseInt(req.params.userid);
  const result = await getUserById(userid, false)
  res.status(200).json({
    result
  })
})

router.post('/login', async (req, res) => {
  if (req.body && req.body.id && req.body.password) {
    try {
      const authenticated = await validateUser(req.body.id, req.body.password);
      if (authenticated) {
        const token = generateAuthToken(req.body.id);
        res.status(200).send({ token: token });
      } else {
        res.status(401).send({
          error: "Invalid authentication credentials"
        });
      }
    } catch (err) {
      res.status(500).send({
        error: "Error logging in.  Try again later."
      });
    }
  } else {
    res.status(400).json({
      error: "Request body needs user id and password."
    });
  }
})
/*
 * Route to list all of a user's businesses.
 */
router.get('/:userid/businesses', function (req, res) {
  const userid = parseInt(req.params.userid);
  const userBusinesses = businesses.filter(business => business && business.ownerid === userid);
  res.status(200).json({
    businesses: userBusinesses
  });
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', function (req, res) {
  const userid = parseInt(req.params.userid);
  const userReviews = reviews.filter(review => review && review.userid === userid);
  res.status(200).json({
    reviews: userReviews
  });
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', function (req, res) {
  const userid = parseInt(req.params.userid);
  const userPhotos = photos.filter(photo => photo && photo.userid === userid);
  res.status(200).json({
    photos: userPhotos
  });
});
