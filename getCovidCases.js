

const unirest = require('unirest');
var worldCasesData = {};
var countryCasesData = {};
var stateCasesData = {};

const getWorldWideCases = function () {
    unirest
        .get("https://corona.lmao.ninja/v2/all")
        .headers({ 'Content-Type': 'application/json' })
        .then((response) => {
            worldCasesData.totalCases = response.body.cases;
            worldCasesData.todayCases = response.body.todayCases;
            worldCasesData.totalDeaths = response.body.deaths;
            worldCasesData.todayDeaths = response.body.todayDeaths;
            worldCasesData.totalRecovered = response.body.recovered;
            worldCasesData.totalActive = response.body.active;
            worldCasesData.affectedCountries = response.body.affectedCountries;
        })
}
const getCountryCases = function () {
    unirest
        .get("https://corona.lmao.ninja/v2/countries/India")
        .headers({ 'Content-Type': 'application/json' })
        .then((response) => {
            countryCasesData.totalCases = response.body.cases;
            countryCasesData.todayCases = response.body.todayCases;
            countryCasesData.totalDeaths = response.body.deaths;
            countryCasesData.todayDeaths = response.body.todayDeaths;
            countryCasesData.totalRecovered = response.body.recovered;
            countryCasesData.totalActive = response.body.active;
        })
}

const getStateCases = function () {
    unirest
        .get("https://api.covid19india.org/state_district_wise.json")
        .headers({ 'Content-Type': 'application/json' })
        .then((response) => {
            var states = response.body;
            Object.keys(states).map(function (state) {
                var stateCode = states[state].statecode;
                stateCasesData[stateCode] = { totalCases: 0, totalActive: 0, totalDeaths: 0, totalRecovered: 0 };

                var districts = states[state].districtData;
                Object.keys(districts).map(function (district) {
                    var district = districts[district];
                    stateCasesData[stateCode].totalCases += district.confirmed;
                    stateCasesData[stateCode].totalActive += district.active;
                    stateCasesData[stateCode].totalDeaths += district.deceased;
                    stateCasesData[stateCode].totalRecovered += district.recovered;
                });
            })
        })
}


getWorldWideCases();
getCountryCases();
getStateCases();
setInterval(getWorldWideCases, 3600000);
setInterval(getCountryCases, 3600000);
setInterval(getStateCases, 3600000);

module.exports = {
    worldCasesData: worldCasesData,
    countryCasesData: countryCasesData,
    stateCasesData: stateCasesData
}