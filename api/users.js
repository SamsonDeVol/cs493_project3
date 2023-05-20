const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');
const bcrypt = require("bcryptjs")
const { requireAuthentication, generateAuthToken } = require('../lib/auth')
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
}

async function insertNewUser(user) {
  const validatedUser = extractValidFields(
    user,
    userSchema
  )

  // hash/salt password
  const hash = await bcrypt.hash(validatedUser.password, 8)
  validatedUser.password = hash

  const [ result ] = await mysqlPool.query(
    'INSERT INTO users SET ?',
    validatedUser
  );
  return result.insertId
}

async function getUserById(userID, includePassword) {
  const [ result ] = await mysqlPool.query(
    `SELECT * FROM users WHERE id=${userID};`
  )
  // protect password
  if (!includePassword){
    result[0].password = 0;
  }
  return result
}

async function getUserBusinessesById(userID) {
  const [ result ] = await mysqlPool.query(
    `SELECT * FROM businesses WHERE ownerid=${userID}`
  )
  return result
}

async function getUserReviewsById(userID) {
  const [ result ] = await mysqlPool.query(
    `SELECT * FROM reviews WHERE userid=${userID}`
  )
  return result
}
async function getUserPhotosById(userID) {
  const [ result ] = await mysqlPool.query(
    `SELECT * FROM photos WHERE userid=${userID}`
  )
  return result
}

async function validateUser(userID, password){
  const [ user ] = await getUserById(userID, true)
  const authenticated = user && await bcrypt.compare(password, user.password);
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

router.get('/:userid', requireAuthentication, async (req, res) => {
  const userid = parseInt(req.params.userid);
  const result = await getUserById(userid, false)
  if (req.user != req.params.userid) {
    res.status(403).json({
      error: "Unauthorized to access the specified resource"
    });
  } else {
    res.status(200).json({
      result
    })
  }
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
router.get('/:userid/businesses', requireAuthentication, async (req, res) => {
  // const userid = parseInt(req.params.userid);

  // const userBusinesses = businesses.filter(business => business && business.ownerid === userid);
  // res.status(200).json({
  //   businesses: userBusinesses
  // });

  const userid = parseInt(req.params.userid);
  const userBusinesses = await getUserBusinessesById(userid)
  if (req.user != req.params.userid) {
    res.status(403).json({
      error: "Unauthorized to access the specified resource"
    });
  } else {
    res.status(200).json({
      userBusinesses
    })
  }
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', requireAuthentication, async (req, res) => {
  const userid = parseInt(req.params.userid);
  const userReviews = await getUserReviewsById(userid)
  if (req.user != req.params.userid) {
    res.status(403).json({
      error: "Unauthorized to access the specified resource"
    });
  } else {
    res.status(200).json({
      userReviews
    })
  }
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', requireAuthentication, async (req, res) => {
  const userid = parseInt(req.params.userid);
  const userPhotos = await getUserPhotosById(userid)
  if (req.user != req.params.userid) {
    res.status(403).json({
      error: "Unauthorized to access the specified resource"
    });
  } else {
    res.status(200).json({
      userPhotos
    })
  }
});
