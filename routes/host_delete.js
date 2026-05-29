const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const {HostModel} = require("../db/models/host.mjs");
const cache = require("../libs/cache.mjs");

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });

router.get('/:host', validate_session, csrfProtection, (req, res) => {
    res.locals.csrfToken = req.csrfToken();
    const ip = req.params.host;
    if (!ip) {
        return res.render('host_delete', { error: 'IP address is required.' });
    }

    HostModel.findOne({ ip } ).then(host => {
        if (!host) {
            return res.render('host_delete', { error: 'Host not found.', ip });
        }
        return res.render('host_delete', { host, ip });
    }).catch(err => {
        console.error('Error fetching host:', err);
        return res.render('host_delete', { error: 'Error fetching host information.', ip });
    });
});

router.post('/', parseForm, csrfProtection, validate_session, (req, res) => {
    const ip = req.body.ip;
    res.locals.csrfToken = req.csrfToken();

    if (!ip) {
        return res.render('host_delete', { error: 'IP address is required.' });
    }

    HostModel.findOne({ ip } ).then(host => {
        if (!host) {
            return res.render('host_delete', { error: 'Host not found.', ip });
        }

        host.remove().then(() => {
            cache.default.set('all_applications', null, 1); // Invalidate cache
            return res.redirect('/hosts');
        }).catch(err => {
            console.error('Error deleting host:', err);
            return res.render('host_delete', { error: 'Failed to delete host. Please try again.', ip });
        })
    });
});

module.exports = router;

