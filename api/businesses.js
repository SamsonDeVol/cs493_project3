const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');

const businesses = require('../data/businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

exports.router = router;
exports.businesses = businesses;

/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

async function createBusinessesTable() {
  await mysqlPool.query(`
    CREATE TABLE businesses(
      ownerid MEDIUMINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255) NOT NULL,
      city VARCHAR(255) NOT NULL,
      state VARCHAR(255) NOT NULL,
      zip VARCHAR(255) NOT NULL,
      phone VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      subcategory VARCHAR(255) NOT NULL,
      website VARCHAR(255),
      email VARCHAR(255),
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      PRIMARY KEY (id),
      INDEX idx_ownerid (ownerid)
    )`
  )
}

/*
 * Function to return count from business table
 */
async function getBusinessCount() {
  const [ count ] = await mysqlPool.query(
      "SELECT COUNT(*) AS count FROM businesses;"
  )
  return count;
}

/*
 * Function to return page of businesses
 */
async function getBusinessPage(page) {
  const count = await getBusinessCount()
  const [ businessPage ] = await mysqlPool.query(
    "SELECT * FROM businesses;"
  )
  const numPerPage = 1;
  const lastPage = Math.ceil(businessPage.length / numPerPage);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;

  const start = (page - 1) * numPerPage;
  const end = start + numPerPage;
  const pageBusinesses = businessPage.slice(start, end);

  const links = {};
  if (page < lastPage) {
    links.nextPage = `/businesses?page=${page + 1}`;
    links.lastPage = `/businesses?page=${lastPage}`;
  }
  if (page > 1) {
    links.prevPage = `/businesses?page=${page - 1}`;
    links.firstPage = '/businesses?page=1';
  }

  return {
    businesses: pageBusinesses,
    pageNumber: page,
    totalPages: lastPage,
    pageSize: numPerPage,
    totalCount: count,
    links: links
  }
}

async function getBusinessById(id) {
  const query = `SELECT * FROM businesses WHERE id=${id};`
  const [ business ] = await mysqlPool.query(query)
  return business
}

async function insertNewBusiness(business) {
  const validatedBusiness = extractValidFields(
    business,
    businessSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO businesses SET ?',
    validatedBusiness
  );
  return result.insertId
}

async function updateBusinessById(businessId, business) {
  const validatedBusiness = extractValidFields(
      business,
      businessSchema
  );
  const [ result ] = await mysqlPool.query(
      'UPDATE businesses SET ? WHERE id = ?',
      [ validatedBusiness, businessId ]
  );
  return result.affectedRows > 0;
}

async function deleteBusinessById(businessId) {
  const [ result ] = await mysqlPool.query(
      'DELETE FROM businesses WHERE id = ?',
      [ businessId ]
  );
  return result.affectedRows > 0;
}

router.post('/createBusinessesTable', async (req, res) => {
  try {
    await createBusinessesTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating businesses table"
    })
  }
});

/*
 * Route to return a list of businesses.
 */
router.get('/', async (req, res) => {
try {
  const businessesPage = await getBusinessPage(parseInt(req.query.page) || 1);
  res.status(200).send(businessesPage)
} catch (err) {
  res.status(500).json({
    error: "Error fetching businesses list"
  })
}
});

/*
 * Route to create a new business.
 */
router.post('/', async (req, res) => {
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const id = await insertNewBusiness(req.body);
      res.status(201).json({
        id: id,
        links: {
          business: `/businesses/${id}`
        }
      });
    } catch (err) {
      console.log("err", err)
      res.status(500).json({
        error: `Error inserting business into database ${err}`
      });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', async (req, res, next) => {
  try {
    const business = await getBusinessById(req.params.businessid);
    res.status(200).json(business);
  } catch {
    next();
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const updateSucessful = await updateBusinessById(req.params.businessid, req.body)
      if (updateSucessful) {
        res.status(200).send({
          id: req.params.businessid,
          links: {
            business: `/businesses/${req.params.businessid}`
          }});
      } else {
        next();
      }
    } catch (err) {
      res.status(500).json({
        error: "Unable to update business"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
  
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', async function (req, res, next) {
  try {
    const deleteSuccessful = await deleteBusinessById(req.params.businessid);

    if (deleteSuccessful) {
            res.status(204).end();
    } else {
        next();
    }
} catch (err) {
    res.status(500).send({
        error: "Unable to delete business."
    });
}
});
