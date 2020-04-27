const Cloudant = require('@cloudant/cloudant');
const me = process.env.Cloudant_Username; // Set this to your own account.
const password = process.env.Cloudant_Password;
const cloudant = Cloudant({ account: me, password: password });

const redzonesdb = cloudant.db.use("redzones");

const getRedZonesInfo = function (stateCode) {
    return new Promise(function (resolve, reject) {
        var query = {
            "selector": {
                "stateCode": {
                    "$eq": stateCode
                }
            },
            "fields": [
                "_id",
                "_rev",
                "redZones"
            ]
        }
        redzonesdb.find(query, function (err, result) {
            if (result.docs) {
                if (result.docs.length == 0) {
                    var json = {
                        "error": "no records found"
                    }
                    resolve(json);
                }
                else {
                    resolve(result.docs[0].redZones)
                }
            }
            else {
                var json = {
                    "error": "something went wrong"
                }
                resolve(json);
            }
        })
    })
};

module.exports = { "getRedZonesInfo": getRedZonesInfo }