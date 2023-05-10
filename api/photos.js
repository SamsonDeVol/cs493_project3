const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');

const photos = require('../data/photos');

exports.router = router;
exports.photos = photos;

/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};

const createPhotoTable = `
CREATE TABLE photos(
  userid MEDIUMINT NOT NULL, 
  businessid MEDIUMINT NOT NULL,
  caption VARCHAR(255),
  id MEDIUMINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  INDEX idx_userid (userid),
  INDEX idx_businessid (businessid)
)`

async function insertNewPhoto(photo) {
  const validatedPhoto = extractValidFields(
    photo,
    photoSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO photos SET ?', 
    validatedPhoto
  );
  return result.insertId
}

async function getPhotoById(id) {
  const query = `SELECT * FROM photos WHERE id=${id}`
  const [ photo ] = await mysqlPool.query(query)
  return photo
}

async function updatePhotoById(id, photo) {
  const validatedPhoto = extractValidFields(
    photo,
    photoSchema
  )
  const [ result ] = await mysqlPool.query(
    'UPDATE photos SET ? WHERE id = ?',
    [ validatedPhoto, id ]
  )
  return result.affectedRows > 0;
}

async function deletePhotoById(id) {
  const [ result ] = await mysqlPool.query(
    'DELETE FROM photos WHERE id = ?',
    [ id ]
  )
  return result.affectedRows > 0;
}

/*
 * Route to create a new photo.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, photoSchema)) {
    const photo = extractValidFields(req.body, photoSchema);
    try {
      const id = await insertNewPhoto(photo);
      res.status(201).json({
        id: id,
        links: {
          photo: `/photos/${id}`,
          business: `/businesses/${photo.businessid}`
        }
      });
    } catch (err) {
      res.status(500).json({
        error: "Error inserting photo into database"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid photo object"
    });
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:photoID', async function (req, res, next) {
  try {
    const photo = await getPhotoById(req.params.photoID);
    res.status(200).json(photo);
  } catch {
    next();
  }
});

/*
 * Route to update a photo.
 */
router.put('/:photoID', async function (req, res, next) {
  const photoID = parseInt(req.params.photoID);
  try {
    if (validateAgainstSchema(req.body, photoSchema)) {
      try {
        const updateSuccesful = await updatePhotoById(photoID, req.body)
        if (updateSuccesful) {
          res.status(200).send({
            id: photoID,
            links: {
              photo: `/photos/${photoID}`
            }
          });
        } else {
          next();
        }
      } catch (err) {
        res.status(500).json({
          error: "Unable to update photo"
        })
      }
    }
  } catch {
    next();
  }
});

/*
 * Route to delete a photo.
 */
router.delete('/:photoID', async function (req, res, next) {
  try {
    const deleteSuccessful = await deletePhotoById(req.params.photoID)
    if (deleteSuccessful) {
      res.status(204).end();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete photo"
    })
  }
});
