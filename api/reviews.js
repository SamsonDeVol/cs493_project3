const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');

const reviews = require('../data/reviews');

exports.router = router;
exports.reviews = reviews;

/*
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};

async function createReviewsTable() { 
  await mysqlPool.query(`
    CREATE TABLE reviews(
      userid MEDIUMINT NOT NULL,
      businessid MEDIUMINT NOT NULL,
      dollars MEDIUMINT NOT NULL,
      stars MEDIUMINT NOT NULL,
      review VARCHAR(255),
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      PRIMARY KEY (id),
      INDEX idx_businessid (businessid)
    )`
  )
}

async function getReviewById(id) {
  const query = `SELECT * FROM reviews WHERE id=${id}`
  const [ review ] = await mysqlPool.query(query)
  return review
}

async function checkUserPreviousReview(review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    `SELECT COUNT(*) AS count FROM reviews WHERE userid = ? AND businessid = ?`,
    [ validatedReview.userid, validatedReview.businessid ]
  );
  return result[0].count
}

async function insertNewReview(review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO reviews SET ?',
    validatedReview
  );
  return result.insertId
}

async function updateReviewById(id, review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    'UPDATE reviews SET ? WHERE id = ?',
    [ validatedReview, id ]
  )
  return result.affectedRows > 0;
}

async function deleteReviewById(id) {
  const [ result ] = await mysqlPool.query(
    'DELETE FROM reviews WHERE id = ?',
    [ id ]
  )
  return result.affectedRows > 0;
}

router.post('/createReviewsTable', async (req, res) => {
  try {
    await createReviewsTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating reviews table"
    })
  }
});


/*
 * Route to create a new review.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {

    const review = extractValidFields(req.body, reviewSchema);
    try {
      const userReviewedThisBusinessAlready = await checkUserPreviousReview(req.body)
      if (userReviewedThisBusinessAlready > 0) {
        res.status(403).json({
          error: "User has already posted a review of this business"
        });
      } else {
        try {
          const id = await insertNewReview(review);
          res.status(201).json({
            id: id,
            links: {
              review: `/reviews/${id}`,
              business: `/businesses/${review.businessid}`
            }
          });
        } catch (err) {
          res.status(500).json({
            error: "Error inserting review into database"
          });
        }
      }
    } catch (err) {
        res.status(500).json({
          error: "Error validating user review history"
        });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }
});

/*
 * Route to fetch info about a specific review.
 */
router.get('/:reviewID', async function (req, res, next) {
  try {
    const review = await getReviewById(req.params.reviewID);
    res.status(200).json(review);
  } catch {
    next();
  }
});

/*
 * Route to update a review.
 */
router.put('/:reviewID', async function (req, res, next) {
  const reviewID = parseInt(req.params.reviewID);
  try {
    if (validateAgainstSchema(req.body, reviewSchema)) {
      try {
        const updateSuccesful = await updateReviewById(reviewID, req.body)
        if (updateSuccesful) {
          res.status(200).send({
            id: reviewID,
            links: {
              review: `/reviews/${reviewID}`
            }
          });
        } else {
          next();
        }
      } catch (err) {
        res.status(500).json({
          error: "Unable to update review"
        })
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid review object"
      });
    }
  } catch {
    next();
  }
});

/*
 * Route to delete a review.
 */
router.delete('/:reviewID', async function (req, res, next) {
  try {
    const deleteSuccessful = await deleteReviewById(req.params.reviewID)
    if (deleteSuccessful) {
      res.status(204).end();
    } else { 
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete review"
    })
  }
});
