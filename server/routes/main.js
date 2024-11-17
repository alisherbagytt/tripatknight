const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Trip = require('../models/trip-model.js');
const axios = require('axios');

/**
 * GET /
 * HOME
*/
router.get('', async (req, res) => {
  try {
    const locals = {
      title: "NodeJs Blog",
      description: "Simple Blog created with NodeJs, Express & MongoDb."
    }

    let perPage = 10;
    let page = req.query.page || 1;

    const data = await Post.aggregate([ { $sort: { createdAt: -1 } } ])
    .skip(perPage * page - perPage)
    .limit(perPage)
    .exec();


    const count = await Post.countDocuments({});
    const nextPage = parseInt(page) + 1;
    const hasNextPage = nextPage <= Math.ceil(count / perPage);

    res.render('index', { 
      locals,
      data,
      current: page,
      nextPage: hasNextPage ? nextPage : null,
      currentRoute: '/'
    });

  } catch (error) {
    console.log(error);
  }

});



/**
 * GET /
 * Post :id
*/
router.get('/post/:id', async (req, res) => {
  try {
    let slug = req.params.id;

    const data = await Post.findById({ _id: slug });

    const locals = {
      title: data.title,
      description: "Simple Blog created with NodeJs, Express & MongoDb.",
    }

    res.render('post', { 
      locals,
      data,
      currentRoute: `/post/${slug}`
    });
  } catch (error) {
    console.log(error);
  }

});


/**
 * POST /
 * Post - searchTerm
*/
router.post('/search', async (req, res) => {
  try {
    const locals = {
      title: "Seach",
      description: "Simple Blog created with NodeJs, Express & MongoDb."
    }

    let searchTerm = req.body.searchTerm;
    const searchNoSpecialChar = searchTerm.replace(/[^a-zA-Z0-9 ]/g, "")

    const data = await Post.find({
      $or: [
        { title: { $regex: new RegExp(searchNoSpecialChar, 'i') }},
        { body: { $regex: new RegExp(searchNoSpecialChar, 'i') }}
      ]
    });

    res.render("search", {
      data,
      locals,
      currentRoute: '/'
    });

  } catch (error) {
    console.log(error);
  }

});


/**
 * GET /
 * About
*/
router.get('/about', (req, res) => {
  res.render('about', {
    currentRoute: '/about'
  });
});

router.get('/news', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 10;
    const locals = {
      title: "Latest News",
      description: "Stay updated with the latest news from around the world",
      currentRoute: '/news'  // Add this line for navigation
    };

    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country: 'us',
        pageSize: pageSize,
        page: page,
        apiKey: process.env.NEWS_API_KEY
      }
    });

    const totalResults = response.data.totalResults;
    const totalPages = Math.ceil(totalResults / pageSize);
    const nextPage = page < totalPages ? page + 1 : null;

    res.render('news', {
      ...locals,  // Spread the locals object
      data: response.data.articles,
      current: page,
      nextPage: nextPage
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).render('error', {
      locals: {
        title: "Error",
        description: "Error fetching news",
        currentRoute: '/news'  // Add this for error page as well
      },
      message: 'Error fetching news',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    console.log('Attempting to fetch statistics data...');

    const tripData = await Trip.find({});
    console.log('Data fetched:', tripData);

    const locals = {
      title: "Trip Statistics",
      description: "Analysis of Travel Data"
    }

    res.render('statistics', {
      locals,
      data: tripData,
      currentRoute: '/statistics'
    });

  } catch (error) {
    console.error('Error in statistics route:', error);
    res.status(500).render('error', {
      locals: {
        title: "Error",
        description: "Error fetching statistics"
      },
      message: "Error fetching statistics: " + error.message,
      currentRoute: '/statistics'
    });
  }
});

module.exports = router;
